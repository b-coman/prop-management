
// scripts/load-properties.ts
import * as dotenv from 'dotenv';
import * as path from 'path';
import * as admin from 'firebase-admin'; // Keep for Timestamp type if needed, but dbAdmin handles init
import fs from 'fs/promises';
import { dbAdmin } from '@/lib/firebaseAdmin'; // **** Import Admin SDK instance ****

// Load environment variables from .env.local at the project root
dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

// dbAdmin is now initialized in firebaseAdmin.ts

/**
 * Converts nested objects that look like Firestore Timestamps
 * (having _seconds and _nanoseconds) into actual Firestore Admin Timestamps.
 *
 * @param data - The data structure (object or array) to process.
 * @returns The processed data structure with Timestamps converted.
 */
function convertObjectToAdminTimestamps(data: any): any {
  if (Array.isArray(data)) {
    return data.map(item => convertObjectToAdminTimestamps(item));
  } else if (typeof data === 'object' && data !== null) {
    // Check if it looks like a Firestore Timestamp object from JSON
    if (typeof data._seconds === 'number' && typeof data._nanoseconds === 'number') {
      // Use Admin SDK Timestamp constructor
      return new admin.firestore.Timestamp(data._seconds, data._nanoseconds);
    }
    // Recursively process nested objects
    const newData: { [key: string]: any } = {};
    for (const key in data) {
      if (Object.prototype.hasOwnProperty.call(data, key)) {
        newData[key] = convertObjectToAdminTimestamps(data[key]);
      }
    }
    return newData;
  } else {
    // Return non-object/array values as is
    return data;
  }
}


async function loadPropertyData(filePath: string, docId: string) {
    console.log(`Processing ${filePath}...`);
    try {
        if (!dbAdmin) {
            throw new Error("Firebase Admin SDK is not initialized. Check firebaseAdmin.ts and .env.local setup.");
        }
        const propertiesCollectionRef = dbAdmin.collection('properties'); // Use Admin SDK dbAdmin

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
    // Environment variables are loaded by dotenv at the top
    if (!process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID) {
        console.error("❌ Environment variable NEXT_PUBLIC_FIREBASE_PROJECT_ID not loaded correctly. Ensure .env.local exists and is readable.");
        // process.exit(1); // Don't exit if Admin SDK already initialized
    } else {
        console.log(`✅ Environment variables loaded. Project ID: ${process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID}`);
    }

    // Check if Admin SDK initialized correctly
    if (!dbAdmin) {
        console.error("❌ Firebase Admin SDK Firestore instance not available. Exiting script.");
        process.exit(1);
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
