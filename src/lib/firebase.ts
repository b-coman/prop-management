// src/lib/firebase.ts
import { initializeApp, getApps, getApp } from 'firebase/app';
import { getFirestore } from 'firebase/firestore';
// import { getAuth } from "firebase/auth"; // Add if using Firebase Auth
// import { getStorage } from "firebase/storage"; // Add if using Firebase Storage

// Your web app's Firebase configuration
// Loaded from environment variables defined in .env.local
const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
  // measurementId: process.env.NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID // Optional: for Analytics
};

// Helper function to log missing environment variables during development
function checkEnvVars() {
    // Variables required for basic Firestore initialization, crucial for load-properties script
    const criticalVars = [
        'NEXT_PUBLIC_FIREBASE_API_KEY',
        'NEXT_PUBLIC_FIREBASE_PROJECT_ID',
    ];
    // Other variables often needed for full app functionality
    const recommendedVars = [
        'NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN',
        'NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET',
        'NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID',
        'NEXT_PUBLIC_FIREBASE_APP_ID',
    ];

    const missingCritical = criticalVars.filter(v => !process.env[v]);
    const missingRecommended = recommendedVars.filter(v => !process.env[v]);
    const allMissing = [...missingCritical, ...missingRecommended];

    if (allMissing.length > 0 && process.env.NODE_ENV !== 'production') {
        console.warn(`🔥 Firebase Warning: Missing Firebase environment variables: ${allMissing.join(', ')}. Firebase might not initialize correctly.`);
        console.warn("Ensure these are set in your .env.local file using the values from your Firebase project settings.");

        // Throw an error only if critical vars are missing, allowing scripts needing only Firestore to potentially run.
        if (missingCritical.length > 0) {
             console.error("❌ Critical Firebase configuration missing:", missingCritical.join(', '));
             throw new Error(`Missing critical Firebase configuration (${missingCritical.join(', ')}). Check .env.local`);
        }
    }
}

checkEnvVars(); // Check variables before initializing

// Initialize Firebase
// Use getApps() to ensure initialization only happens once
let app;
if (getApps().length === 0) {
    // Check if config is valid before initializing
    if (!firebaseConfig.apiKey || !firebaseConfig.projectId) {
        // This check might be redundant due to checkEnvVars, but serves as a final safeguard
        console.error("❌ Attempted to initialize Firebase without critical apiKey or projectId.");
        // Avoid throwing here to potentially allow inspection of the state, rely on checkEnvVars for throwing.
        // We'll let getFirestore fail later if config is truly broken.
    } else {
        try {
             app = initializeApp(firebaseConfig);
             console.log("✅ Firebase initialized successfully.");
        } catch (initError) {
            console.error("❌ Firebase initialization failed:", initError);
            // Handle or re-throw the initialization error appropriately
             throw initError;
        }
    }
} else {
    app = getApp();
    // console.log("ℹ️ Firebase app already initialized.");
}

// Initialize Firestore only if the app was successfully initialized or retrieved
let db;
if (app) {
    try {
        db = getFirestore(app);
        // console.log("✅ Firestore initialized successfully.");
    } catch (firestoreError) {
         console.error("❌ Firestore initialization failed:", firestoreError);
         // Handle or re-throw the Firestore initialization error
         // Note: db will be undefined if this fails
    }
} else {
     console.error("❌ Cannot initialize Firestore because Firebase app is not available.");
}

// const auth = getAuth(app); // Initialize Auth if needed
// const storage = getStorage(app); // Initialize Storage if needed

export { app, db /*, auth, storage */ };
