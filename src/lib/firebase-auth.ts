// src/lib/firebase-auth.ts
//
// Client-SDK Auth, split out from `./firebase` so guest pages never load it.
// Only the admin console and /login need this; importing it anywhere that
// renders for guests puts the Auth SDK back on the critical path.
import { getAuth, Auth } from 'firebase/auth';
import { firebaseApp } from './firebase-app';

let auth: Auth;

try {
  auth = getAuth(firebaseApp);
} catch (sdkError) {
  console.error('❌ Firebase Auth Client SDK initialization failed:', sdkError);
  throw new Error('Failed to initialize Firebase Auth Client SDK');
}

export { auth };
