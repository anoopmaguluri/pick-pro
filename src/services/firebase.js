import { initializeApp } from 'firebase/app';
import { getDatabase } from 'firebase/database';
import {
  initializeFirestore,
  persistentLocalCache,
  persistentSingleTabManager
} from 'firebase/firestore';
import { getAuth, signInAnonymously } from 'firebase/auth';

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  databaseURL: import.meta.env.VITE_FIREBASE_DB_URL,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
  measurementId: import.meta.env.VITE_FIREBASE_MEASUREMENT_ID
};

const app = initializeApp(firebaseConfig);

// Keep RTDB active for dual-write migration phase
export const db = getDatabase(app);

// Initialize Firestore with explicit IndexedDB offline persistence
// Using persistentSingleTabManager as recommended for simple PWAs to avoid multi-tab lock contention issues
export const firestore = initializeFirestore(app, {
  localCache: persistentLocalCache({
    tabManager: persistentSingleTabManager()
  })
});

export const auth = getAuth(app);

let authSessionPromise = null;

export const ensureFirebaseSession = () => {
  if (!authSessionPromise) {
    authSessionPromise = signInAnonymously(auth).catch((error) => {
      authSessionPromise = null;
      throw error;
    });
  }
  return authSessionPromise;
};

// Expose a check for offline eviction (Safari PWA guardrail)
export const checkAndRefreshAuth = async () => {
  if (!auth.currentUser) {
    authSessionPromise = null; // force fresh call
    await ensureFirebaseSession();
  }
};
