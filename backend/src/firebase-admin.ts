import * as admin from 'firebase-admin';

let ready = false;

export function getFirebaseAdmin() {
  if (!ready) {
    const sa = process.env.FIREBASE_SERVICE_ACCOUNT;
    if (!sa) throw new Error('FIREBASE_SERVICE_ACCOUNT not configured');
    admin.initializeApp({ credential: admin.credential.cert(JSON.parse(sa)) });
    ready = true;
  }
  return admin;
}
