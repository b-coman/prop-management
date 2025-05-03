
// scripts/load-properties.ts
import * as dotenv from 'dotenv';
import * as path from 'path';
import * as admin from 'firebase-admin'; // Import Admin SDK
import fs from 'fs/promises'; // Use promises for async file reading

// Load environment variables from .env.local at the project root
// This needs to happen BEFORE initializing the Admin SDK if the service account path is in .env.local
dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

// Check for the service account path in environment variables
const serviceAccountPath = process.env.FIREBASE_ADMIN_SERVICE_ACCOUNT_PATH;
if (!serviceAccountPath) {
  console.error('❌ FIREBASE_ADMIN_SERVICE_ACCOUNT_PATH is not set in .env.local.');
  console.error('   Please generate a service account key in Firebase Console and set the path.');
  process.exit(1);
}

const serviceAccountFullPath = path.resolve(serviceAccountPath);

try {
  // Initialize Firebase Admin SDK - This only needs to happen once
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccountFullPath),
    // databaseURL: `https://${process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID}.firebaseio.com` // Optional: Needed for Realtime Database
    projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID // Use projectId from env
  });
  console.log('✅ Firebase Admin SDK initialized successfully.');
} catch (error) {
  console.error('❌ Firebase Admin SDK initialization failed:', error);
  console.error('   Check if the service account key path is correct and the file is valid.');
  process.exit(1);
}

// Get Firestore instance from the Admin SDK
const dbAdmin = admin.firestore();
const propertiesCollectionRef = dbAdmin.collection('properties');

/**
 * Converts Firestore-like timestamp objects ({ _seconds: ..., _nanoseconds: ... })
 * into actual Admin SDK Timestamp instances.
 *
 * @param data - The data structure (object or array) to process.
 * @returns The processed data structure with Timestamps converted.
 */
function convertObjectToAdminTimestamps(data: any): any {
  if (Array.isArray(data)) {
    return data.map(item => convertObjectToAdminTimestamps(item));
  } else if (typeof data === 'object' && data !== null) {
    if (typeof data._seconds === 'number' && typeof data._nanoseconds === 'number') {
      return admin.firestore.Timestamp.fromDate(new Date(data._seconds * 1000 + data._nanoseconds / 1000000));
    }
    const newData: { [key: string]: any } = {};
    for (const key in data) {
      if (Object.prototype.hasOwnProperty.call(data, key)) {
        newData[key] = convertObjectToAdminTimestamps(data[key]);
      }
    }
    return newData;
  } else {
    return data;
  }
}


async function loadPropertyData(filePath: string, docId: string) {
    console.log(`Processing ${filePath}...`);
    try {
        const fullPath = path.resolve(filePath);
        console.log(`Reading file from: ${fullPath}`);

        const fileContent = await fs.readFile(fullPath, 'utf-8');
        let jsonData;
        try {
            jsonData = JSON.parse(fileContent);
        } catch (parseError) {
            console.error(`❌ Error parsing JSON from ${filePath}:`, parseError);
            throw new Error(`Invalid JSON format in ${filePath}`);
        }

        // Convert timestamp objects using Admin SDK converter
        const dataWithTimestamps = convertObjectToAdminTimestamps(jsonData);

        // Get a reference to the document with the specific ID using Admin SDK
        const propertyDocRef = propertiesCollectionRef.doc(docId);

        // Set the document data in Firestore using Admin SDK
        await propertyDocRef.set(dataWithTimestamps);

        console.log(`✅ Successfully loaded data for property "${docId}" from ${filePath} into Firestore.`);

    } catch (error) {
        console.error(`❌ Failed to load data for property "${docId}" from ${filePath}:`, error);
        throw error; // Re-throw the error to stop the script
    }
}

async function main() {
    console.log('--- Starting Firestore Property Data Loading Script (using Admin SDK) ---');
    // Environment variables should be loaded by dotenv at the top
    if (!process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID) {
        console.error("❌ Environment variable NEXT_PUBLIC_FIREBASE_PROJECT_ID not loaded correctly. Ensure .env.local exists and is readable.");
        process.exit(1);
    } else {
        console.log(`✅ Environment variables loaded. Project ID: ${process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID}`);
    }

    try {
        const filePaths = [
            { filePath: 'firestore/prop1.json', docId: 'prop1' },
            { filePath: 'firestore/prop2.json', docId: 'prop2' },
        ];

        for (const { filePath, docId } of filePaths) {
            await loadPropertyData(filePath, docId);
        }

        console.log('--- Firestore Property Data Loading Script Finished Successfully ---');
    } catch (error) {
        console.error('--- Firestore Property Data Loading Script Failed ---');
        // Error details are logged within loadPropertyData
        process.exit(1); // Exit with error code
    }
}

// Execute the main function
main();
