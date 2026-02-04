// src/lib/firebaseAdmin.ts
// Re-exports from firebaseAdminSafe for backward compatibility
// Prefer using firebaseAdminSafe or firebaseAdminPricing directly

export {
  initializeFirebaseAdminSafe as initializeFirebaseAdmin,
  getFirestoreSafe as getDbAdmin,
  getAuthSafe as getAuthAdmin,
} from './firebaseAdminSafe';
