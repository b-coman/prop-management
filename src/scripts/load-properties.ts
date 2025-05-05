// scripts/load-properties.ts
import * as dotenv from 'dotenv';
import * as path from 'path';
import * as fs from 'fs/promises';
import * as admin from 'firebase-admin';
import { blockSchemas } from '../lib/overridesSchemas';

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

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

async function loadJsonIntoFirestore(collectionName: string, docId: string, filePath: string) {
    console.log(`Processing [${collectionName}/${docId}] from ${filePath}...`);
    try {
        const fullPath = path.resolve(filePath);
        const fileContent = await fs.readFile(fullPath, 'utf-8');
        const jsonData = JSON.parse(fileContent);

        // --- Validate blocks in defaults
        if (jsonData.defaults) {
            for (const blockKey of Object.keys(jsonData.defaults)) {
                const schema = blockSchemas[blockKey];
                if (schema) {
                    try {
                        schema.parse(jsonData.defaults[blockKey]);
                        console.log(`✅ Validated defaults.${blockKey} against schema.`);
                    } catch (err) {
                        console.error(`❌ Validation failed for defaults.${blockKey}:`, err);
                        throw err; // Stop script on validation error
                    }
                } else {
                    console.warn(`⚠️ No schema defined for defaults.${blockKey}, skipping validation.`);
                }
            }
        }

        // Convert Firestore-like timestamp objects to actual Timestamps
        const convertTimestamps = (data: any): any => {
            if (data === null || typeof data !== 'object') return data;
            if (data._seconds !== undefined && data._nanoseconds !== undefined) {
                try {
                    return new admin.firestore.Timestamp(data._seconds, data._nanoseconds);
                } catch (e) {
                    console.warn(`Could not convert object to Timestamp: ${JSON.stringify(data)}`, e);
                    return data;
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
        for (const entry of entries) {
            const entryPath = path.join(directoryPath, entry.name);
            if (entry.isDirectory() && entry.name !== '_oldFiles') {
                const collectionName = entry.name;
                console.log(`\nProcessing collection '${collectionName}' from directory ${entryPath}...`);
                const jsonFiles = await fs.readdir(entryPath);
                for (const fileName of jsonFiles) {
                    if (fileName.endsWith('.json')) {
                        const docId = fileName.replace(/\.json$/, '');
                        const filePath = path.join(entryPath, fileName);
                        await loadJsonIntoFirestore(collectionName, docId, filePath);
                    }
                }
            }
        }
    } catch (error) {
        if (error instanceof Error && 'code' in error && error.code === 'ENOENT') {
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
            console.log(`🔍 Single-file mode: ${resolvedFile}`);
            await loadJsonIntoFirestore(collectionName, docId, resolvedFile);
        } else {
            const firestoreBaseFolder = 'firestore';
            await processDirectory(firestoreBaseFolder);
        }

        console.log('--- All data loaded successfully ---');
    } catch (error) {
        console.error('--- Firestore Data Loader Failed ---');
        process.exit(1);
    }
}


main();
