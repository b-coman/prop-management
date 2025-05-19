// Test endpoint to check environment variables
import { NextResponse } from 'next/server';

export async function GET() {
  const envCheck = {
    timestamp: new Date().toISOString(),
    problematicVars: {
      FIREBASE_SERVICE_ACCOUNT: process.env.FIREBASE_SERVICE_ACCOUNT ? 'SET' : 'NOT_SET',
      FIREBASE_ADMIN_SERVICE_ACCOUNT_PATH: process.env.FIREBASE_ADMIN_SERVICE_ACCOUNT_PATH ? 'SET' : 'NOT_SET',
    },
    workingVars: {
      STRIPE_SECRET_KEY: process.env.STRIPE_SECRET_KEY ? 'SET' : 'NOT_SET',
      NEXT_PUBLIC_FIREBASE_PROJECT_ID: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || 'NOT_SET',
    },
    test: 'This endpoint is accessible'
  };
  
  return NextResponse.json(envCheck);
}