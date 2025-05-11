// scripts/update-multipage-template.ts
import { initializeApp, cert, App } from 'firebase-admin/app';
import { getFirestore, Firestore } from 'firebase-admin/firestore';
import { readFileSync } from 'fs';
import { resolve } from 'path';
import * as dotenv from 'dotenv';

// Load environment variables
dotenv.config({ path: '.env.local' });

// Template and overrides file paths
const TEMPLATE_PATH = resolve(__dirname, '../firestore/websiteTemplates/holiday-house-multipage.json');
const OVERRIDES_PATH = resolve(__dirname, '../firestore/propertyOverrides/prahova-mountain-chalet-multipage.json');

// Initialize Firebase Admin
let app: App;
let db: Firestore;

async function initializeFirebase() {
  try {
    if (process.env.FIREBASE_ADMIN_SERVICE_ACCOUNT_PATH) {
      const serviceAccount = require(process.env.FIREBASE_ADMIN_SERVICE_ACCOUNT_PATH);
      app = initializeApp({
        credential: cert(serviceAccount),
        projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID
      });
    } else if (process.env.FIREBASE_ADMIN_SERVICE_ACCOUNT_JSON) {
      const serviceAccount = JSON.parse(process.env.FIREBASE_ADMIN_SERVICE_ACCOUNT_JSON);
      app = initializeApp({
        credential: cert(serviceAccount),
        projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID
      });
    } else {
      throw new Error('Firebase Admin credentials not found');
    }

    db = getFirestore(app);
    console.log('✅ Firebase Admin initialized successfully.');
  } catch (error) {
    console.error('❌ Failed to initialize Firebase Admin:', error);
    process.exit(1);
  }
}

async function uploadTemplate() {
  try {
    console.log(`📦 Reading template file: ${TEMPLATE_PATH}`);
    const templateData = JSON.parse(readFileSync(TEMPLATE_PATH, 'utf8'));
    
    // Extract the template ID from the data
    const { templateId } = templateData;
    
    // Check if the templateId exists
    if (!templateId) {
      throw new Error('Template ID is missing from the template data');
    }
    
    console.log(`📤 Uploading template: ${templateId}`);
    
    // Set the document with merge to preserve any existing fields not in the template
    await db.collection('websiteTemplates').doc(templateId).set(templateData, { merge: true });
    
    console.log(`✅ Template "${templateId}" uploaded successfully.`);
    return templateId;
  } catch (error) {
    console.error('❌ Failed to upload template:', error);
    throw error;
  }
}

async function uploadOverrides(templateId: string) {
  try {
    console.log(`📦 Reading overrides file: ${OVERRIDES_PATH}`);
    const overridesData = JSON.parse(readFileSync(OVERRIDES_PATH, 'utf8'));
    
    // The document ID is prahova-mountain-chalet for this property
    const propertySlug = 'prahova-mountain-chalet';
    
    console.log(`📤 Uploading overrides for property: ${propertySlug}`);
    
    // Set the document with merge to preserve any existing fields not in the overrides
    await db.collection('propertyOverrides').doc(propertySlug).set(overridesData, { merge: true });
    
    console.log(`✅ Overrides for "${propertySlug}" uploaded successfully.`);
    
    // Now ensure the property has the correct template ID if needed
    const propertyRef = db.collection('properties').doc(propertySlug);
    const propertyDoc = await propertyRef.get();
    
    if (propertyDoc.exists) {
      // Only update if the template ID is different
      if (propertyDoc.data()?.templateId !== templateId) {
        await propertyRef.update({ 
          templateId,
          updatedAt: new Date()
        });
        console.log(`✅ Updated property "${propertySlug}" to use template "${templateId}".`);
      } else {
        console.log(`ℹ️ Property "${propertySlug}" already using template "${templateId}".`);
      }
    } else {
      console.warn(`⚠️ Property "${propertySlug}" not found in the database.`);
    }
  } catch (error) {
    console.error('❌ Failed to upload overrides:', error);
    throw error;
  }
}

async function main() {
  try {
    await initializeFirebase();
    const templateId = await uploadTemplate();
    await uploadOverrides(templateId);
    console.log('✅ Template and overrides updated successfully.');
  } catch (error) {
    console.error('❌ Script failed:', error);
  } finally {
    process.exit(0);
  }
}

main();