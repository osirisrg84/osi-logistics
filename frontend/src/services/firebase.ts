import { initializeApp, getApps } from 'firebase/app';
import { getAuth } from 'firebase/auth';

const apiKey = import.meta.env.VITE_FIREBASE_API_KEY || '';

// Only initialize if config is present — prevents crash when env vars are missing
const app = getApps().length === 0
  ? initializeApp({
      apiKey,
      authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || '',
      projectId:  import.meta.env.VITE_FIREBASE_PROJECT_ID  || '',
    })
  : getApps()[0];

export const firebaseAuth = getAuth(app);
