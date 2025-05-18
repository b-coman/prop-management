#!/usr/bin/env node

/**
 * Migration script to convert existing property data to multilingual format
 * This script updates JSON files to support English and Romanian translations
 */

import fs from 'fs';
import path from 'path';

// Translation mapping for common amenities
const amenityTranslations: Record<string, { en: string; ro: string }> = {
  'WiFi': { en: 'WiFi', ro: 'WiFi' },
  'Kitchen': { en: 'Kitchen', ro: 'Bucătărie' },
  'Parking': { en: 'Parking', ro: 'Parcare' },
  'Fireplace': { en: 'Fireplace', ro: 'Șemineu' },
  'TV': { en: 'TV', ro: 'Televizor' },
  'Garden': { en: 'Garden', ro: 'Grădină' },
  'Mountain View': { en: 'Mountain View', ro: 'Vedere la Munte' },
  'Air Conditioning': { en: 'Air Conditioning', ro: 'Aer Condiționat' },
  'Heating': { en: 'Heating', ro: 'Încălzire' },
  'Washing Machine': { en: 'Washing Machine', ro: 'Mașină de Spălat' },
  'Pool': { en: 'Pool', ro: 'Piscină' },
  'Hot Tub': { en: 'Hot Tub', ro: 'Jacuzzi' },
  'Balcony': { en: 'Balcony', ro: 'Balcon' },
  'Terrace': { en: 'Terrace', ro: 'Terasă' },
  'BBQ': { en: 'BBQ', ro: 'Grătar' },
  'Dishwasher': { en: 'Dishwasher', ro: 'Mașină de Spălat Vase' },
  'Coffee Machine': { en: 'Coffee Machine', ro: 'Espressor' },
  'Free Parking': { en: 'Free Parking', ro: 'Parcare Gratuită' },
  'City View': { en: 'City View', ro: 'Vedere la Oraș' },
  'Game Room': { en: 'Game Room', ro: 'Sală de Jocuri' },
  'Sauna': { en: 'Sauna', ro: 'Saună' },
  'Gym': { en: 'Gym', ro: 'Sală de Fitness' },
  'Playground': { en: 'Playground', ro: 'Loc de Joacă' },
  'Beach Access': { en: 'Beach Access', ro: 'Acces la Plajă' },
};

// Common rule translations
const ruleTranslations: Record<string, { en: string; ro: string }> = {
  'No smoking': { en: 'No smoking', ro: 'Fumatul interzis' },
  'No parties': { en: 'No parties', ro: 'Fără petreceri' },
  'Respect quiet hours': { en: 'Respect quiet hours', ro: 'Respectați orele de liniște' },
  'No pets': { en: 'No pets', ro: 'Fără animale de companie' },
  'Pets allowed': { en: 'Pets allowed', ro: 'Animale de companie permise' },
  'Check-in after 3 PM': { en: 'Check-in after 3 PM', ro: 'Check-in după ora 15:00' },
  'Check-out before 11 AM': { en: 'Check-out before 11 AM', ro: 'Check-out înainte de ora 11:00' },
  'No events': { en: 'No events', ro: 'Fără evenimente' },
  'Children welcome': { en: 'Children welcome', ro: 'Copiii sunt bineveniți' },
  'Maximum 6 guests': { en: 'Maximum 6 guests', ro: 'Maxim 6 oaspeți' },
};

// Function to migrate a single property file
function migratePropertyFile(filePath: string): void {
  console.log(`Migrating property file: ${filePath}`);
  
  try {
    const content = fs.readFileSync(filePath, 'utf8');
    const property = JSON.parse(content);
    
    // Migrate name
    if (typeof property.name === 'string') {
      const originalName = property.name;
      property.name = {
        en: originalName,
        ro: originalName // Default to same name, should be manually translated later
      };
    }
    
    // Migrate description
    if (typeof property.description === 'string') {
      const originalDescription = property.description;
      property.description = {
        en: originalDescription,
        ro: originalDescription // Default to same, should be manually translated later
      };
    }
    
    // Migrate short description
    if (typeof property.shortDescription === 'string') {
      const originalShortDescription = property.shortDescription;
      property.shortDescription = {
        en: originalShortDescription,
        ro: originalShortDescription // Default to same, should be manually translated later
      };
    }
    
    // Migrate amenities
    if (Array.isArray(property.amenities)) {
      property.amenities = {
        en: property.amenities,
        ro: property.amenities.map((amenity: string) => {
          const translation = amenityTranslations[amenity];
          return translation ? translation.ro : amenity;
        })
      };
    }
    
    // Migrate rules if they exist
    if (Array.isArray(property.rules)) {
      property.rules = {
        en: property.rules,
        ro: property.rules.map((rule: string) => {
          const translation = ruleTranslations[rule];
          return translation ? translation.ro : rule;
        })
      };
    }
    
    // TODO: Add marker for manual translation needed
    property._translationStatus = {
      needsManualTranslation: ['name.ro', 'description.ro', 'shortDescription.ro'],
      lastMigrated: new Date().toISOString()
    };
    
    // Write the migrated file
    fs.writeFileSync(filePath, JSON.stringify(property, null, 2));
    console.log(`✓ Migrated: ${path.basename(filePath)}`);
    
  } catch (error) {
    console.error(`✗ Error migrating ${filePath}:`, error);
  }
}

// Helper function to migrate content in a section
function migrateSectionContent(section: any): void {
  // Migrate title
  if (typeof section.title === 'string') {
    const originalTitle = section.title;
    section.title = {
      en: originalTitle,
      ro: originalTitle // Should be manually translated
    };
  }
  
  // Migrate subtitle
  if (typeof section.subtitle === 'string') {
    const originalSubtitle = section.subtitle;
    section.subtitle = {
      en: originalSubtitle,
      ro: originalSubtitle // Should be manually translated
    };
  }
  
  // Migrate description
  if (typeof section.description === 'string') {
    const originalDescription = section.description;
    section.description = {
      en: originalDescription,
      ro: originalDescription // Should be manually translated
    };
  }
  
  // Migrate buttonText
  if (typeof section.buttonText === 'string') {
    const originalButtonText = section.buttonText;
    section.buttonText = {
      en: originalButtonText,
      ro: originalButtonText // Should be manually translated
    };
  }
  
  // Migrate highlights array (for experience sections)
  if (Array.isArray(section.highlights)) {
    section.highlights = section.highlights.map((highlight: any) => ({
      ...highlight,
      title: typeof highlight.title === 'string' ? {
        en: highlight.title,
        ro: highlight.title // Should be manually translated
      } : highlight.title,
      description: typeof highlight.description === 'string' ? {
        en: highlight.description,
        ro: highlight.description // Should be manually translated
      } : highlight.description
    }));
  }
  
  // Migrate features array
  if (Array.isArray(section.features)) {
    section.features = section.features.map((feature: any) => ({
      ...feature,
      title: typeof feature.title === 'string' ? {
        en: feature.title,
        ro: feature.title // Should be manually translated
      } : feature.title,
      description: typeof feature.description === 'string' ? {
        en: feature.description,
        ro: feature.description // Should be manually translated
      } : feature.description
    }));
  }
  
  // Migrate attractions array
  if (Array.isArray(section.attractions)) {
    section.attractions = section.attractions.map((attraction: any) => ({
      ...attraction,
      name: typeof attraction.name === 'string' ? {
        en: attraction.name,
        ro: attraction.name // Should be manually translated
      } : attraction.name,
      description: typeof attraction.description === 'string' ? {
        en: attraction.description,
        ro: attraction.description // Should be manually translated
      } : attraction.description,
      distance: typeof attraction.distance === 'string' ? {
        en: attraction.distance,
        ro: attraction.distance // Usually same format
      } : attraction.distance
    }));
  }
}

// Function to migrate property override files
function migratePropertyOverrideFile(filePath: string): void {
  console.log(`Migrating property override file: ${filePath}`);
  
  try {
    const content = fs.readFileSync(filePath, 'utf8');
    const overrides = JSON.parse(content);
    
    // Check if this is a multipage override (has pages structure)
    if (overrides.homepage) {
      // Handle multipage structure - sections are nested within page objects
      const pages = ['homepage', 'details', 'location', 'gallery', 'booking'];
      
      for (const page of pages) {
        if (overrides[page]) {
          // Each page has its own sections
          const sectionsInPage = ['hero', 'experience', 'host', 'features', 'location', 'cta', 'amenities', 'rules'];
          
          for (const section of sectionsInPage) {
            if (overrides[page][section]) {
              migrateSectionContent(overrides[page][section]);
            }
          }
          
          // Also migrate the page level content if it exists
          migrateSectionContent(overrides[page]);
        }
      }
    }
    
    // Migrate top-level sections (for single-page overrides)
    const sectionsToMigrate = ['hero', 'experience', 'host', 'location', 'cta'];
    
    for (const section of sectionsToMigrate) {
      if (overrides[section]) {
        migrateSectionContent(overrides[section]);
      }
    }
    
    // Migrate top-level features array
    if (Array.isArray(overrides.features)) {
      overrides.features = overrides.features.map((feature: any) => ({
        ...feature,
        title: typeof feature.title === 'string' ? {
          en: feature.title,
          ro: feature.title // Should be manually translated
        } : feature.title,
        description: typeof feature.description === 'string' ? {
          en: feature.description,
          ro: feature.description // Should be manually translated
        } : feature.description
      }));
    }
    
    // Migrate top-level attractions array
    if (Array.isArray(overrides.attractions)) {
      overrides.attractions = overrides.attractions.map((attraction: any) => ({
        ...attraction,
        name: typeof attraction.name === 'string' ? {
          en: attraction.name,
          ro: attraction.name // Should be manually translated
        } : attraction.name,
        description: typeof attraction.description === 'string' ? {
          en: attraction.description,
          ro: attraction.description // Should be manually translated
        } : attraction.description,
        distance: typeof attraction.distance === 'string' ? {
          en: attraction.distance,
          ro: attraction.distance // Usually same format
        } : attraction.distance
      }));
    }
    
    // Migrate menu items for multipage properties
    if (Array.isArray(overrides.menuItems)) {
      const menuTranslations: Record<string, { en: string; ro: string }> = {
        'Home': { en: 'Home', ro: 'Acasă' },
        'Property Details': { en: 'Property Details', ro: 'Detalii Proprietate' },
        'About the Chalet': { en: 'About the Chalet', ro: 'Despre Cabană' },
        'Where We Are': { en: 'Where We Are', ro: 'Unde Suntem' },
        'Location': { en: 'Location', ro: 'Locație' },
        'Gallery': { en: 'Gallery', ro: 'Galerie' },
        'Photo Gallery': { en: 'Photo Gallery', ro: 'Galerie Foto' },
        'Book Now': { en: 'Book Now', ro: 'Rezervă Acum' },
        'Contact': { en: 'Contact', ro: 'Contact' },
        'About': { en: 'About', ro: 'Despre' }
      };
      
      overrides.menuItems = overrides.menuItems.map((item: any) => {
        if (typeof item.label === 'string') {
          // Try to find a translation
          const translation = menuTranslations[item.label];
          return {
            ...item,
            label: translation || {
              en: item.label,
              ro: item.label // Needs manual translation if not found
            }
          };
        }
        return item;
      });
    }
    
    // Add migration status
    overrides._translationStatus = {
      needsManualTranslation: true,
      lastMigrated: new Date().toISOString()
    };
    
    // Write the migrated file
    fs.writeFileSync(filePath, JSON.stringify(overrides, null, 2));
    console.log(`✓ Migrated: ${path.basename(filePath)}`);
    
  } catch (error) {
    console.error(`✗ Error migrating ${filePath}:`, error);
  }
}

// Function to migrate template files
function migrateTemplateFile(filePath: string): void {
  console.log(`Migrating template file: ${filePath}`);
  
  try {
    const content = fs.readFileSync(filePath, 'utf8');
    const template = JSON.parse(content);
    
    // Migrate header menu items
    if (template.header && Array.isArray(template.header.menuItems)) {
      template.header.menuItems = template.header.menuItems.map((item: any) => ({
        ...item,
        label: typeof item.label === 'string' ? {
          en: item.label,
          ro: item.label // Should be manually translated based on common patterns
        } : item.label
      }));
    }
    
    // Apply common menu translations
    const menuTranslations: Record<string, { en: string; ro: string }> = {
      'Home': { en: 'Home', ro: 'Acasă' },
      'Property Details': { en: 'Property Details', ro: 'Detalii Proprietate' },
      'Location': { en: 'Location', ro: 'Locație' },
      'Gallery': { en: 'Gallery', ro: 'Galerie' },
      'About': { en: 'About', ro: 'Despre' },
      'Contact': { en: 'Contact', ro: 'Contact' },
      'Book Now': { en: 'Book Now', ro: 'Rezervă Acum' },
    };
    
    // Apply translations to menu items
    if (template.header && Array.isArray(template.header.menuItems)) {
      template.header.menuItems = template.header.menuItems.map((item: any) => {
        const label = typeof item.label === 'object' ? item.label.en : item.label;
        const translation = menuTranslations[label];
        
        return {
          ...item,
          label: translation || {
            en: label,
            ro: label
          }
        };
      });
    }
    
    // Migrate footer links
    if (template.footer && Array.isArray(template.footer.quickLinks)) {
      template.footer.quickLinks = template.footer.quickLinks.map((link: any) => {
        const label = typeof link.label === 'string' ? link.label : link.label.en;
        const translation = menuTranslations[label];
        
        return {
          ...link,
          label: translation || {
            en: label,
            ro: label
          }
        };
      });
    }
    
    // Add migration status
    template._translationStatus = {
      needsManualTranslation: false,
      lastMigrated: new Date().toISOString()
    };
    
    // Write the migrated file
    fs.writeFileSync(filePath, JSON.stringify(template, null, 2));
    console.log(`✓ Migrated: ${path.basename(filePath)}`);
    
  } catch (error) {
    console.error(`✗ Error migrating ${filePath}:`, error);
  }
}

// Main migration function
function runMigration(): void {
  console.log('Starting multilingual migration...\n');
  
  const firestoreDir = path.join(__dirname, '..', 'firestore');
  
  // Migrate properties
  const propertiesDir = path.join(firestoreDir, 'properties');
  const propertyFiles = fs.readdirSync(propertiesDir).filter(f => f.endsWith('.json'));
  
  console.log('Migrating property files...');
  propertyFiles.forEach(file => {
    migratePropertyFile(path.join(propertiesDir, file));
  });
  
  // Migrate property overrides
  const overridesDir = path.join(firestoreDir, 'propertyOverrides');
  const overrideFiles = fs.readdirSync(overridesDir).filter(f => f.endsWith('.json'));
  
  console.log('\nMigrating property override files...');
  overrideFiles.forEach(file => {
    migratePropertyOverrideFile(path.join(overridesDir, file));
  });
  
  // Migrate templates
  const templatesDir = path.join(firestoreDir, 'websiteTemplates');
  const templateFiles = fs.readdirSync(templatesDir).filter(f => f.endsWith('.json'));
  
  console.log('\nMigrating template files...');
  templateFiles.forEach(file => {
    migrateTemplateFile(path.join(templatesDir, file));
  });
  
  console.log('\n✓ Migration completed!');
  console.log('\nIMPORTANT: Please review the migrated files and manually translate the Romanian content marked with _translationStatus.');
}

// Run the migration
if (require.main === module) {
  runMigration();
}

export { migratePropertyFile, migratePropertyOverrideFile, migrateTemplateFile };