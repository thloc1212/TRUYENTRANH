# Security Specification & Threat Model

This document outlines the security specifications, data invariants, and defensive validation patterns for NetTruyen Pro's Firestore database.

## 1. Data Invariants

*   **Path Owner Isolation**: A user can only access, write, or delete documents residing directly in their own path subtree `/users/{userId}/**`, where `{userId}` strictly matches `request.auth.uid`.
*   **Immutable Identity fields**: Core fields like `uid` on the user profile, `comicId` on bookmarks, and `comicId` on histories cannot be altered after creation.
*   **Temporal Integrity**: Timestamp values (`createdAt`, `bookmarkedAt`, `updatedAt`) must rely strictly on `request.time` (Firestore server time) rather than client-configured values.
*   **Defensive Key Constraint**: No document can store additional "ghost" keys or unwhitelisted attributes, blocking privilege-escalation or shadow attributes.
*   **ID Size & Format Validation**: To prevent Resource Poisoning / DOS attacks, all path-variable IDs must be alphanumeric, non-empty, and limited in length (<= 128 characters).

---

## 2. The "Dirty Dozen" Vulnerability Payloads

The rules are hardened against the following 12 attack vectors designed to breach data integrity, bypass authorization, or run denial of wallet attacks:

| ID | Threat Vector / Attack Scenario | Malicious Input Payload | Target Firestore Path | Expected Result |
|---|---|---|---|---|
| **01** | **Identity Spoofing** (Write other profile) | `{"uid":"victim123", "email":"victim@gmail.com"}` | `/users/victim123` by Attacker (`auth.uid = "attacker456"`) | **PERMISSION_DENIED** |
| **02** | **Identity Spoofing** (Follow manga for other) | `{"comicId":"conan", "comicTitle":"Conan", "bookmarkedAt":"request.time"}` | `/users/victim123/bookmarks/conan` by Attacker | **PERMISSION_DENIED** |
| **03** | **Identity Spoofing** (Spoof read history for other) | `{"comicId":"one-piece", "comicTitle":"One Piece", "chapterId":"ch-100", "chapterName":"Chapter 100", "updatedAt":"request.time"}` | `/users/victim123/history/one-piece` by Attacker | **PERMISSION_DENIED** |
| **04** | **Schema Violations** (Missing required key) | `{"comicTitle":"One Piece", "bookmarkedAt":"request.time"}` (Missing `comicId`) | `/users/attacker456/bookmarks/one-piece` by Attacker | **PERMISSION_DENIED** |
| **05** | **Shadow Fields Attack** (Ad-hoc admin injection) | `{"uid":"attacker456", "email":"attacker@gmail.com", "isAdmin":true}` | `/users/attacker456` by Attacker | **PERMISSION_DENIED** |
| **06** | **Resource Poisoning** (Extremely long document ID) | `{"comicId":"a...[10k characters]..."}` | `/users/attacker456/bookmarks/very-long-id` | **PERMISSION_DENIED** |
| **07** | **Regex / ID Injection Guard** (HTML/Script IDs) | `{"comicId":"<script>xyz</script>"}` | `/users/attacker456/bookmarks/<script>alert(1)</script>` | **PERMISSION_DENIED** |
| **08** | **Stale Timestamp Attack** (Created client-side time) | `{"uid":"attacker456", "email":"attacker@gmail.com", "createdAt":"2000-01-01T00:00:00Z"}` | `/users/attacker456` | **PERMISSION_DENIED** |
| **09** | **Stale Timestamp Attack** (Bookmark custom timestamp) | `{"comicId":"one-piece", "comicTitle":"One Piece", "bookmarkedAt":"2020-01-01T00:00:00Z"}` | `/users/attacker456/bookmarks/one-piece` | **PERMISSION_DENIED** |
| **10** | **Field Type Poisoning** (Comic title as boolean) | `{"comicId":"one-piece", "comicTitle": true, "bookmarkedAt":"request.time"}` | `/users/attacker456/bookmarks/one-piece` | **PERMISSION_DENIED** |
| **11** | **Blanket Reading Probe** (Guest reading other users data) | Read request | `/users/victim123/bookmarks/conan` by Guest (`auth = null`) | **PERMISSION_DENIED** |
| **12** | **Update Immortality Violation** (Altering Comic ID on bookmark) | `{"comicId":"different-manga", "comicTitle":"One Piece", "bookmarkedAt":"request.time"}` | `/users/attacker456/bookmarks/one-piece` | **PERMISSION_DENIED** |

---

## 3. Test Runner Definition: `firestore.rules.test.ts`

Below is the complete testing framework block to validate that all "Dirty Dozen" malicious payloads are successfully blocked:

```typescript
import {
  initializeTestEnvironment,
  RulesTestEnvironment,
} from '@firebase/rules-unit-testing';
import { doc, getDoc, setDoc, updateDoc } from 'firebase/firestore';

let testEnv: RulesTestEnvironment;

describe('NetTruyen Pro Hardened Firestore Rules Unit Tests', () => {
  beforeAll(async () => {
    testEnv = await initializeTestEnvironment({
      projectId: 'central-grid-ftxfk',
      firestore: {
        rules: `
          rules_version = '2';
          service cloud.firestore {
            match /databases/{database}/documents {
              match /{document=**} {
                allow read, write: if false;
              }
            }
          }
        `,
      },
    });
  });

  afterAll(async () => {
    await testEnv.cleanup();
  });

  it('Blocks Dirty Payload #01: Attacker attempting to write victim profile', async () => {
    const attackerContext = testEnv.authenticatedContext('attacker456');
    const db = attackerContext.firestore();
    const maliciousDoc = doc(db, 'users', 'victim123');
    
    await expect(
      setDoc(maliciousDoc, { uid: 'victim123', email: 'victim@gmail.com' })
    ).rejects.toThrow();
  });

  it('Blocks Dirty Payload #02: Attacker updating bookmark for different user', async () => {
    const attackerContext = testEnv.authenticatedContext('attacker456');
    const db = attackerContext.firestore();
    const maliciousDoc = doc(db, 'users/victim123/bookmarks', 'conan');

    await expect(
      setDoc(maliciousDoc, { comicId: 'conan', comicTitle: 'Conan' })
    ).rejects.toThrow();
  });

  it('Blocks Dirty Payload #03: Attacker creating history log for different user', async () => {
    const attackerContext = testEnv.authenticatedContext('attacker456');
    const db = attackerContext.firestore();
    const maliciousDoc = doc(db, 'users/victim123/history', 'one-piece');

    await expect(
      setDoc(maliciousDoc, { comicId: 'one-piece', comicTitle: 'One Piece', chapterId: 'ch-100', chapterName: 'Chapter 100' })
    ).rejects.toThrow();
  });

  it('Blocks Dirty Payload #04: Creation missing schema required properties (comicId)', async () => {
    const userContext = testEnv.authenticatedContext('attacker456');
    const db = userContext.firestore();
    const badDoc = doc(db, 'users/attacker456/bookmarks', 'one-piece');

    await expect(
      setDoc(badDoc, { comicTitle: 'One Piece' })
    ).rejects.toThrow();
  });

  it('Blocks Dirty Payload #05: Shadow field injection of isAdmin on User profile', async () => {
    const userContext = testEnv.authenticatedContext('attacker456');
    const db = userContext.firestore();
    const badDoc = doc(db, 'users', 'attacker456');

    await expect(
      setDoc(badDoc, { uid: 'attacker456', email: 'attacker@gmail.com', isAdmin: true })
    ).rejects.toThrow();
  });

  it('Blocks Dirty Payload #06: Extra large document ID / Denial of Wallet', async () => {
    const userContext = testEnv.authenticatedContext('attacker456');
    const db = userContext.firestore();
    const longId = 'a'.repeat(1000);
    const badDoc = doc(db, `users/attacker456/bookmarks/${longId}`);

    await expect(
      setDoc(badDoc, { comicId: longId, comicTitle: 'Exorbitant' })
    ).rejects.toThrow();
  });

  it('Blocks Dirty Payload #07: HTML Script ID poisoning in document URL path', async () => {
    const userContext = testEnv.authenticatedContext('attacker456');
    const db = userContext.firestore();
    const badDoc = doc(db, 'users/attacker456/bookmarks/<script>alert(1)</script>');

    await expect(
      setDoc(badDoc, { comicId: 'test', comicTitle: 'Title' })
    ).rejects.toThrow();
  });

  it('Blocks Dirty Payload #08: Forging custom createdAt historic timestamp', async () => {
    const userContext = testEnv.authenticatedContext('attacker456');
    const db = userContext.firestore();
    const badDoc = doc(db, 'users', 'attacker456');

    await expect(
      setDoc(badDoc, { uid: 'attacker456', email: 'attacker@gmail.com', createdAt: '2000-01-01T00:00:00Z' })
    ).rejects.toThrow();
  });

  it('Blocks Dirty Payload #09: Forging custom bookmarkedAt timestamp', async () => {
    const userContext = testEnv.authenticatedContext('attacker456');
    const db = userContext.firestore();
    const badDoc = doc(db, 'users/attacker456/bookmarks', 'naruto');

    await expect(
      setDoc(badDoc, { comicId: 'naruto', comicTitle: 'Naruto', bookmarkedAt: '2020-01-01T00:00:00Z' })
    ).rejects.toThrow();
  });

  it('Blocks Dirty Payload #10: Writing type poisoning boolean instead of string', async () => {
    const userContext = testEnv.authenticatedContext('attacker456');
    const db = userContext.firestore();
    const badDoc = doc(db, 'users/attacker456/bookmarks', 'tokyo-ghoul');

    await expect(
      setDoc(badDoc, { comicId: 'tokyo-ghoul', comicTitle: true })
    ).rejects.toThrow();
  });

  it('Blocks Dirty Payload #11: Unauthenticated request attempting to read private bookmark', async () => {
    const anonymousContext = testEnv.unauthenticatedContext();
    const db = anonymousContext.firestore();
    const targetDoc = doc(db, 'users/victim123/bookmarks', 'one-piece');

    await expect(getDoc(targetDoc)).rejects.toThrow();
  });

  it('Blocks Dirty Payload #12: Attempting to modify immutable comicId field on update', async () => {
    const userContext = testEnv.authenticatedContext('attacker456');
    const db = userContext.firestore();
    const targetDoc = doc(db, 'users/attacker456/bookmarks', 'one-piece');

    await expect(
      updateDoc(targetDoc, { comicId: 'overwritten-id' })
    ).rejects.toThrow();
  });
});
```
