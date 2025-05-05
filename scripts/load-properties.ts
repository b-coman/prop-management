// scripts/load-firestore-data.ts
import * as dotenv from 'dotenv';
import * as path from 'path';
import * as fs from 'fs/promises';
import * as admin from 'firebase-admin';

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

const requiredEnvVars = ['NEXT_PUBLIC_FIREBASE_PROJECT_ID', 'NEXT_PUBLIC_FIREBASE_API_KEY', 'NEXT_FIREBASE_CLIENT_EMAIL'];
for (const envVar of requiredEnvVars) {
    if (!process.env[envVar]) {
        throw new Error(`Missing required environment variable: ${envVar}`);
    }
}

admin.initializeApp({
    projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
    credential: admin.credential.applicationDefault()
});
const db = admin.firestore();

async function loadJsonIntoFirestore(collectionName: string, docId: string, filePath: string) {
    console.log(`Processing [${collectionName}/${docId}] from ${filePath}...`);
    try {
        const fullPath = path.resolve(filePath);
        const fileContent = await fs.readFile(fullPath, 'utf-8');
        const jsonData = JSON.parse(fileContent);

        const docRef = db.collection(collectionName).doc(docId);
        await docRef.set(jsonData);
        console.log(`✅ Loaded document: ${collectionName}/${docId}`);
    } catch (error) {
        console.error(`❌ Failed loading ${collectionName}/${docId} from ${filePath}:`, error);
        throw error;
    }
}

async function processDirectory(directoryPath: string) {
    const entries = await fs.readdir(directoryPath, { withFileTypes: true });
    for (const entry of entries) {
        const entryPath = path.join(directoryPath, entry.name);
        if (entry.isDirectory() && entry.name !== '_oldFiles') {
            const collectionName = entry.name;
            const jsonFiles = await fs.readdir(entryPath);
            for (const fileName of jsonFiles) {
                if (!fileName.endsWith('.json')) continue;
                const docId = fileName.replace(/\.json$/, '');
                const filePath = path.join(entryPath, fileName);
                await loadJsonIntoFirestore(collectionName, docId, filePath);
            }
        }
    }
}

async function main() {
    console.log('--- Starting Firestore Data Loader ---');
    try {
        const firestoreFolder = 'firestore'; // top-level folder
        await processDirectory(firestoreFolder);
        console.log('--- All data loaded successfully ---');
    } catch (error) {
        console.error('--- Firestore Data Loader Failed ---', error);
        throw error;
    }
}

main();
