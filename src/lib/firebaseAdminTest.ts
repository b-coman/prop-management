// Test file to disable problematic environment variables
const originalEnv = { ...process.env };

// Temporarily disable problematic environment variables
delete process.env.FIREBASE_SERVICE_ACCOUNT;
delete process.env.FIREBASE_ADMIN_SERVICE_ACCOUNT_PATH;

console.log('[FIREBASE ADMIN TEST] Disabled environment variables:', {
  FIREBASE_SERVICE_ACCOUNT: 'DISABLED',
  FIREBASE_ADMIN_SERVICE_ACCOUNT_PATH: 'DISABLED',
  STRIPE_WEBHOOK_SECRET: process.env.STRIPE_WEBHOOK_SECRET ? 'present' : 'missing'
});

// Restore after a delay to avoid affecting other parts
setTimeout(() => {
  process.env = originalEnv;
}, 1000);

export const testComplete = true;