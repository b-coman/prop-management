// src/app/api/debug-firebase-minimal/route.ts
export const runtime = 'nodejs';

import { NextResponse } from 'next/server';
import * as admin from 'firebase-admin';
import * as fs from 'fs';
import * as path from 'path';

/**
 * A minimal debug endpoint that tests different firebase-admin initialization methods
 */
export async function GET() {
  const results = {
    serviceAccount: null as any,
    tests: [] as any[]
  };

  // Step 1: Check service account file
  const serviceAccountPath = process.env.FIREBASE_ADMIN_SERVICE_ACCOUNT_PATH;
  if (serviceAccountPath) {
    try {
      const resolvedPath = path.isAbsolute(serviceAccountPath)
        ? serviceAccountPath
        : path.resolve(process.cwd(), serviceAccountPath);
        
      if (fs.existsSync(resolvedPath)) {
        const content = fs.readFileSync(resolvedPath, 'utf8');
        try {
          const serviceAccount = JSON.parse(content);
          results.serviceAccount = {
            exists: true,
            valid: true,
            projectId: serviceAccount.project_id,
            clientEmail: serviceAccount.client_email
          };
        } catch (error) {
          results.serviceAccount = {
            exists: true,
            valid: false,
            error: 'Error parsing service account JSON'
          };
        }
      } else {
        results.serviceAccount = {
          exists: false,
          error: 'Service account file not found'
        };
      }
    } catch (error) {
      results.serviceAccount = {
        error: `Error accessing service account: ${error}`
      };
    }
  }

  // Helper function to clean up Firebase apps
  async function cleanupFirebaseApps() {
    try {
      for (const app of admin.apps) {
        if (app) await app.delete();
      }
    } catch (e) {
      // Ignore errors
    }
  }

  // Test 1: Try initializing with just projectId
  await cleanupFirebaseApps();
  try {
    const projectId = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || 'rentalspot-fzwom';
    results.tests.push({ 
      name: 'Initialize with projectId',
      started: true
    });
    
    const app1 = admin.initializeApp({
      projectId
    }, 'test-project-id');
    
    results.tests[0].success = true;
    
    try {
      const firestore = app1.firestore();
      results.tests[0].firestoreSuccess = true;
    } catch (firestoreError) {
      results.tests[0].firestoreSuccess = false;
      results.tests[0].firestoreError = `${firestoreError}`;
    }
    
    await app1.delete();
  } catch (error) {
    results.tests[0].success = false;
    results.tests[0].error = `${error}`;
  }
  
  // Test 2: Try initializing with service account
  await cleanupFirebaseApps();
  try {
    results.tests.push({ 
      name: 'Initialize with service account',
      started: true
    });
    
    if (results.serviceAccount?.exists && results.serviceAccount?.valid) {
      const serviceAccountContent = fs.readFileSync(serviceAccountPath!, 'utf8');
      const serviceAccount = JSON.parse(serviceAccountContent);
      
      const app2 = admin.initializeApp({
        credential: admin.credential.cert(serviceAccount)
      }, 'test-service-account');
      
      results.tests[1].success = true;
      
      try {
        const firestore = app2.firestore();
        results.tests[1].firestoreSuccess = true;
      } catch (firestoreError) {
        results.tests[1].firestoreSuccess = false;
        results.tests[1].firestoreError = `${firestoreError}`;
      }
      
      await app2.delete();
    } else {
      results.tests[1].success = false;
      results.tests[1].error = 'Service account not available';
    }
  } catch (error) {
    results.tests[1].success = false;
    results.tests[1].error = `${error}`;
  }
  
  // Test 3: Try initializing with default config
  await cleanupFirebaseApps();
  try {
    results.tests.push({ 
      name: 'Initialize with default config',
      started: true
    });
    
    const app3 = admin.initializeApp(undefined, 'test-default');
    
    results.tests[2].success = true;
    
    try {
      const firestore = app3.firestore();
      results.tests[2].firestoreSuccess = true;
    } catch (firestoreError) {
      results.tests[2].firestoreSuccess = false;
      results.tests[2].firestoreError = `${firestoreError}`;
    }
    
    await app3.delete();
  } catch (error) {
    results.tests[2].success = false;
    results.tests[2].error = `${error}`;
  }
  
  // Final cleanup
  await cleanupFirebaseApps();
  
  return NextResponse.json(results);
}