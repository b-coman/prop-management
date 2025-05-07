// scripts/load-properties.ts
import * as dotenv from 'dotenv';
import * as path from 'path';
import * as fs from 'fs/promises';
import * as admin from 'firebase-admin';
import { blockSchemas } from '../lib/overridesSchemas'; // Assuming this path is correct
import { convertObjectToFirestoreTimestamps } from './convertTimestamps'; // Assuming this path is correct


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
        // Optionally specify projectId if not in service account key or if you want to be explicit
        // projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID
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

async function loadJsonIntoFirestore(collectionName: string, docId: string, filePath: string) {
    console.log(`Processing [${collectionName}/${docId}] from ${filePath}...`);
    try {
        const fullPath = path.resolve(filePath);
        const fileContent = await fs.readFile(fullPath, 'utf-8');
        const jsonData = JSON.parse(fileContent);

        // --- Validate blocks in defaults
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
        await docRef.set(dataWithTimestamps, { merge: true }); // Using merge: true can be safer
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
            // Removed recursive directory processing to handle appConfig explicitly
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
            const collectionName = path.basename(path.dirname(resolvedFile)); // e.g., 'properties'
            const docId = path.basename(resolvedFile).replace(/\.json$/, ''); // e.g., 'prahova-mountain-chalet'
            console.log(`🔍 Single-file mode: Loading ${resolvedFile} into ${collectionName}/${docId}`);
            await loadJsonIntoFirestore(collectionName, docId, resolvedFile);
        } else {
            const firestoreBaseFolder = 'firestore';
            // Process standard directories
            await processDirectory(path.join(firestoreBaseFolder, 'websiteTemplates'));
            await processDirectory(path.join(firestoreBaseFolder, 'properties'));
            await processDirectory(path.join(firestoreBaseFolder, 'propertyOverrides'));
            // Process appConfig specifically
            await processDirectory(path.join(firestoreBaseFolder, 'appConfig'));
            // Add other directories/collections as needed
        }

        console.log('--- All data loaded successfully ---');
    } catch (error) {
        console.error('--- Firestore Data Loader Failed ---');
        process.exit(1);
    }
}

main();
