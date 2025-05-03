
// scripts/load-properties.ts
import * as dotenv from 'dotenv';
import * as path from 'path';
import * as fs from 'fs/promises'; // Use Node's promise-based fs
import { collection, doc, setDoc, Timestamp as ClientTimestamp } from 'firebase/firestore'; // **** Import Client SDK ****
import { db } from '@/lib/firebase'; // **** Import Client SDK instance ****

// Load environment variables from .env.local at the project root
dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

/**
 * Converts nested objects that look like Firestore Timestamps
 * (having _seconds and _nanoseconds) into actual Firestore Client SDK Timestamps.
 *
 * @param data - The data structure (object or array) to process.
 * @returns The processed data structure with Timestamps converted.
 */
function convertObjectToClientTimestamps(data: any): any {
  if (Array.isArray(data)) {
    return data.map(item => convertObjectToClientTimestamps(item));
  } else if (typeof data === 'object' && data !== null) {
    // Check if it looks like a Firestore Timestamp object from JSON
    if (typeof data._seconds === 'number' && typeof data._nanoseconds === 'number') {
      // Use Client SDK Timestamp constructor
      return new ClientTimestamp(data._seconds, data._nanoseconds);
    }
    // Recursively process nested objects
    const newData: { [key: string]: any } = {};
    for (const key in data) {
      if (Object.prototype.hasOwnProperty.call(data, key)) {
        newData[key] = convertObjectToClientTimestamps(data[key]);
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
        if (!db) {
            throw new Error("Firebase Client SDK (db) is not initialized. Check firebase.ts and .env.local setup.");
        }
        const propertiesCollectionRef = collection(db, 'properties'); // Use Client SDK db

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

        // Convert timestamp objects using Client SDK converter
        const dataWithTimestamps = convertObjectToClientTimestamps(jsonData);

        // Get a reference to the document with the specific ID using Client SDK
        const propertyDocRef = doc(propertiesCollectionRef, docId);

        // Set the document data in Firestore using Client SDK
        await setDoc(propertyDocRef, dataWithTimestamps);

        console.log(`✅ Successfully loaded data for property "${docId}" from ${filePath} into Firestore (using Client SDK).`);

    } catch (error) {
        console.error(`❌ Failed to load data for property "${docId}" from ${filePath}:`, error);
        throw error; // Re-throw the error to stop the script
    }
}

async function main() {
    console.log('--- Starting Firestore Property Data Loading Script (using Client SDK) ---');
    // Environment variables are loaded by dotenv at the top
    if (!process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID) {
        console.warn("⚠️ Environment variable NEXT_PUBLIC_FIREBASE_PROJECT_ID not loaded correctly. Ensure .env.local exists and is readable.");
        // Don't exit if Client SDK might initialize later
    } else {
        console.log(`✅ Environment variables loaded. Project ID: ${process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID}`);
    }

    // Check if Client SDK initialized correctly
    if (!db) {
        console.error("❌ Firebase Client SDK Firestore instance (db) not available. Exiting script.");
        process.exit(1);
    } else {
        console.log("✅ Firebase Client SDK Firestore instance (db) is available.");
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
