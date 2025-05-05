
// scripts/load-properties.ts
import * as dotenv from 'dotenv';
import * as path from 'path';
import * as fs from 'fs/promises';
import * as admin from 'firebase-admin';
import { Timestamp } from 'firebase-admin/firestore';

// Load environment variables from .env.local at the project root
dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

// check env vars
const requiredEnvVars = ['NEXT_PUBLIC_FIREBASE_PROJECT_ID', 'NEXT_PUBLIC_FIREBASE_API_KEY', 'NEXT_FIREBASE_CLIENT_EMAIL'];
for (const envVar of requiredEnvVars) {
    if (!process.env[envVar]) {
        throw new Error(`Missing required environment variable: ${envVar}`);
    }
}

admin.initializeApp({projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID, credential: admin.credential.applicationDefault()});
const db = admin.firestore();

async function loadPropertyData(filePath: string, docId: string) {
    console.log(`Processing ${filePath}...`);
    try {
        const propertiesCollectionRef = db.collection('properties');

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

        // Get a reference to the document with the specific ID
        const propertyDocRef = propertiesCollectionRef.doc(docId);
        await propertyDocRef.set(jsonData);
        console.log(`✅ Successfully loaded data for property "${docId}" from ${filePath} into Firestore (using Admin SDK).`);

    } catch (error) {
        console.error(`❌ Failed to load data for property "${docId}" from ${filePath}:`, error);
        throw error;
    }
}

async function main() {
    console.log('--- Starting Firestore Property Data Loading Script (using Admin SDK) ---');
    // Environment variables are loaded by dotenv at the top
    if (!process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID) {
        console.warn("⚠️ Environment variable NEXT_PUBLIC_FIREBASE_PROJECT_ID not loaded correctly. Ensure .env.local exists and is readable.");
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
        console.error('--- Firestore Property Data Loading Script Failed ---', error);
        throw error;
    }
}

// Execute the main function
main();
