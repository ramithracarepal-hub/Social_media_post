import 'dotenv/config';
import fs from 'node:fs';
import admin from 'firebase-admin';

function loadCredential() {
  if (process.env.FIREBASE_SERVICE_ACCOUNT_B64) {
    return JSON.parse(Buffer.from(process.env.FIREBASE_SERVICE_ACCOUNT_B64, 'base64').toString('utf8'));
  }
  const path = process.env.GOOGLE_APPLICATION_CREDENTIALS || './serviceAccountKey.json';
  return JSON.parse(fs.readFileSync(path, 'utf8'));
}

if (!admin.apps.length) {
  admin.initializeApp({ credential: admin.credential.cert(loadCredential()) });
}

export const db = admin.firestore();
export const Timestamp = admin.firestore.Timestamp;
