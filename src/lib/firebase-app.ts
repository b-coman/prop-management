// src/lib/firebase-app.ts
//
// The shared client-SDK app instance, and nothing else.
//
// This exists so that importing Firestore does not also drag in Auth and vice
// versa. The previous single module called getFirestore() AND getAuth() at
// import time, so every guest page that touched either one shipped both SDKs
// (about 438 KB raw / 130 KB gzip) and fired an identitytoolkit + securetoken
// round trip on a page with no login. Keep this file free of getFirestore /
// getAuth calls.
import { initializeApp, getApps, getApp, FirebaseApp } from 'firebase/app';

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
};

let app: FirebaseApp | undefined;

if (getApps().length === 0) {
  if (!firebaseConfig.apiKey || !firebaseConfig.projectId) {
    console.error(
      '❌ Client Firebase Config Missing: NEXT_PUBLIC_FIREBASE_API_KEY or NEXT_PUBLIC_FIREBASE_PROJECT_ID is missing. Client SDK cannot initialize.'
    );
  } else {
    try {
      app = initializeApp(firebaseConfig);
    } catch (initError) {
      console.error('❌ Firebase Client SDK initialization failed:', initError);
    }
  }
} else {
  app = getApp();
}

if (!app) {
  throw new Error('Firebase app is not initialized. Check your environment variables.');
}

export const firebaseApp: FirebaseApp = app;
export { app };
