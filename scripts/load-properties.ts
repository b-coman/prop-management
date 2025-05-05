// scripts/load-firestore-data.ts
import * as dotenv from 'dotenv';
import * as path from 'path';
import * as fs from 'fs/promises';
import * as admin from 'firebase-admin';

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

const requiredEnvVars = ['NEXT_PUBLIC_FIREBASE_PROJECT_ID', 'NEXT_FIREBASE_CLIENT_EMAIL']; // Removed service account path requirement for this script
for (const envVar of requiredEnvVars) {
    if (!process.env[envVar]) {
        console.warn(`⚠️ Missing environment variable for script: ${envVar}. Using application default credentials.`);
        // Don't throw, try to proceed with default creds if available
    }
}

// Initialize Firebase Admin SDK using Application Default Credentials
// This is often simpler for scripts run in trusted environments (like CI/CD or locally authenticated gcloud)
try {
    if (!admin.apps.length) {
        console.log('🔑 Initializing Firebase Admin SDK using Application Default Credentials...');
        admin.initializeApp({
             // If running locally and ADC isn't configured, it might fallback or require explicit setup
             // projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID, // Optionally specify project ID
        });
        console.log('✅ Firebase Admin SDK initialized successfully with ADC.');
    } else {
        console.log('ℹ️ Firebase Admin SDK app already initialized.');
    }
} catch(error) {
     console.error('❌ Firebase Admin SDK initialization failed with ADC:', error);
     console.error('   Ensure Application Default Credentials are set up correctly (e.g., `gcloud auth application-default login`).');
     process.exit(1); // Exit if admin SDK cannot initialize
}


const db = admin.firestore();

async function loadJsonIntoFirestore(collectionName: string, docId: string, filePath: string) {
    console.log(`Processing [${collectionName}/${docId}] from ${filePath}...`);
    try {
        const fullPath = path.resolve(filePath);
        const fileContent = await fs.readFile(fullPath, 'utf-8');
        const jsonData = JSON.parse(fileContent);

        // Convert Firestore-like timestamp objects to actual Timestamps
        // This helper needs to recursively traverse the object
        const convertTimestamps = (data: any): any => {
            if (data === null || typeof data !== 'object') {
                return data;
            }

             if (data._seconds !== undefined && data._nanoseconds !== undefined) {
                 // Check if it looks like a Firestore Timestamp object
                  try {
                      return new admin.firestore.Timestamp(data._seconds, data._nanoseconds);
                  } catch (e) {
                       console.warn(`Could not convert object to Timestamp: ${JSON.stringify(data)}`, e);
                       return data; // Return original if conversion fails
                  }

             }


            if (Array.isArray(data)) {
                return data.map(convertTimestamps);
            }

            const convertedData: { [key: string]: any } = {};
            for (const key in data) {
                if (Object.prototype.hasOwnProperty.call(data, key)) {
                    convertedData[key] = convertTimestamps(data[key]);
                }
            }
            return convertedData;
        };

        const dataWithTimestamps = convertTimestamps(jsonData);


        const docRef = db.collection(collectionName).doc(docId);
        await docRef.set(dataWithTimestamps); // Use set to overwrite existing or create new
        console.log(`✅ Loaded document: ${collectionName}/${docId}`);
    } catch (error) {
        console.error(`❌ Failed loading ${collectionName}/${docId} from ${filePath}:`, error);
        throw error; // Re-throw error to stop the script
    }
}

async function processDirectory(directoryPath: string) {
    try {
        const entries = await fs.readdir(directoryPath, { withFileTypes: true });
        for (const entry of entries) {
            const entryPath = path.join(directoryPath, entry.name);
            if (entry.isDirectory() && entry.name !== '_oldFiles') { // Ignore _oldFiles directory
                const collectionName = entry.name; // Use directory name as collection name
                console.log(`\nProcessing collection '${collectionName}' from directory ${entryPath}...`);
                const jsonFiles = await fs.readdir(entryPath);
                for (const fileName of jsonFiles) {
                    if (fileName.endsWith('.json')) { // Process only JSON files
                         const docId = fileName.replace(/\.json$/, ''); // Use filename (without extension) as doc ID
                         const filePath = path.join(entryPath, fileName);
                         await loadJsonIntoFirestore(collectionName, docId, filePath);
                    }
                }
            }
        }
    } catch (error) {
         if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
             console.warn(`⚠️ Directory not found: ${directoryPath}. Skipping.`);
         } else {
             console.error(`❌ Error processing directory ${directoryPath}:`, error);
             throw error; // Re-throw other errors
         }
    }

}

async function main() {
    console.log('--- Starting Firestore Data Loader Script ---');
    try {
        const firestoreBaseFolder = 'firestore'; // Base folder containing collection directories
        await processDirectory(firestoreBaseFolder);
        console.log('--- All data loaded successfully ---');
    } catch (error) {
        console.error('--- Firestore Data Loader Failed ---');
        process.exit(1); // Exit with error code if any part fails
    }
}

main();
