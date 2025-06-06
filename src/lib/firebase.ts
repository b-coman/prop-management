// src/lib/firebase.ts
import { initializeApp, getApps, getApp, FirebaseApp } from 'firebase/app';
import { getFirestore, Firestore } from 'firebase/firestore';
import { getAuth, Auth } from "firebase/auth"; // Added for Firebase Auth

// Load environment variables from .env.local at the project root
// This is automatically handled by Next.js in the app runtime.
// Scripts like load-properties.ts need to load .env.local explicitly.

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
};

console.log("[Firebase Client] Initializing with config:", {
  apiKey: firebaseConfig.apiKey ? "***" + firebaseConfig.apiKey.slice(-4) : "MISSING",
  authDomain: firebaseConfig.authDomain || "MISSING",
  projectId: firebaseConfig.projectId || "MISSING",
  storageBucket: firebaseConfig.storageBucket || "MISSING",
  messagingSenderId: firebaseConfig.messagingSenderId || "MISSING",
  appId: firebaseConfig.appId ? "***" + firebaseConfig.appId.slice(-4) : "MISSING"
});

// Initialize Firebase Client SDK
let app: FirebaseApp | undefined;
if (getApps().length === 0) {
  if (!firebaseConfig.apiKey || !firebaseConfig.projectId) {
    console.error(
      "❌ Client Firebase Config Missing: NEXT_PUBLIC_FIREBASE_API_KEY or NEXT_PUBLIC_FIREBASE_PROJECT_ID is missing. Client SDK cannot initialize."
    );
    // Potentially throw an error or handle this case as critical
  } else {
    try {
      app = initializeApp(firebaseConfig);
      // console.log("✅ Firebase Client SDK initialized successfully.");
    } catch (initError) {
      console.error("❌ Firebase Client SDK initialization failed:", initError);
    }
  }
} else {
  app = getApp();
  // console.log("ℹ️ Firebase Client SDK app already initialized.");
}

// Properly type the Firestore database
let db: Firestore | undefined;
let auth: Auth | undefined; // Declare auth with type

if (app) {
  try {
    db = getFirestore(app);
    auth = getAuth(app); // Initialize auth
    // console.log("✅ Firestore and Auth Client SDKs initialized successfully.");
  } catch (sdkError) {
    console.error("❌ Firestore or Auth Client SDK initialization failed:", sdkError);
  }
} else {
  console.error("❌ Cannot initialize Firestore/Auth Client SDKs because Firebase app is not available.");
}

export { app, db, auth }; // Export auth
