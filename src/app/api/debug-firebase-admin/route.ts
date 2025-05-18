// src/app/api/debug-firebase-admin/route.ts
export const runtime = 'nodejs';

import * as admin from 'firebase-admin';
import * as fs from 'fs';
import * as path from 'path';
import { NextResponse } from 'next/server';

interface FirebaseServiceAccountFile {
  exists: boolean;
  valid?: boolean;
  error?: string;
  path?: string;
  fields?: any;
  projectId?: string;
}

/**
 * Check if a service account file exists and is valid
 */
function checkServiceAccountFile(): FirebaseServiceAccountFile {
  const serviceAccountPath = process.env.FIREBASE_ADMIN_SERVICE_ACCOUNT_PATH;
  
  if (!serviceAccountPath) {
    return {
      exists: false,
      error: 'No service account path provided in environment variables'
    };
  }
  
  const resolvedPath = path.isAbsolute(serviceAccountPath)
    ? serviceAccountPath
    : path.resolve(process.cwd(), serviceAccountPath);
    
  if (!fs.existsSync(resolvedPath)) {
    return {
      exists: false,
      error: `Service account file does not exist at path: ${resolvedPath}`,
      path: resolvedPath
    };
  }
  
  try {
    const content = fs.readFileSync(resolvedPath, 'utf8');
    const json = JSON.parse(content);
    
    // Check for required fields
    const hasProjectId = !!json.project_id;
    const hasPrivateKey = !!json.private_key;
    const hasClientEmail = !!json.client_email;
    
    if (!hasProjectId || !hasPrivateKey || !hasClientEmail) {
      return {
        exists: true,
        valid: false,
        error: 'Service account JSON missing required fields',
        path: resolvedPath,
        fields: {
          hasProjectId,
          hasPrivateKey,
          hasClientEmail
        }
      };
    }
    
    return {
      exists: true,
      valid: true,
      path: resolvedPath,
      projectId: json.project_id
    };
  } catch (error) {
    return {
      exists: true,
      valid: false,
      error: `Error parsing service account JSON: ${error}`,
      path: resolvedPath
    };
  }
}

/**
 * Test Firebase Admin initialization to see what errors might occur
 */
async function testFirebaseAdminInitialization() {
  const results = {
    serviceAccount: null as FirebaseServiceAccountFile | null,
    environment: {
      nodeVersion: process.version,
      osPlatform: process.platform,
      nextPublicProjectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || null,
      credentials: {
        googleApplicationCredentials: process.env.GOOGLE_APPLICATION_CREDENTIALS || null,
        firebaseAdminServiceAccountPath: process.env.FIREBASE_ADMIN_SERVICE_ACCOUNT_PATH || null
      }
    },
    adminTests: {
      baseInitialize: null as any,
      appWithOptions: null as any,
      appWithProjectId: null as any,
      appWithCredential: null as any,
      appWithDefaultCredential: null as any,
      firestore: null as any,
      firebaseAdminVersion: null as string | null
    }
  };
  
  // Check service account
  results.serviceAccount = checkServiceAccountFile();
  
  // Get Firebase Admin version
  try {
    // @ts-ignore
    results.adminTests.firebaseAdminVersion = admin.SDK_VERSION || 'unknown';
  } catch (e) {
    results.adminTests.firebaseAdminVersion = null;
  }
  
  // Test base initialization
  try {
    const testApp = admin.initializeApp(undefined, 'test-base-init');
    results.adminTests.baseInitialize = { success: true };
    
    try {
      await testApp.delete();
    } catch (e) {
      // Ignore error during cleanup
    }
  } catch (error) {
    results.adminTests.baseInitialize = { 
      success: false, 
      error: error instanceof Error ? error.message : String(error)
    };
  }
  
  // Test with options
  try {
    const testApp = admin.initializeApp({}, 'test-with-options');
    results.adminTests.appWithOptions = { success: true };
    
    try {
      await testApp.delete();
    } catch (e) {
      // Ignore error during cleanup
    }
  } catch (error) {
    results.adminTests.appWithOptions = { 
      success: false, 
      error: error instanceof Error ? error.message : String(error)
    };
  }
  
  // Test with project ID
  try {
    const projectId = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || 'rental-spot-builder';
    const testApp = admin.initializeApp({ projectId }, 'test-with-project-id');
    results.adminTests.appWithProjectId = { success: true };
    
    try {
      await testApp.delete();
    } catch (e) {
      // Ignore error during cleanup
    }
  } catch (error) {
    results.adminTests.appWithProjectId = { 
      success: false, 
      error: error instanceof Error ? error.message : String(error)
    };
  }
  
  // Test with credential
  if (results.serviceAccount && results.serviceAccount.exists && results.serviceAccount.valid) {
    try {
      const serviceAccountPath = results.serviceAccount.path as string;
      const serviceAccountContent = fs.readFileSync(serviceAccountPath, 'utf8');
      const serviceAccount = JSON.parse(serviceAccountContent);
      
      const credential = admin.credential.cert(serviceAccount);
      const testApp = admin.initializeApp({ credential }, 'test-with-credential');
      results.adminTests.appWithCredential = { success: true };
      
      try {
        await testApp.delete();
      } catch (e) {
        // Ignore error during cleanup
      }
    } catch (error) {
      results.adminTests.appWithCredential = { 
        success: false, 
        error: error instanceof Error ? error.message : String(error)
      };
    }
  } else {
    results.adminTests.appWithCredential = { 
      skipped: true, 
      reason: 'No valid service account available'
    };
  }
  
  // Test with default credential
  try {
    const testApp = admin.initializeApp({ credential: admin.credential.applicationDefault() }, 'test-with-default-credential');
    results.adminTests.appWithDefaultCredential = { success: true };
    
    try {
      await testApp.delete();
    } catch (e) {
      // Ignore error during cleanup
    }
  } catch (error) {
    results.adminTests.appWithDefaultCredential = { 
      success: false, 
      error: error instanceof Error ? error.message : String(error)
    };
  }
  
  // Test Firestore initialization
  try {
    const testApp = admin.initializeApp({ 
      projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || 'rental-spot-builder'
    }, 'test-firestore');
    
    try {
      const firestoreDb = testApp.firestore();
      results.adminTests.firestore = { success: true };
    } catch (error) {
      results.adminTests.firestore = { 
        success: false, 
        error: error instanceof Error ? error.message : String(error)
      };
    }
    
    try {
      await testApp.delete();
    } catch (e) {
      // Ignore error during cleanup
    }
  } catch (error) {
    results.adminTests.firestore = { 
      success: false, 
      error: error instanceof Error ? error.message : String(error)
    };
  }
  
  return results;
}

/**
 * API route for debugging Firebase Admin SDK
 */
export async function GET() {
  try {
    const results = await testFirebaseAdminInitialization();
    
    return NextResponse.json({
      success: true,
      timestamp: new Date().toISOString(),
      ...results
    });
  } catch (error) {
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : String(error)
    }, { status: 500 });
  }
}