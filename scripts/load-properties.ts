// scripts/load-properties.ts
import * as dotenv from 'dotenv';
import * as path from 'path';
import * as fs from 'fs/promises';
import * as admin from 'firebase-admin';
import { blockSchemas } from '../lib/overridesSchemas'; // Assuming this path is correct

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });
console.log('✅ Environment variables loaded.');
console.log(`Project ID from env: ${process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID}`);

const serviceAccountPath = process.env.FIREBASE_ADMIN_SERVICE_ACCOUNT_PATH;

if (!serviceAccountPath) {
    console.error('❌ FIREBASE_ADMIN_SERVICE_ACCOUNT_PATH is not set in .env.local. Cannot initialize Admin SDK.');
    process.exit(1);
}

try {
  if (!admin.apps.length) {
      const serviceAccountFullPath = path.resolve(serviceAccountPath);
      console.log('🔑 Initializing Firebase Admin SDK with service account:', serviceAccountFullPath);

      admin.initializeApp({
        credential: admin.credential.cert(serviceAccountFullPath),
      });
      console.log('✅ Firebase Admin SDK initialized successfully.');
  } else {
       console.log('ℹ️ Firebase Admin SDK app already initialized.');
  }
} catch (error) {
   console.error('❌ Firebase Admin SDK initialization failed:', error);
   console.error('   Check if the service account key path is correct and the file is valid JSON.');
   process.exit(1);
}

const db = admin.firestore();

// Enhanced convertTimestamps to handle ISO strings as well
const convertObjectToFirestoreTimestamps = (data: any): any => {
    if (data === null || typeof data !== 'object') {
        // Check if it's a string and looks like an ISO date
        if (typeof data === 'string') {
            // Basic ISO date check (YYYY-MM-DDTHH:mm:ss.sssZ or YYYY-MM-DD)
            const isoDateRegex = /^\d{4}-\d{2}-\d{2}(T\d{2}:\d{2}:\d{2}(\.\d+)?(Z|([+-]\d{2}:\d{2}))?)?$/;
            if (isoDateRegex.test(data)) {
                try {
                    const date = new Date(data);
                    // Ensure the date is valid before converting
                    if (!isNaN(date.getTime())) {
                        return admin.firestore.Timestamp.fromDate(date);
                    }
                } catch (e) {
                    console.warn(`Could not parse string as date: ${data}`, e);
                    // Fall through to return original string if parsing fails
                }
            }
        }
        return data;
    }

    // Handle Firestore-like timestamp objects
    if (data._seconds !== undefined && data._nanoseconds !== undefined) {
        try {
            return new admin.firestore.Timestamp(data._seconds, data._nanoseconds);
        } catch (e) {
            console.warn(`Could not convert object to Timestamp: ${JSON.stringify(data)}`, e);
            return data; // Return original object if conversion fails
        }
    }

    // Recursively process arrays and objects
    if (Array.isArray(data)) {
        return data.map(convertObjectToFirestoreTimestamps);
    }

    const convertedData: { [key: string]: any } = {};
    for (const key in data) {
        if (Object.prototype.hasOwnProperty.call(data, key)) {
            convertedData[key] = convertObjectToFirestoreTimestamps(data[key]);
        }
    }
    return convertedData;
};


async function loadJsonIntoFirestore(collectionName: string, docId: string, filePath: string) {
    console.log(`Processing [${collectionName}/${docId}] from ${filePath}...`);
    try {
        const fullPath = path.resolve(filePath);
        const fileContent = await fs.readFile(fullPath, 'utf-8');
        const jsonData = JSON.parse(fileContent);

        // --- Validate blocks in defaults for websiteTemplates
        if (collectionName === 'websiteTemplates' && jsonData.defaults) {
            for (const blockKey of Object.keys(jsonData.defaults)) {
                const schema = blockSchemas[blockKey];
                if (schema) {
                    try {
                        schema.parse(jsonData.defaults[blockKey]);
                        console.log(`  ✅ Validated defaults.${blockKey} against schema.`);
                    } catch (err) {
                        console.error(`  ❌ Validation failed for defaults.${blockKey} in ${filePath}:`, err);
                        throw err; // Stop script on validation error
                    }
                } else {
                    console.warn(`  ⚠️ No schema defined for defaults.${blockKey} in ${filePath}, skipping validation.`);
                }
            }
        }

        const dataWithTimestamps = convertObjectToFirestoreTimestamps(jsonData);

        const docRef = db.collection(collectionName).doc(docId);
        await docRef.set(dataWithTimestamps, { merge: true });
        console.log(`✅ Loaded document: ${collectionName}/${docId}`);
    } catch (error) {
        console.error(`❌ Failed loading ${collectionName}/${docId} from ${filePath}:`, error);
        throw error;
    }
}

async function processDirectory(directoryPath: string) {
    try {
        const entries = await fs.readdir(directoryPath, { withFileTypes: true });
        const collectionName = path.basename(directoryPath); // Use directory name as collection name
        console.log(`\nProcessing collection '${collectionName}' from directory ${directoryPath}...`);

        for (const entry of entries) {
            const entryPath = path.join(directoryPath, entry.name);
            if (entry.isFile() && entry.name.endsWith('.json')) {
                const docId = entry.name.replace(/\.json$/, '');
                const filePath = entryPath;
                await loadJsonIntoFirestore(collectionName, docId, filePath);
            }
        }
    } catch (error) {
        if (error instanceof Error && 'code' in error && (error as NodeJS.ErrnoException).code === 'ENOENT') {
            console.warn(`⚠️ Directory not found: ${directoryPath}. Skipping.`);
        } else {
            console.error(`❌ Error processing directory ${directoryPath}:`, error);
            throw error;
        }
    }
}

async function main() {
    console.log('--- Starting Firestore Data Loader Script ---');
    console.log('🟢 RUNNING FILE:', __filename);
    try {
        console.log('process.argv:', process.argv);
        const inputFilePath = process.argv[2]; // Optional command-line file path

        if (inputFilePath) {
            const resolvedFile = path.resolve(inputFilePath);
            const collectionName = path.basename(path.dirname(resolvedFile)); 
            const docId = path.basename(resolvedFile).replace(/\.json$/, ''); 
            console.log(`🔍 Single-file mode: Loading ${resolvedFile} into ${collectionName}/${docId}`);
            await loadJsonIntoFirestore(collectionName, docId, resolvedFile);
        } else {
            const firestoreBaseFolder = 'firestore';
            // Process standard directories
            await processDirectory(path.join(firestoreBaseFolder, 'websiteTemplates'));
            await processDirectory(path.join(firestoreBaseFolder, 'properties'));
            await processDirectory(path.join(firestoreBaseFolder, 'propertyOverrides'));
            await processDirectory(path.join(firestoreBaseFolder, 'appConfig'));
            // Process the new inquiries directory
            await processDirectory(path.join(firestoreBaseFolder, 'inquiries'));
            // Add other directories/collections as needed
        }

        console.log('--- All data loaded successfully ---');
    } catch (error) {
        console.error('--- Firestore Data Loader Failed ---');
        process.exit(1);
    }
}

main();
