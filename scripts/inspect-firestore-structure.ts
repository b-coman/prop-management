#!/usr/bin/env node

/**
 * Script to inspect actual Firestore data structure for propertyOverrides
 */

import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import * as path from 'path';
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
  require('fs').readFileSync(serviceAccountPath, 'utf8')
);

initializeApp({
  credential: cert(serviceAccount)
});

const db = getFirestore();

async function inspectPropertyOverrides(slug: string): Promise<void> {
  console.log(`\n=== Firestore Structure for propertyOverrides/${slug} ===`);
  
  try {
    const doc = await db.collection('propertyOverrides').doc(slug).get();
    
    if (!doc.exists) {
      console.log('Document does not exist');
      return;
    }
    
    const data = doc.data();
    console.log('Document structure:');
    console.log(JSON.stringify(data, null, 2));
    
    // Analyze structure
    console.log('\n=== Structure Analysis ===');
    console.log('Top-level keys:', Object.keys(data || {}));
    
    // Check for hierarchical vs flat structure
    if (data?.homepage) {
      console.log('✅ HIERARCHICAL: Has homepage structure');
      console.log('Homepage keys:', Object.keys(data.homepage));
      if (data.homepage.visibleBlocks) {
        console.log('Homepage visible blocks:', data.homepage.visibleBlocks);
      }
    } else if (data?.visibleBlocks) {
      console.log('❌ FLAT: Has top-level visibleBlocks');
      console.log('Visible blocks:', data.visibleBlocks);
    }
    
    if (data?.visiblePages) {
      console.log('✅ MULTIPAGE: Has visiblePages array');
      console.log('Visible pages:', data.visiblePages);
    }
    
  } catch (error) {
    console.error(`Error inspecting document:`, error);
  }
}

async function inspectWebsiteTemplate(templateId: string): Promise<void> {
  console.log(`\n=== Firestore Structure for websiteTemplates/${templateId} ===`);
  
  try {
    const doc = await db.collection('websiteTemplates').doc(templateId).get();
    
    if (!doc.exists) {
      console.log('Document does not exist');
      return;
    }
    
    const data = doc.data();
    console.log('Document structure:');
    console.log(JSON.stringify(data, null, 2));
    
  } catch (error) {
    console.error(`Error inspecting template:`, error);
  }
}

async function main() {
  console.log('=== FIRESTORE DATA STRUCTURE INVESTIGATION ===');
  
  // Inspect the property overrides we know exist
  await inspectPropertyOverrides('prahova-mountain-chalet');
  
  // Inspect the website template
  await inspectWebsiteTemplate('holiday-house');
  
  console.log('\n=== INVESTIGATION COMPLETE ===');
}

main().catch(console.error);