/**
 * Debug authentication loading issue
 * This can be run in the browser console to debug the auth state
 */

console.log('🔍 Debugging Auth Loading Issue');

// Check if Firebase is available
if (typeof window !== 'undefined') {
  console.log('Window object available');
  
  // Check if Firebase modules are loaded
  console.log('Firebase modules check:');
  console.log('- auth function available:', typeof window.auth);
  
  // Check auth state directly
  if (window.auth) {
    console.log('Auth object exists, checking current user...');
    console.log('Current user:', window.auth.currentUser);
    
    // Add a listener to see if onAuthStateChanged fires
    console.log('Adding auth state listener...');
    window.auth.onAuthStateChanged((user) => {
      console.log('🔥 onAuthStateChanged fired!', user ? user.uid : 'null');
    });
    
    console.log('Auth state listener added. Waiting for events...');
  } else {
    console.log('❌ Auth object not available');
  }
} else {
  console.log('❌ Window object not available (server-side)');
}

// Instructions
console.log(`
📋 To debug:
1. Open browser dev tools
2. Go to http://localhost:9002/login
3. Paste this entire script in the console
4. Watch for onAuthStateChanged events
5. If no events fire, there's an initialization issue
`);

// Export to window for access
if (typeof window !== 'undefined') {
  window.debugAuth = () => {
    console.log('Auth debug info:');
    console.log('- Auth object:', window.auth);
    console.log('- Current user:', window.auth?.currentUser);
    console.log('- App instance:', window.auth?.app);
  };
  
  console.log('Added window.debugAuth() function for manual debugging');
}