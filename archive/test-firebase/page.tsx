/**
 * @fileoverview Test page for Firebase client initialization
 * @module app/test-firebase
 */

'use client';

import { useEffect, useState } from 'react';
import { app, auth, db } from '@/lib/firebase';

export default function TestFirebasePage() {
  const [status, setStatus] = useState<{
    app: boolean;
    auth: boolean;
    db: boolean;
    config: any;
  }>({
    app: false,
    auth: false,
    db: false,
    config: {}
  });

  useEffect(() => {
    // Check Firebase initialization status
    setStatus({
      app: !!app,
      auth: !!auth,
      db: !!db,
      config: {
        apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY ? 'Set' : 'MISSING',
        authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN || 'MISSING',
        projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || 'MISSING',
        storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET || 'MISSING',
        messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID || 'MISSING',
        appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID ? 'Set' : 'MISSING'
      }
    });
  }, []);

  return (
    <div className="p-8">
      <h1 className="text-2xl font-bold mb-4">Firebase Client Initialization Test</h1>
      
      <div className="space-y-4">
        <div className="p-4 border rounded">
          <h2 className="font-semibold mb-2">Initialization Status:</h2>
          <ul className="space-y-1">
            <li>Firebase App: {status.app ? '✅ Initialized' : '❌ Not initialized'}</li>
            <li>Firebase Auth: {status.auth ? '✅ Initialized' : '❌ Not initialized'}</li>
            <li>Firestore: {status.db ? '✅ Initialized' : '❌ Not initialized'}</li>
          </ul>
        </div>

        <div className="p-4 border rounded">
          <h2 className="font-semibold mb-2">Environment Variables:</h2>
          <ul className="space-y-1 font-mono text-sm">
            <li>API Key: {status.config.apiKey}</li>
            <li>Auth Domain: {status.config.authDomain}</li>
            <li>Project ID: {status.config.projectId}</li>
            <li>Storage Bucket: {status.config.storageBucket}</li>
            <li>Messaging Sender ID: {status.config.messagingSenderId}</li>
            <li>App ID: {status.config.appId}</li>
          </ul>
        </div>

        <div className="p-4 border rounded bg-yellow-50">
          <h2 className="font-semibold mb-2">Troubleshooting:</h2>
          <p>If you see "MISSING" values above:</p>
          <ol className="list-decimal ml-6 mt-2">
            <li>Check that .env.local exists in the project root</li>
            <li>Verify all NEXT_PUBLIC_FIREBASE_* variables are set</li>
            <li>Restart the development server after changing .env.local</li>
            <li>Clear browser cache and hard refresh</li>
          </ol>
        </div>
      </div>
    </div>
  );
}