import { useState, useEffect } from 'react';
import { User, onAuthStateChanged } from 'firebase/auth';
import {
  collection,
  doc,
  setDoc,
  deleteDoc,
  onSnapshot,
  query,
  writeBatch,
  serverTimestamp,
  getDoc
} from 'firebase/firestore';
import { auth, db, loginWithUserIdAndPassword, registerWithUserIdAndPassword, logoutUser, handleFirestoreError, OperationType } from '../firebase';
import { Bookmark, ReadingHistory } from '../types';

// Regex validation matching firestore.rules regex
const isValidId = (id: string) => {
  return typeof id === 'string' && id.length > 0 && id.length <= 128 && /^[a-zA-Z0-9_\-]+$/.test(id);
};

export function useFirebaseSync() {
  const getInitialLocalData = () => {
    try {
      const storedHistory = localStorage.getItem('nettruyen_history_v1');
      const storedBookmarks = localStorage.getItem('nettruyen_bookmarks_v1');

      return {
        bookmarks: storedBookmarks ? JSON.parse(storedBookmarks) as Bookmark[] : [] as Bookmark[],
        history: storedHistory ? JSON.parse(storedHistory) as ReadingHistory[] : [] as ReadingHistory[],
      };
    } catch {
      return { bookmarks: [], history: [] };
    }
  };

  const initialLocalData = getInitialLocalData();

  const [user, setUser] = useState<User | null>(null);
  const [loadingAuth, setLoadingAuth] = useState(true);
  
  // States of synced lists
  const [bookmarks, setBookmarks] = useState<Bookmark[]>(initialLocalData.bookmarks);
  const [readingHistory, setReadingHistory] = useState<ReadingHistory[]>(initialLocalData.history);

  const persistLocalData = (nextBookmarks: Bookmark[], nextHistory: ReadingHistory[]) => {
    localStorage.setItem('nettruyen_bookmarks_v1', JSON.stringify(nextBookmarks));
    localStorage.setItem('nettruyen_history_v1', JSON.stringify(nextHistory));
  };

  const mergeBookmarks = (left: Bookmark[], right: Bookmark[]) => {
    const byId = new Map<string, Bookmark>();
    [...left, ...right].forEach((item) => {
      const existing = byId.get(item.comicId);
      if (!existing) {
        byId.set(item.comicId, item);
        return;
      }

      const existingTime = new Date(existing.bookmarkedAt || 0).getTime();
      const nextTime = new Date(item.bookmarkedAt || 0).getTime();
      if (nextTime >= existingTime) {
        byId.set(item.comicId, item);
      }
    });

    return Array.from(byId.values()).sort((a, b) => new Date(b.bookmarkedAt).getTime() - new Date(a.bookmarkedAt).getTime());
  };

  const mergeHistory = (left: ReadingHistory[], right: ReadingHistory[]) => {
    const byId = new Map<string, ReadingHistory>();
    [...left, ...right].forEach((item) => {
      const existing = byId.get(item.comicId);
      if (!existing) {
        byId.set(item.comicId, item);
        return;
      }

      const existingTime = new Date(existing.updatedAt || 0).getTime();
      const nextTime = new Date(item.updatedAt || 0).getTime();
      if (nextTime >= existingTime) {
        byId.set(item.comicId, item);
      }
    });

    return Array.from(byId.values()).sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
  };

  const syncMergedCache = (incomingBookmarks: Bookmark[] = [], incomingHistory: ReadingHistory[] = []) => {
    const local = getInitialLocalData();
    const nextBookmarks = mergeBookmarks(local.bookmarks, incomingBookmarks);
    const nextHistory = mergeHistory(local.history, incomingHistory);
    setBookmarks(nextBookmarks);
    setReadingHistory(nextHistory);
    persistLocalData(nextBookmarks, nextHistory);
    return { nextBookmarks, nextHistory };
  };

  const overwriteCache = (nextBookmarks: Bookmark[], nextHistory: ReadingHistory[]) => {
    setBookmarks(nextBookmarks);
    setReadingHistory(nextHistory);
    persistLocalData(nextBookmarks, nextHistory);
  };

  // Listen to Auth state
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      setUser(currentUser);
      
      if (currentUser) {
        // Enforce secure user profile registration
        try {
          const userRef = doc(db, 'users', currentUser.uid);
          const snap = await getDoc(userRef);
          
          if (!snap.exists()) {
            await setDoc(userRef, {
              uid: currentUser.uid,
              email: currentUser.email || '',
              loginId: currentUser.displayName || (currentUser.email || '').split('@')[0] || '',
              displayName: currentUser.displayName || 'Bạn đọc',
              createdAt: serverTimestamp()
            });
            console.log('Registered user profile successfully.');
          }
          
          // Trigger local storage data migration once user first signs in
          await migrateLocalDataToCloud(currentUser.uid);
        } catch (e) {
          console.error('Lỗi khởi tạo hồ sơ người dùng:', e);
        }
      } else {
        // Fallback to local storage lists on sign out
        loadLocalData();
      }
      setLoadingAuth(false);
    });

    return () => unsubscribe();
  }, []);

  // Sync real-time data from Firestore when signed in
  useEffect(() => {
    if (!user) return;

    // 1. Subscribe to Bookmarks
    const bookmarksPath = `users/${user.uid}/bookmarks`;
    const qBookmarks = query(collection(db, bookmarksPath));
    const unsubBookmarks = onSnapshot(
      qBookmarks,
      (snapshot) => {
        const list: Bookmark[] = [];
        snapshot.forEach((subDoc) => {
          const data = subDoc.data();
          // Support Firestore Timestamp or raw ISO String parsing
          const bookmarkedAt = data.bookmarkedAt?.toDate 
            ? data.bookmarkedAt.toDate().toISOString() 
            : (data.bookmarkedAt || new Date().toISOString());

          list.push({
            comicId: data.comicId,
            comicTitle: data.comicTitle,
            comicThumbnail: data.comicThumbnail || '',
            bookmarkedAt
          });
        });
        // Sort descending by bookmarkedAt
        list.sort((a, b) => new Date(b.bookmarkedAt).getTime() - new Date(a.bookmarkedAt).getTime());
        syncMergedCache(list, []);
      },
      (error) => {
        handleFirestoreError(error, OperationType.LIST, bookmarksPath);
      }
    );

    // 2. Subscribe to Reading History
    const historyPath = `users/${user.uid}/history`;
    const qHistory = query(collection(db, historyPath));
    const unsubHistory = onSnapshot(
      qHistory,
      (snapshot) => {
        const list: ReadingHistory[] = [];
        snapshot.forEach((subDoc) => {
          const data = subDoc.data();
          const updatedAt = data.updatedAt?.toDate 
            ? data.updatedAt.toDate().toISOString() 
            : (data.updatedAt || new Date().toISOString());

          list.push({
            comicId: data.comicId,
            comicTitle: data.comicTitle,
            comicThumbnail: data.comicThumbnail || '',
            chapterId: data.chapterId,
            chapterName: data.chapterName,
            updatedAt
          });
        });
        // Sort descending by updatedAt
        list.sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
        syncMergedCache([], list);
      },
      (error) => {
        handleFirestoreError(error, OperationType.LIST, historyPath);
      }
    );

    return () => {
      unsubBookmarks();
      unsubHistory();
    };
  }, [user]);

  // Load from local storage functions
  const loadLocalData = () => {
    try {
      const storedHistory = localStorage.getItem('nettruyen_history_v1');
      if (storedHistory) {
        setReadingHistory(JSON.parse(storedHistory));
      } else {
        setReadingHistory([]);
      }

      const storedBookmarks = localStorage.getItem('nettruyen_bookmarks_v1');
      if (storedBookmarks) {
        setBookmarks(JSON.parse(storedBookmarks));
      } else {
        setBookmarks([]);
      }
    } catch (e) {
      console.error('Lỗi giải mã LocalStorage:', e);
    }
  };

  // Run local migration to Firestore
  const migrateLocalDataToCloud = async (uid: string) => {
    try {
      const { bookmarks: bookmarksList, history: historyList } = getInitialLocalData();

      if (bookmarksList.length > 0) {
        const batch = writeBatch(db);
        let count = 0;
        bookmarksList.forEach((b) => {
          if (isValidId(b.comicId)) {
            const ref = doc(db, `users/${uid}/bookmarks`, b.comicId);
            batch.set(ref, {
              comicId: b.comicId,
              comicTitle: b.comicTitle,
              comicThumbnail: b.comicThumbnail || '',
              bookmarkedAt: serverTimestamp()
            });
            count++;
          }
        });
        if (count > 0) await batch.commit();
      }

      if (historyList.length > 0) {
        const batch = writeBatch(db);
        let count = 0;
        historyList.forEach((h) => {
          if (isValidId(h.comicId) && isValidId(h.chapterId)) {
            const ref = doc(db, `users/${uid}/history`, h.comicId);
            batch.set(ref, {
              comicId: h.comicId,
              comicTitle: h.comicTitle,
              comicThumbnail: h.comicThumbnail || '',
              chapterId: h.chapterId,
              chapterName: h.chapterName,
              updatedAt: serverTimestamp()
            });
            count++;
          }
        });
        if (count > 0) await batch.commit();
      }

      // Keep the local cache aligned with what was pushed to Firestore.
      syncMergedCache(bookmarksList, historyList);
      console.log('Đã đồng bộ hoá dữ liệu lên Cloud thành công.');
    } catch (e) {
      console.error('Lỗi đồng bộ dữ liệu cục bộ lên đám mây:', e);
    }
  };

  // Sign out helper
  const handleSignOut = async () => {
    await logoutUser();
  };

  // Mutator actions supporting local-fallback
  const handleToggleBookmark = async (comic: { id: string; title: string; thumbnail: string }) => {
    if (user) {
      if (!isValidId(comic.id)) return;
      const isBookmarked = bookmarks.some((b) => b.comicId === comic.id);
      const docRef = doc(db, `users/${user.uid}/bookmarks`, comic.id);
      
      try {
        if (isBookmarked) {
          // Unfollow
          await deleteDoc(docRef);
        } else {
          // Follow
          await setDoc(docRef, {
            comicId: comic.id,
            comicTitle: comic.title,
            comicThumbnail: comic.thumbnail,
            bookmarkedAt: serverTimestamp()
          });
        }

        const nextBookmarks = isBookmarked
          ? bookmarks.filter((b) => b.comicId !== comic.id)
          : [{ comicId: comic.id, comicTitle: comic.title, comicThumbnail: comic.thumbnail, bookmarkedAt: new Date().toISOString() }, ...bookmarks.filter((b) => b.comicId !== comic.id)];
        if (isBookmarked) {
          overwriteCache(nextBookmarks, readingHistory);
        } else {
          syncMergedCache(nextBookmarks, []);
        }
      } catch (e) {
        handleFirestoreError(e, OperationType.WRITE, `users/${user.uid}/bookmarks/${comic.id}`);
      }
      } else {
      // Local fallback
      let nextBookmarks = [...bookmarks];
      const index = bookmarks.findIndex((b) => b.comicId === comic.id);
      if (index > -1) {
        nextBookmarks.splice(index, 1);
      } else {
        nextBookmarks.unshift({
          comicId: comic.id,
          comicTitle: comic.title,
          comicThumbnail: comic.thumbnail,
          bookmarkedAt: new Date().toISOString()
        });
      }
      syncMergedCache(nextBookmarks, []);
    }
  };

  const handleRemoveBookmark = async (comicId: string) => {
    if (user) {
      if (!isValidId(comicId)) return;
      const docRef = doc(db, `users/${user.uid}/bookmarks`, comicId);
      try {
        await deleteDoc(docRef);

        const nextBookmarks = bookmarks.filter((b) => b.comicId !== comicId);
        overwriteCache(nextBookmarks, readingHistory);
      } catch (e) {
        handleFirestoreError(e, OperationType.DELETE, `users/${user.uid}/bookmarks/${comicId}`);
      }
    } else {
      const nextBookmarks = bookmarks.filter((b) => b.comicId !== comicId);
      overwriteCache(nextBookmarks, readingHistory);
    }
  };

  const handleUpdateHistory = async (historyEntry: {
    comicId: string;
    comicTitle: string;
    comicThumbnail: string;
    chapterId: string;
    chapterName: string;
  }) => {
    if (user) {
      if (!isValidId(historyEntry.comicId) || !isValidId(historyEntry.chapterId)) return;
      const docRef = doc(db, `users/${user.uid}/history`, historyEntry.comicId);
      try {
        await setDoc(docRef, {
          comicId: historyEntry.comicId,
          comicTitle: historyEntry.comicTitle,
          comicThumbnail: historyEntry.comicThumbnail || '',
          chapterId: historyEntry.chapterId,
          chapterName: historyEntry.chapterName,
          updatedAt: serverTimestamp()
        });

        let nextHistory = [...readingHistory];
        nextHistory = nextHistory.filter((h) => h.comicId !== historyEntry.comicId);
        nextHistory.unshift({
          comicId: historyEntry.comicId,
          comicTitle: historyEntry.comicTitle,
          comicThumbnail: historyEntry.comicThumbnail || '',
          chapterId: historyEntry.chapterId,
          chapterName: historyEntry.chapterName,
          updatedAt: new Date().toISOString()
        });
        if (nextHistory.length > 40) {
          nextHistory = nextHistory.slice(0, 40);
        }
        syncMergedCache([], nextHistory);
      } catch (e) {
        handleFirestoreError(e, OperationType.WRITE, `users/${user.uid}/history/${historyEntry.comicId}`);
      }
    } else {
      // Local fallback
      let nextHistory = [...readingHistory];
      nextHistory = nextHistory.filter((h) => h.comicId !== historyEntry.comicId);
      nextHistory.unshift({
        comicId: historyEntry.comicId,
        comicTitle: historyEntry.comicTitle,
        comicThumbnail: historyEntry.comicThumbnail || '',
        chapterId: historyEntry.chapterId,
        chapterName: historyEntry.chapterName,
        updatedAt: new Date().toISOString()
      });
      if (nextHistory.length > 40) {
        nextHistory = nextHistory.slice(0, 40);
      }
      syncMergedCache([], nextHistory);
    }
  };

  const handleClearBookmarks = async () => {
    if (user) {
      const batch = writeBatch(db);
      bookmarks.forEach((b) => {
        if (isValidId(b.comicId)) {
          const ref = doc(db, `users/${user.uid}/bookmarks`, b.comicId);
          batch.delete(ref);
        }
      });
      try {
        await batch.commit();
        overwriteCache([], readingHistory);
      } catch (e) {
        handleFirestoreError(e, OperationType.DELETE, `users/${user.uid}/bookmarks`);
      }
    } else {
      overwriteCache([], readingHistory);
    }
  };

  const handleClearHistory = async () => {
    if (user) {
      const batch = writeBatch(db);
      readingHistory.forEach((h) => {
        if (isValidId(h.comicId)) {
          const ref = doc(db, `users/${user.uid}/history`, h.comicId);
          batch.delete(ref);
        }
      });
      try {
        await batch.commit();
        overwriteCache(bookmarks, []);
      } catch (e) {
        handleFirestoreError(e, OperationType.DELETE, `users/${user.uid}/history`);
      }
    } else {
      overwriteCache(bookmarks, []);
    }
  };

  return {
    user,
    loadingAuth,
    signInWithCredentials: loginWithUserIdAndPassword,
    registerWithCredentials: registerWithUserIdAndPassword,
    signOut: handleSignOut,
    bookmarks,
    readingHistory,
    toggleBookmark: handleToggleBookmark,
    removeBookmark: handleRemoveBookmark,
    updateHistory: handleUpdateHistory,
    clearBookmarks: handleClearBookmarks,
    clearHistory: handleClearHistory
  };
}
