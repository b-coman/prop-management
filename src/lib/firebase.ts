
// src/lib/firebase.ts
import { initializeApp, getApps, getApp } from 'firebase/app';
import { getFirestore } from 'firebase/firestore';
// Remove dotenv import - let scripts handle their own env loading if needed outside Next.js context
// import * as dotenv from 'dotenv';
// import * as path from 'path';
// import { getAuth } from "firebase/auth"; // Add if using Firebase Auth
// import { getStorage } from "firebase/storage"; // Add if using Firebase Storage

// Load environment variables from .env.local at the project root
// dotenv.config({ path: path.resolve(process.cwd(), '.env.local') }); // No longer needed here, Next.js handles it

// Your web app's Firebase configuration
// Loaded from environment variables automatically by Next.js
const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
  // measurementId: process.env.NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID // Optional: for Analytics
};

// Remove the checkEnvVars function, as Next.js handles env loading for the app runtime.
// The script now uses Admin SDK and verifies its own specific requirements.
/*
function checkEnvVars() {
    // ... (removed) ...
}
checkEnvVars();
*/

// Initialize Firebase Client SDK
// Use getApps() to ensure initialization only happens once within the Next.js app runtime
let app;
if (getApps().length === 0) {
    // Check if critical client config vars are present before initializing client SDK
    if (!firebaseConfig.apiKey || !firebaseConfig.projectId) {
        console.error("❌ Client Firebase Config Missing: NEXT_PUBLIC_FIREBASE_API_KEY or NEXT_PUBLIC_FIREBASE_PROJECT_ID is missing in environment variables. Client SDK cannot initialize.");
        // Throwing here might break the app build/runtime if env vars aren't set during build phase
        // Consider logging the error and letting parts of the app fail gracefully if Firebase is needed client-side
        // throw new Error("Missing critical client Firebase configuration. Check environment variables.");
    } else {
        try {
             app = initializeApp(firebaseConfig);
             // console.log("✅ Firebase Client SDK initialized successfully."); // Less verbose logging
        } catch (initError) {
            console.error("❌ Firebase Client SDK initialization failed:", initError);
            // Handle or re-throw the initialization error appropriately
            // throw initError; // Depending on whether the app can function without Firebase client
        }
    }
} else {
    app = getApp();
    // console.log("ℹ️ Firebase Client SDK app already initialized.");
}

// Initialize Firestore Client SDK only if the app was successfully initialized or retrieved
let db;
if (app) {
    try {
        db = getFirestore(app);
        // console.log("✅ Firestore Client SDK initialized successfully.");
    } catch (firestoreError) {
         console.error("❌ Firestore Client SDK initialization failed:", firestoreError);
         // Handle or re-throw the Firestore initialization error
    }
} else {
     console.error("❌ Cannot initialize Firestore Client SDK because Firebase app is not available.");
}

// const auth = getAuth(app); // Initialize Auth if needed
// const storage = getStorage(app); // Initialize Storage if needed

// Export only the client SDK instances needed by the application runtime
export { app, db /*, auth, storage */ };
