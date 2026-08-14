// src/lib/firebase.ts
//
// Client-SDK Firestore. Auth lives in `./firebase-auth` so that importing one
// does not pull in the other; see the note in `./firebase-app`.
//
// Server-side code should use the Admin SDK (`./firebaseAdminSafe`) instead:
// Firestore rules check `request.auth`, which is null outside the browser.
import { getFirestore, Firestore } from 'firebase/firestore';
import { app, firebaseApp } from './firebase-app';

let db: Firestore;

try {
  db = getFirestore(firebaseApp);
} catch (sdkError) {
  console.error('❌ Firestore Client SDK initialization failed:', sdkError);
  throw new Error('Failed to initialize Firestore Client SDK');
}

export { app, db };
