#!/usr/bin/env node

/**
 * Script to extract and display amenities and features before creating collections
 */

import * as fs from 'fs';
import * as path from 'path';

// Extract unique amenities from all properties
function extractAmenities() {
  const amenitiesMap = new Map<string, any>();
  
  // Read property overrides to get amenities from details page
  const overridesDir = path.join(__dirname, '..', 'firestore', 'propertyOverrides');
  const overrideFiles = fs.readdirSync(overridesDir).filter(f => f.endsWith('.json') && !f.endsWith('.obsolete'));
  
  for (const file of overrideFiles) {
    console.log(`\nExtracting from ${file}:`);
    const content = JSON.parse(fs.readFileSync(path.join(overridesDir, file), 'utf8'));
    
    if (content.details?.amenities?.categories) {
      for (const category of content.details.amenities.categories) {
        console.log(`  Category: ${JSON.stringify(category.name)}`);
        
        if (category.amenities) {
          for (const amenity of category.amenities) {
            const name = typeof amenity.name === 'object' ? amenity.name : { en: amenity.name, ro: amenity.name };
            const id = name.en.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');
            
            console.log(`    - ${id}: ${JSON.stringify(name)}`);
            
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
  
  // Also check property files for basic amenities
  const propertiesDir = path.join(__dirname, '..', 'firestore', 'properties');
  const propertyFiles = fs.readdirSync(propertiesDir).filter(f => f.endsWith('.json') && !f.endsWith('.obsolete'));
  
  for (const file of propertyFiles) {
    console.log(`\nExtracting from property ${file}:`);
    const content = JSON.parse(fs.readFileSync(path.join(propertiesDir, file), 'utf8'));
    
    if (content.amenities) {
      console.log('  Found amenities array:', JSON.stringify(content.amenities, null, 2));
    }
  }
  
  return amenitiesMap;
}

// Extract unique features from properties
function extractFeatures() {
  const featuresMap = new Map<string, any>();
  
  const overridesDir = path.join(__dirname, '..', 'firestore', 'propertyOverrides');
  const overrideFiles = fs.readdirSync(overridesDir).filter(f => f.endsWith('.json') && !f.endsWith('.obsolete'));
  
  for (const file of overrideFiles) {
    console.log(`\nExtracting features from ${file}:`);
    const content = JSON.parse(fs.readFileSync(path.join(overridesDir, file), 'utf8'));
    
    if (content.homepage?.features) {
      for (const feature of content.homepage.features) {
        const title = typeof feature.title === 'object' ? feature.title : { en: feature.title, ro: feature.title };
        const id = title.en.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');
        
        console.log(`  - ${id}: ${JSON.stringify(title)}`);
        
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

// Main function
function main() {
  console.log('Extracting amenities and features data...\n');
  
  // Extract data
  const amenitiesMap = extractAmenities();
  const featuresMap = extractFeatures();
  
  console.log('\n\n=== SUMMARY ===');
  console.log(`\nFound ${amenitiesMap.size} unique amenities:`);
  amenitiesMap.forEach((amenity, id) => {
    console.log(`  ${id}: ${JSON.stringify(amenity.name)}`);
  });
  
  console.log(`\nFound ${featuresMap.size} unique features:`);
  featuresMap.forEach((feature, id) => {
    console.log(`  ${id}: ${JSON.stringify(feature.title)}`);
  });
}

main();