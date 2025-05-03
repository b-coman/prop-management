// scripts/load-properties.ts
import fs from 'fs/promises'; // Use promises for async file reading
import path from 'path';
import { collection, doc, setDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase'; // Adjust the path if your firebase init file is elsewhere
import { convertObjectToFirestoreTimestamps } from './convertTimestamps'; // Import the helper

const propertiesCollectionRef = collection(db, 'properties');

async function loadPropertyData(filePath: string, docId: string) {
    console.log(`Processing ${filePath}...`);
    try {
        const fullPath = path.resolve(filePath);
        console.log(`Reading file from: ${fullPath}`);

        // Read file content
        const fileContent = await fs.readFile(fullPath, 'utf-8');
        // console.log(`Raw file content for ${docId}:\n`, fileContent.substring(0, 200) + "..."); // Log snippet

        // Parse JSON
        let jsonData;
        try {
            jsonData = JSON.parse(fileContent);
        } catch (parseError) {
            console.error(`❌ Error parsing JSON from ${filePath}:`, parseError);
            throw new Error(`Invalid JSON format in ${filePath}`);
        }
        // console.log(`Parsed JSON data for ${docId}:`, JSON.stringify(jsonData, null, 2).substring(0, 200) + "...");


        // Convert timestamp objects before sending to Firestore
        const dataWithTimestamps = convertObjectToFirestoreTimestamps(jsonData);
        // console.log(`Data with Timestamps converted for ${docId}:`, JSON.stringify(dataWithTimestamps, null, 2).substring(0, 200) + "...");


        // Get a reference to the document with the specific ID
        const propertyDocRef = doc(propertiesCollectionRef, docId);

        // Set the document data in Firestore
        await setDoc(propertyDocRef, dataWithTimestamps);

        console.log(`✅ Successfully loaded data for property "${docId}" from ${filePath} into Firestore.`);

    } catch (error) {
        console.error(`❌ Failed to load data for property "${docId}" from ${filePath}:`, error);
        // Re-throw the error to stop the script if one file fails
        throw error;
    }
}

async function main() {
    console.log('--- Starting Firestore Property Data Loading Script ---');
    try {
        // Define the paths to your JSON files relative to the project root
        const filePaths = [
            { filePath: 'firestore/prop1.json', docId: 'prop1' },
            { filePath: 'firestore/prop2.json', docId: 'prop2' },
        ];

        // Process each file sequentially
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
