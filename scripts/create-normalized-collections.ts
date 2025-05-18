#!/usr/bin/env node

/**
 * Script to create normalized amenities and features collections
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

// Standard amenities mapping
const standardAmenities: { [key: string]: { id: string; icon: string; name: { en: string; ro: string } } } = {
  'WiFi': {
    id: 'wifi',
    icon: 'Wifi',
    name: { en: 'WiFi', ro: 'WiFi' }
  },
  'Kitchen': {
    id: 'kitchen',
    icon: 'ChefHat',
    name: { en: 'Kitchen', ro: 'Bucătărie' }
  },
  'Parking': {
    id: 'parking',
    icon: 'Car',
    name: { en: 'Parking', ro: 'Parcare' }
  },
  'Fireplace': {
    id: 'fireplace',
    icon: 'Flame',
    name: { en: 'Fireplace', ro: 'Șemineu' }
  },
  'TV': {
    id: 'tv',
    icon: 'Tv',
    name: { en: 'TV', ro: 'Televizor' }
  },
  'Garden': {
    id: 'garden',
    icon: 'Trees',
    name: { en: 'Garden', ro: 'Grădină' }
  },
  'Mountain View': {
    id: 'mountain-view',
    icon: 'Mountain',
    name: { en: 'Mountain View', ro: 'Vedere la Munte' }
  },
  'Air Conditioning': {
    id: 'air-conditioning',
    icon: 'Wind',
    name: { en: 'Air Conditioning', ro: 'Aer Condiționat' }
  },
  'Washer/Dryer': {
    id: 'washer-dryer',
    icon: 'WashingMachine',
    name: { en: 'Washer/Dryer', ro: 'Mașină de Spălat/Uscător' }
  },
  'Elevator': {
    id: 'elevator',
    icon: 'Building',
    name: { en: 'Elevator', ro: 'Lift' }
  }
};

// Extract all unique amenities
async function extractAllAmenities() {
  const amenitiesMap = new Map<string, any>();
  
  // First, get amenities from property overrides (these have more details)
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
  
  // Then, process simple amenities from properties
  const propertiesDir = path.join(__dirname, '..', 'firestore', 'properties');
  const propertyFiles = fs.readdirSync(propertiesDir).filter(f => f.endsWith('.json') && !f.endsWith('.obsolete'));
  
  for (const file of propertyFiles) {
    const content = JSON.parse(fs.readFileSync(path.join(propertiesDir, file), 'utf8'));
    
    if (content.amenities?.en) {
      for (let i = 0; i < content.amenities.en.length; i++) {
        const enName = content.amenities.en[i];
        const roName = content.amenities.ro?.[i] || enName;
        
        // Check if we have a standard mapping
        const standard = standardAmenities[enName];
        if (standard) {
          amenitiesMap.set(standard.id, standard);
        } else {
          // Create a new mapping
          const id = enName.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');
          if (!amenitiesMap.has(id)) {
            amenitiesMap.set(id, {
              id,
              icon: 'Home', // Default icon
              name: { en: enName, ro: roName }
            });
          }
        }
      }
    }
  }
  
  return amenitiesMap;
}

// Extract features
async function extractFeatures() {
  const featuresMap = new Map<string, any>();
  
  const overridesDir = path.join(__dirname, '..', 'firestore', 'propertyOverrides');
  const overrideFiles = fs.readdirSync(overridesDir).filter(f => f.endsWith('.json') && !f.endsWith('.obsolete'));
  
  for (const file of overrideFiles) {
    const content = JSON.parse(fs.readFileSync(path.join(overridesDir, file), 'utf8'));
    
    if (content.homepage?.features) {
      for (const feature of content.homepage.features) {
        const title = typeof feature.title === 'object' ? feature.title : { en: feature.title, ro: feature.title };
        const id = title.en.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');
        
        // Fix missing Romanian translations
        if (title.ro === title.en) {
          if (title.en === 'Traditional Fireplace') title.ro = 'Șemineu Tradițional';
          if (title.en === 'Outdoor BBQ Area') title.ro = 'Zonă BBQ Exterioară';
          if (title.en === 'Panoramic Terrace') title.ro = 'Terasă Panoramică';
        }
        
        featuresMap.set(id, {
          id,
          title,
          description: typeof feature.description === 'object' ? feature.description : { en: feature.description, ro: feature.description },
          icon: feature.icon || 'Star',
          order: feature.order || 0
        });
      }
    }
  }
  
  return featuresMap;
}

// Create collections
async function createCollections() {
  console.log('Creating normalized collections...\n');
  
  // Extract data
  const amenitiesMap = await extractAllAmenities();
  const featuresMap = await extractFeatures();
  
  // Create amenities collection
  console.log('Creating amenities collection...');
  const amenitiesDir = path.join(__dirname, '..', 'firestore', 'amenities');
  if (!fs.existsSync(amenitiesDir)) {
    fs.mkdirSync(amenitiesDir, { recursive: true });
  }
  
  for (const [id, amenity] of amenitiesMap) {
    fs.writeFileSync(
      path.join(amenitiesDir, `${id}.json`),
      JSON.stringify(amenity, null, 2)
    );
    await db.collection('amenities').doc(id).set(amenity);
    console.log(`  ✓ Created amenity: ${id}`);
  }
  
  // Create features collection
  console.log('\nCreating features collection...');
  const featuresDir = path.join(__dirname, '..', 'firestore', 'features');
  if (!fs.existsSync(featuresDir)) {
    fs.mkdirSync(featuresDir, { recursive: true });
  }
  
  for (const [id, feature] of featuresMap) {
    fs.writeFileSync(
      path.join(featuresDir, `${id}.json`),
      JSON.stringify(feature, null, 2)
    );
    await db.collection('features').doc(id).set(feature);
    console.log(`  ✓ Created feature: ${id}`);
  }
  
  console.log(`\n✓ Created ${amenitiesMap.size} amenities and ${featuresMap.size} features`);
  
  // Update properties to use references
  console.log('\nUpdating properties to use amenity references...');
  
  const propertiesDir = path.join(__dirname, '..', 'firestore', 'properties');
  const propertyFiles = fs.readdirSync(propertiesDir).filter(f => f.endsWith('.json') && !f.endsWith('.obsolete'));
  
  for (const file of propertyFiles) {
    const propertyId = path.basename(file, '.json');
    const content = JSON.parse(fs.readFileSync(path.join(propertiesDir, file), 'utf8'));
    
    if (content.amenities?.en) {
      const amenityRefs: string[] = [];
      
      for (const amenity of content.amenities.en) {
        const standard = standardAmenities[amenity];
        if (standard) {
          amenityRefs.push(standard.id);
        } else {
          const id = amenity.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');
          amenityRefs.push(id);
        }
      }
      
      // Keep old data as backup
      content.amenitiesOld = content.amenities;
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
  
  console.log('\n✓ Restructuring completed successfully!');
}

// Main
createCollections().catch(console.error);