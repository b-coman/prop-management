#!/usr/bin/env node

/**
 * Script to update property overrides to use amenity references
 */

import * as fs from 'fs';
import * as path from 'path';
import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import * as dotenv from 'dotenv';

// Load environment variables
const envPath = path.join(__dirname, '..', '.env.local');
dotenv.config({ path: envPath });
dotenv.config({ path: path.join(__dirname, '..', '.env') });

// Initialize Firebase Admin
const serviceAccountPath = process.env.FIREBASE_ADMIN_SERVICE_ACCOUNT_PATH;
if (!serviceAccountPath) {
  console.error('Error: FIREBASE_ADMIN_SERVICE_ACCOUNT_PATH environment variable not set');
  process.exit(1);
}

const serviceAccount = JSON.parse(
  fs.readFileSync(serviceAccountPath, 'utf8')
);

initializeApp({
  credential: cert(serviceAccount)
});

const db = getFirestore();

async function updatePropertyOverrides() {
  console.log('Updating property overrides to use amenity references...\n');
  
  const overridesDir = path.join(__dirname, '..', 'firestore', 'propertyOverrides');
  const overrideFiles = fs.readdirSync(overridesDir).filter(f => f.endsWith('.json') && !f.endsWith('.obsolete'));
  
  for (const file of overrideFiles) {
    const propertyId = path.basename(file, '.json');
    console.log(`Updating ${propertyId}...`);
    
    const content = JSON.parse(fs.readFileSync(path.join(overridesDir, file), 'utf8'));
    
    // Update details page amenities
    if (content.details?.amenities?.categories) {
      const updatedCategories = [];
      
      for (const category of content.details.amenities.categories) {
        const updatedCategory = {
          name: category.name,
          amenityRefs: [] as string[]
        };
        
        if (category.amenities) {
          for (const amenity of category.amenities) {
            const name = typeof amenity.name === 'object' ? amenity.name : { en: amenity.name, ro: amenity.name };
            const id = name.en.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');
            updatedCategory.amenityRefs.push(id);
          }
        }
        
        // Keep old data as backup
        (updatedCategory as any).amenitiesOld = category.amenities;
        updatedCategories.push(updatedCategory);
      }
      
      content.details.amenities.categories = updatedCategories;
    }
    
    // Save updated file
    fs.writeFileSync(
      path.join(overridesDir, file),
      JSON.stringify(content, null, 2)
    );
    
    // Update in Firestore
    await db.collection('propertyOverrides').doc(propertyId).set(content);
    console.log(`✓ Updated ${propertyId}`);
  }
  
  console.log('\n✓ Property overrides updated successfully!');
}

updatePropertyOverrides().catch(console.error);