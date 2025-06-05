// src/app/api/debug-admin-firebase/route.ts
export const runtime = 'nodejs';

import { NextResponse } from 'next/server';
import * as admin from 'firebase-admin';
import * as fs from 'fs';
import * as path from 'path';

export async function GET() {
  const diagnostic = {
    environment: {
      nodeVersion: process.version,
      osPlatform: process.platform,
      nextPublicProjectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
      firebaseAdminServiceAccountPath: process.env.FIREBASE_ADMIN_SERVICE_ACCOUNT_PATH || null
    },
    serviceAccountFile: null as any,
    firebaseAdmin: {
      initialized: admin.apps.length > 0,
      appsCount: admin.apps.length,
      firebaseAdminSdkVersion: admin.SDK_VERSION
    }
  };

  // Check service account file
  const serviceAccountPath = process.env.FIREBASE_ADMIN_SERVICE_ACCOUNT_PATH;
  if (serviceAccountPath) {
    try {
      // Normalize path
      const resolvedPath = path.isAbsolute(serviceAccountPath)
        ? serviceAccountPath
        : path.resolve(process.cwd(), serviceAccountPath);
        
      // Check if file exists
      if (fs.existsSync(resolvedPath)) {
        const content = fs.readFileSync(resolvedPath, 'utf8');
        try {
          // Parse to JSON to validate format
          const serviceAccount = JSON.parse(content);
          
          // Check required fields
          const requiredFields = ['project_id', 'private_key', 'client_email'];
          const missingFields = requiredFields.filter(field => !serviceAccount[field]);
          
          diagnostic.serviceAccountFile = {
            exists: true,
            path: resolvedPath,
            valid: missingFields.length === 0,
            missingFields: missingFields.length > 0 ? missingFields : null,
            projectId: serviceAccount.project_id,
            clientEmail: serviceAccount.client_email ? 
              `${serviceAccount.client_email.split('@')[0].substring(0, 3)}...@${serviceAccount.client_email.split('@')[1]}` : 
              null
          };
        } catch (jsonError) {
          diagnostic.serviceAccountFile = {
            exists: true,
            path: resolvedPath,
            valid: false,
            error: 'Invalid JSON format in service account file'
          };
        }
      } else {
        diagnostic.serviceAccountFile = {
          exists: false,
          path: resolvedPath,
          error: 'Service account file not found'
        };
      }
    } catch (error) {
      diagnostic.serviceAccountFile = {
        exists: false,
        error: `Error accessing service account file: ${error}`
      };
    }
  } else {
    diagnostic.serviceAccountFile = {
      exists: false,
      error: 'No service account path provided in environment variables'
    };
  }

  // Check direct imports
  try {
    // Import directly instead of dynamically
    const firebaseAdminNew = await import('../../../lib/firebaseAdminNew');
    diagnostic.imports = {
      firebaseAdminNew: {
        imported: true,
        hasDbAdmin: 'dbAdmin' in firebaseAdminNew,
        hasIsFirestoreAdminAvailable: 'isFirestoreAdminAvailable' in firebaseAdminNew,
        firebaseAvailable: firebaseAdminNew.isFirestoreAdminAvailable ?
          await firebaseAdminNew.isFirestoreAdminAvailable() : false
      }
    };
  } catch (error) {
    diagnostic.imports = {
      firebaseAdminNew: {
        imported: false,
        error: `Failed to import: ${error instanceof Error ? error.message : String(error)}`
      }
    };
  }

  return NextResponse.json(diagnostic);
}