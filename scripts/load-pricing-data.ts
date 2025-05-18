import * as fs from 'fs';
import * as path from 'path';
import admin from 'firebase-admin';
import dotenv from 'dotenv';
import { dbAdmin } from '../src/lib/firebaseAdmin';

// Load environment variables from .env and .env.local
dotenv.config({ path: path.resolve(process.cwd(), '.env') });
dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

// Use the centralized Firebase Admin instance
function getFirestoreDb() {
  if (!dbAdmin) {
    console.error('Firebase Admin SDK is not properly initialized from centralized implementation');
    throw new Error('Firebase Admin SDK is not properly initialized');
  }

  console.log('✅ Using centralized Firebase Admin SDK implementation');
  return dbAdmin;
}

// Process timestamp values recursively
function processTimestamps(obj: any): any {
  if (!obj || typeof obj !== 'object') return obj;
  
  for (const key in obj) {
    if (Object.prototype.hasOwnProperty.call(obj, key)) {
      const value = obj[key];
      
      // Process nested objects including arrays
      if (typeof value === 'object') {
        if (value?.__type === 'timestamp' && value?.value) {
          // Convert the timestamp object to Firestore Timestamp
          obj[key] = admin.firestore.Timestamp.fromMillis(
            value.value._seconds * 1000 + (value.value._nanoseconds || 0) / 1000000
          );
        } else {
          // Recursive call for nested objects
          obj[key] = processTimestamps(value);
        }
      }
    }
  }
  
  return obj;
}

// Load a collection from the given directory
async function loadCollectionFromDirectory(db: FirebaseFirestore.Firestore, collectionName: string, dirPath: string) {
  console.log(`Loading ${collectionName} collection from ${dirPath}`);
  
  try {
    // Ensure the directory exists
    if (!fs.existsSync(dirPath)) {
      console.log(`Directory ${dirPath} does not exist, skipping collection ${collectionName}`);
      return;
    }
    
    // Get all JSON files in the directory
    const files = fs.readdirSync(dirPath).filter(file => file.endsWith('.json'));
    
    for (const file of files) {
      const filePath = path.join(dirPath, file);
      
      try {
        // Read the file content
        const content = fs.readFileSync(filePath, 'utf-8');
        const data = JSON.parse(content);
        
        // Process any timestamp values
        const processedData = processTimestamps(data);
        
        // Get document ID from the file name or from the data
        const docId = data.id || path.basename(file, '.json');
        
        // Write to Firestore
        await db.collection(collectionName).doc(docId).set(processedData, { merge: true });
        console.log(`Successfully loaded document ${docId} in collection ${collectionName}`);
      } catch (err) {
        console.error(`Error processing file ${file}:`, err);
      }
    }
    
    console.log(`Completed loading ${collectionName} collection`);
  } catch (err) {
    console.error(`Error loading collection ${collectionName}:`, err);
  }
}

// Main function to run the script
async function main() {
  try {
    // Initialize Firestore using the centralized implementation
    const db = getFirestoreDb();

    // Define the root directory containing collection subdirectories
    const rootDir = path.resolve(__dirname, '../firestore');

    // Load collections related to pricing
    const collections = [
      'pricingTemplates',
      'seasonalPricing',
      'dateOverrides',
      'priceCalendars',
      'properties' // Load properties last to ensure references exist
    ];
    
    // Process each collection
    for (const collection of collections) {
      const collectionDir = path.join(rootDir, collection);
      await loadCollectionFromDirectory(db, collection, collectionDir);
    }
    
    console.log('Successfully loaded all pricing data to Firestore');
  } catch (error) {
    console.error('Failed to load pricing data:', error);
    process.exit(1);
  }
}

// Run the main function
main().catch(console.error);