// src/lib/firebase.ts
import { initializeApp, getApps, getApp } from 'firebase/app';
import { getFirestore } from 'firebase/firestore';
// import { getAuth } from "firebase/auth"; // Add if using Firebase Auth
// import { getStorage } from "firebase/storage"; // Add if using Firebase Storage

// Your web app's Firebase configuration
// IMPORTANT: Replace with your actual Firebase config values
// Consider using environment variables for sensitive information
const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
  // measurementId: process.env.NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID // Optional: for Analytics
};

// Initialize Firebase
const app = !getApps().length ? initializeApp(firebaseConfig) : getApp();
const db = getFirestore(app);
// const auth = getAuth(app); // Initialize Auth if needed
// const storage = getStorage(app); // Initialize Storage if needed

export { app, db /*, auth, storage */ };

// Helper function to log missing environment variables during development
function checkEnvVars() {
    const requiredVars = [
        'NEXT_PUBLIC_FIREBASE_API_KEY',
        'NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN',
        'NEXT_PUBLIC_FIREBASE_PROJECT_ID',
        'NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET',
        'NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID',
        'NEXT_PUBLIC_FIREBASE_APP_ID',
    ];
    const missingVars = requiredVars.filter(v => !process.env[v]);
    if (missingVars.length > 0 && process.env.NODE_ENV !== 'production') {
        console.warn(`🔥 Firebase Warning: Missing environment variables: ${missingVars.join(', ')}. Firebase might not initialize correctly.`);
        console.warn("Ensure these are set in your .env.local file.");
    }
}

checkEnvVars();
