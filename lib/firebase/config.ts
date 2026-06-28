import { initializeApp, getApps, getApp, type FirebaseApp } from 'firebase/app';
import { getAuth, GoogleAuthProvider, type Auth } from 'firebase/auth';
import {
  getFirestore,
  initializeFirestore,
  persistentLocalCache,
  persistentMultipleTabManager,
  type Firestore,
} from 'firebase/firestore';
import { getStorage, type FirebaseStorage } from 'firebase/storage';

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
};

/** Firebase konfiqurasiyasının dolu olub-olmadığını yoxlayır */
export const isFirebaseConfigured = Boolean(firebaseConfig.apiKey && firebaseConfig.projectId);

export const googleProvider = new GoogleAuthProvider();

// ── Lazy singletons ──────────────────────────────────────────
// Servis instansları yalnız ilk dəfə istifadə olunanda (client-də, effect/handler
// daxilində) yaradılır. Bu, build/SSG zamanı (API key yoxdursa) çökməsinin qarşısını alır.
let _app: FirebaseApp | undefined;
let _auth: Auth | undefined;
let _db: Firestore | undefined;
let _storage: FirebaseStorage | undefined;

export function getFirebaseApp(): FirebaseApp {
  if (!_app) _app = getApps().length ? getApp() : initializeApp(firebaseConfig);
  return _app;
}

export function getFirebaseAuth(): Auth {
  if (!_auth) _auth = getAuth(getFirebaseApp());
  return _auth;
}

export function getDb(): Firestore {
  if (_db) return _db;
  const app = getFirebaseApp();
  if (typeof window === 'undefined') {
    _db = getFirestore(app);
    return _db;
  }
  try {
    _db = initializeFirestore(app, {
      localCache: persistentLocalCache({ tabManager: persistentMultipleTabManager() }),
    });
  } catch {
    _db = getFirestore(app);
  }
  return _db;
}

export function getFirebaseStorage(): FirebaseStorage {
  if (!_storage) _storage = getStorage(getFirebaseApp());
  return _storage;
}

/**
 * İkinci (secondary) Firebase app instansı qaytarır. Admin yeni istifadəçi
 * yaradanda `createUserWithEmailAndPassword` cari sessiyanı əvəz etməsin deyə
 * istifadə olunur. İstifadədən sonra `deleteApp` çağırılmalıdır.
 */
export function getSecondaryAuth(): { auth: Auth; cleanup: () => Promise<void> } {
  const name = `secondary-${Date.now()}`;
  const secondaryApp = initializeApp(firebaseConfig, name);
  return {
    auth: getAuth(secondaryApp),
    cleanup: async () => {
      const { deleteApp } = await import('firebase/app');
      await deleteApp(secondaryApp);
    },
  };
}
