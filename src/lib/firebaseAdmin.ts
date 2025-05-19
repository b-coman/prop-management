// src/lib/firebaseAdmin.ts
// Edge-compatible implementation with lazy initialization

import { initializeFirebaseAdminSafe, getFirestoreSafe, getAuthSafe } from './firebaseAdminSafe';

// Legacy interface compatibility
export const getDbAdmin = getFirestoreSafe;
export const getAuthAdmin = getAuthSafe;

// Initialize on first use
export const initializeFirebaseAdmin = initializeFirebaseAdminSafe;