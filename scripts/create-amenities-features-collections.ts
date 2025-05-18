#!/usr/bin/env node

/**
 * Script to create amenities and features collections from existing property data
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

// Extract unique amenities from all properties
async function extractAmenities() {
  const amenitiesMap = new Map<string, any>();
  
  // Read property files
  const propertiesDir = path.join(__dirname, '..', 'firestore', 'properties');
  const propertyFiles = fs.readdirSync(propertiesDir).filter(f => f.endsWith('.json') && !f.endsWith('.obsolete'));
  
  for (const file of propertyFiles) {
    const content = JSON.parse(fs.readFileSync(path.join(propertiesDir, file), 'utf8'));
    
    // Extract from property amenities
    if (content.amenities && content.amenities.en) {
      for (const amenity of content.amenities.en) {
        const id = amenity.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');
        amenitiesMap.set(id, {
          id,
          name: {
            en: amenity,
            ro: content.amenities.ro?.[content.amenities.en.indexOf(amenity)] || amenity
          }
        });
      }
    }
  }
  
  // Read property overrides to get amenities from details page
  const overridesDir = path.join(__dirname, '..', 'firestore', 'propertyOverrides');
  const overrideFiles = fs.readdirSync(overridesDir).filter(f => f.endsWith('.json') && !f.endsWith('.obsolete'));
  
  for (const file of overrideFiles) {
    const content = JSON.parse(fs.readFileSync(path.join(overridesDir, file), 'utf8'));
    
    if (content.details?.amenities?.categories) {
      for (const category of content.details.amenities.categories) {
        if (category.amenities) {
          for (const amenity of category.amenities) {
            const name = typeof amenity.name === 'object' ? amenity.name : { en: amenity.name, ro: amenity.name };
            const id = name.en.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');
            
            amenitiesMap.set(id, {
              id,
              icon: amenity.icon,
              name,
              category: typeof category.name === 'object' ? category.name : { en: category.name, ro: category.name }
            });
          }
        }
      }
    }
  }
  
  return amenitiesMap;
}

// Extract unique features from properties
async function extractFeatures() {
  const featuresMap = new Map<string, any>();
  
  // Read property overrides for features
  const overridesDir = path.join(__dirname, '..', 'firestore', 'propertyOverrides');
  const overrideFiles = fs.readdirSync(overridesDir).filter(f => f.endsWith('.json') && !f.endsWith('.obsolete'));
  
  for (const file of overrideFiles) {
    const content = JSON.parse(fs.readFileSync(path.join(overridesDir, file), 'utf8'));
    
    if (content.homepage?.features) {
      for (const feature of content.homepage.features) {
        const title = typeof feature.title === 'object' ? feature.title : { en: feature.title, ro: feature.title };
        const id = title.en.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');
        
        featuresMap.set(id, {
          id,
          title,
          description: typeof feature.description === 'object' ? feature.description : { en: feature.description, ro: feature.description },
          icon: feature.icon
        });
      }
    }
  }
  
  return featuresMap;
}

// Create amenities collection in Firestore
async function createAmenitiesCollection(amenitiesMap: Map<string, any>) {
  console.log('\nCreating amenities collection...');
  
  // Create JSON file
  const amenitiesDir = path.join(__dirname, '..', 'firestore', 'amenities');
  if (!fs.existsSync(amenitiesDir)) {
    fs.mkdirSync(amenitiesDir, { recursive: true });
  }
  
  for (const [id, amenity] of amenitiesMap) {
    // Save to JSON file
    fs.writeFileSync(
      path.join(amenitiesDir, `${id}.json`),
      JSON.stringify(amenity, null, 2)
    );
    
    // Upload to Firestore
    await db.collection('amenities').doc(id).set(amenity);
    console.log(`  ✓ Created amenity: ${id}`);
  }
  
  console.log(`✓ Created ${amenitiesMap.size} amenities`);
}

// Create features collection in Firestore
async function createFeaturesCollection(featuresMap: Map<string, any>) {
  console.log('\nCreating features collection...');
  
  // Create JSON file
  const featuresDir = path.join(__dirname, '..', 'firestore', 'features');
  if (!fs.existsSync(featuresDir)) {
    fs.mkdirSync(featuresDir, { recursive: true });
  }
  
  for (const [id, feature] of featuresMap) {
    // Save to JSON file
    fs.writeFileSync(
      path.join(featuresDir, `${id}.json`),
      JSON.stringify(feature, null, 2)
    );
    
    // Upload to Firestore
    await db.collection('features').doc(id).set(feature);
    console.log(`  ✓ Created feature: ${id}`);
  }
  
  console.log(`✓ Created ${featuresMap.size} features`);
}

// Update properties to use references
async function updatePropertiesToUseReferences(amenitiesMap: Map<string, any>) {
  console.log('\nUpdating properties to use amenity references...');
  
  const propertiesDir = path.join(__dirname, '..', 'firestore', 'properties');
  const propertyFiles = fs.readdirSync(propertiesDir).filter(f => f.endsWith('.json') && !f.endsWith('.obsolete'));
  
  for (const file of propertyFiles) {
    const propertyId = path.basename(file, '.json');
    const content = JSON.parse(fs.readFileSync(path.join(propertiesDir, file), 'utf8'));
    
    if (content.amenities && content.amenities.en) {
      // Convert to references
      const amenityRefs: string[] = [];
      
      for (const amenity of content.amenities.en) {
        const id = amenity.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');
        if (amenitiesMap.has(id)) {
          amenityRefs.push(id);
        }
      }
      
      // Update property structure
      content.amenitiesOld = content.amenities; // Keep old data as backup
      content.amenities = amenityRefs;
      
      // Save updated file
      fs.writeFileSync(
        path.join(propertiesDir, file),
        JSON.stringify(content, null, 2)
      );
      
      // Update in Firestore
      await db.collection('properties').doc(propertyId).set(content);
      console.log(`  ✓ Updated property: ${propertyId}`);
    }
  }
}

// Main function
async function main() {
  console.log('Restructuring data for amenities and features collections...\n');
  
  try {
    // Extract data
    const amenitiesMap = await extractAmenities();
    const featuresMap = await extractFeatures();
    
    console.log(`Found ${amenitiesMap.size} unique amenities`);
    console.log(`Found ${featuresMap.size} unique features`);
    
    // Create collections
    await createAmenitiesCollection(amenitiesMap);
    await createFeaturesCollection(featuresMap);
    
    // Update properties to use references
    await updatePropertiesToUseReferences(amenitiesMap);
    
    console.log('\n✓ Restructuring completed successfully!');
    console.log('\nNext steps:');
    console.log('1. Update your components to fetch from amenities/features collections');
    console.log('2. Test the reference system');
    console.log('3. Remove the old amenitiesOld field once verified');
  } catch (error) {
    console.error('\n✗ Error:', error);
    process.exit(1);
  }
}

main().catch(console.error);