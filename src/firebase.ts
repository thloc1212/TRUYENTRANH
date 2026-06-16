import { initializeApp } from 'firebase/app';
import { getAuth, createUserWithEmailAndPassword, signInWithEmailAndPassword, signOut, updateProfile } from 'firebase/auth';
import { getFirestore, doc, getDocFromServer } from 'firebase/firestore';
// @ts-ignore
import firebaseConfig from '../firebase-applet-config.json';

const typedFirebaseConfig = firebaseConfig as {
  projectId: string;
  appId: string;
  apiKey: string;
  authDomain: string;
  firestoreDatabaseId?: string;
  storageBucket?: string;
  messagingSenderId?: string;
  measurementId?: string;
};

const app = initializeApp(typedFirebaseConfig);

// CRITICAL: The app will break without calling getFirestore with firestoreDatabaseId!
export const db = getFirestore(app, typedFirebaseConfig.firestoreDatabaseId || 'default');
export const auth = getAuth(app);

const AUTH_EMAIL_DOMAIN = 'nettruyen.local';

const normalizeUserId = (userId: string) => userId.trim().toLowerCase();
const userIdToEmail = (userId: string) => `${normalizeUserId(userId)}@${AUTH_EMAIL_DOMAIN}`;

// Username/password login helper using a synthetic internal email.
export const loginWithUserIdAndPassword = async (userId: string, password: string) => {
  try {
    const result = await signInWithEmailAndPassword(auth, userIdToEmail(userId), password);
    return result.user;
  } catch (error) {
    console.error('Lỗi đăng nhập bằng ID/mật khẩu:', error);
    throw error;
  }
};

// Username/password registration helper.
export const registerWithUserIdAndPassword = async (userId: string, password: string) => {
  try {
    const result = await createUserWithEmailAndPassword(auth, userIdToEmail(userId), password);
    await updateProfile(result.user, {
      displayName: normalizeUserId(userId),
    });
    return result.user;
  } catch (error) {
    console.error('Lỗi tạo tài khoản bằng ID/mật khẩu:', error);
    throw error;
  }
};

// Sign out
export const logoutUser = async () => {
  try {
    await signOut(auth);
  } catch (error) {
    console.error('Lỗi đăng xuất:', error);
    throw error;
  }
};

// CRITICAL CONSTRAINT: When the application initially boots, call getFromServer to test the connection.
async function testConnection() {
  try {
    await getDocFromServer(doc(db, 'test', 'connection'));
  } catch (error) {
    if (error instanceof Error && error.message.includes('the client is offline')) {
      console.error("Please check your Firebase configuration.");
    }
  }
}
testConnection();

// Core error handling structure mandatory by guidelines
export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

export interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
    tenantId?: string | null;
    providerInfo?: {
      providerId?: string | null;
      email?: string | null;
    }[];
  };
}

export function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
      providerInfo: auth.currentUser?.providerData?.map(provider => ({
        providerId: provider.providerId,
        email: provider.email,
      })) || []
    },
    operationType,
    path
  };
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}
