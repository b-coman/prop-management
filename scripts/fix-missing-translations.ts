#!/usr/bin/env node

/**
 * Script to fix missing translations in property documents
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

// Common translations for house rules
const houseRuleTranslations: { [key: string]: string } = {
  'No smoking indoors': 'Fumatul interzis în interior',
  'No loud parties after 10 PM': 'Fără petreceri zgomotoase după ora 22:00',
  'Pets considered upon request': 'Animalele de companie sunt acceptate la cerere',
  'Check-in after 3 PM': 'Check-in după ora 15:00',
  'Check-out before 11 AM': 'Check-out înainte de ora 11:00',
  'Respect the neighbors': 'Respectați vecinii',
  'Keep the property clean': 'Păstrați proprietatea curată'
};

// Common translations for cancellation policies
const cancellationPolicyTranslations: { [key: string]: { [lang: string]: string } } = {
  'Flexible: Full refund 1 day prior to arrival.': {
    en: 'Flexible: Full refund 1 day prior to arrival.',
    ro: 'Flexibilă: Rambursare completă cu 1 zi înainte de sosire.'
  },
  'Moderate: Full refund 5 days prior to arrival.': {
    en: 'Moderate: Full refund 5 days prior to arrival.',
    ro: 'Moderată: Rambursare completă cu 5 zile înainte de sosire.'
  },
  'Strict: Full refund 14 days prior to arrival.': {
    en: 'Strict: Full refund 14 days prior to arrival.',
    ro: 'Strictă: Rambursare completă cu 14 zile înainte de sosire.'
  }
};

async function fixPropertyTranslations(propertyId: string, filePath: string) {
  console.log(`\nFixing translations for ${propertyId}...`);
  
  try {
    // Read the JSON file
    const content = JSON.parse(fs.readFileSync(filePath, 'utf8'));
    
    // Fix houseRules
    if (Array.isArray(content.houseRules)) {
      console.log('  Converting houseRules to multilingual...');
      content.houseRules = content.houseRules.map((rule: string) => {
        const roTranslation = houseRuleTranslations[rule] || rule;
        return {
          en: rule,
          ro: roTranslation
        };
      });
    }
    
    // Fix cancellationPolicy
    if (typeof content.cancellationPolicy === 'string') {
      console.log('  Converting cancellationPolicy to multilingual...');
      const policy = content.cancellationPolicy;
      if (cancellationPolicyTranslations[policy]) {
        content.cancellationPolicy = cancellationPolicyTranslations[policy];
      } else {
        content.cancellationPolicy = {
          en: policy,
          ro: policy // Will need manual translation
        };
      }
    }
    
    // Check for other fields that might need translation
    const fieldsToCheck = ['checkInInstructions', 'specialInstructions', 'neighborhoodDescription'];
    fieldsToCheck.forEach(field => {
      if (typeof content[field] === 'string') {
        console.log(`  Converting ${field} to multilingual...`);
        content[field] = {
          en: content[field],
          ro: content[field] // Will need manual translation
        };
      }
    });
    
    // Save the updated file
    fs.writeFileSync(filePath, JSON.stringify(content, null, 2));
    console.log('  ✓ File updated');
    
    // Upload to Firestore
    await db.collection('properties').doc(propertyId).set(content);
    console.log('  ✓ Uploaded to Firestore');
    
  } catch (error) {
    console.error(`  ✗ Error processing ${propertyId}:`, error);
  }
}

async function main() {
  console.log('Fixing missing translations in property documents...\n');
  
  const propertiesDir = path.join(__dirname, '..', 'firestore', 'properties');
  const propertyFiles = fs.readdirSync(propertiesDir).filter(f => f.endsWith('.json') && !f.endsWith('.obsolete'));
  
  for (const file of propertyFiles) {
    const propertyId = path.basename(file, '.json');
    const filePath = path.join(propertiesDir, file);
    await fixPropertyTranslations(propertyId, filePath);
  }
  
  console.log('\n✓ All property translations fixed!');
  console.log('\nNote: Some fields marked with identical Romanian text need manual translation.');
}

main().catch(console.error);