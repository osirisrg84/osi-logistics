import { initializeApp, getApps, FirebaseApp } from 'firebase/app';
import { getAuth, Auth } from 'firebase/auth';

let firebaseApp: FirebaseApp | null = null;
let _firebaseAuth: Auth | null = null;

const apiKey = import.meta.env.VITE_FIREBASE_API_KEY;

if (apiKey) {
  try {
    firebaseApp = getApps().length === 0
      ? initializeApp({
          apiKey,
          authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || '',
          projectId:  import.meta.env.VITE_FIREBASE_PROJECT_ID  || '',
        })
      : getApps()[0];
    _firebaseAuth = getAuth(firebaseApp);
  } catch (e) {
    console.warn('[Firebase] init failed:', e);
  }
}

export const firebaseAuth = _firebaseAuth;
export const firebaseReady = !!_firebaseAuth;
