import { initializeApp, cert, type App } from 'firebase-admin/app';
import { getAuth, type Auth } from 'firebase-admin/auth';

let app: App | null = null;

export function getFirebaseAdmin(): Auth {
  if (!app) {
    const sa = process.env.FIREBASE_SERVICE_ACCOUNT;
    if (!sa) throw new Error('FIREBASE_SERVICE_ACCOUNT not configured');
    app = initializeApp({ credential: cert(JSON.parse(sa)) });
  }
  return getAuth(app);
}
