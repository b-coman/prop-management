import { NextResponse } from 'next/server';

export async function GET() {
  return NextResponse.json({
    server: {
      NODE_ENV: process.env.NODE_ENV,
      hasServiceAccount: !!process.env.FIREBASE_SERVICE_ACCOUNT,
      hasAdminPath: !!process.env.FIREBASE_ADMIN_SERVICE_ACCOUNT_PATH,
    },
    client: {
      apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY ? 'Set' : 'Not set',
      authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN || 'Not set',
      projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || 'Not set',
      storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET || 'Not set',
      messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID || 'Not set',
      appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID ? 'Set' : 'Not set',
    }
  });
}