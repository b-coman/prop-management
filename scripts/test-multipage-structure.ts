// scripts/test-multipage-structure.ts
import { initializeApp, cert, App } from 'firebase-admin/app';
import { getFirestore, Firestore } from 'firebase-admin/firestore';
import { readFileSync } from 'fs';
import { resolve } from 'path';
import * as dotenv from 'dotenv';
import { z } from 'zod';
import { 
  websiteTemplateSchema, 
  propertyOverridesSchema 
} from '../src/lib/overridesSchemas-multipage';

// Load environment variables
dotenv.config({ path: '.env.local' });

// Initialize Firebase Admin
let app: App;
let db: Firestore;

async function initializeFirebase() {
  try {
    // For local development, use a local service account file
    if (process.env.FIREBASE_ADMIN_SERVICE_ACCOUNT_PATH) {
      const serviceAccount = require(process.env.FIREBASE_ADMIN_SERVICE_ACCOUNT_PATH);
      app = initializeApp({
        credential: cert(serviceAccount),
        projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID
      });
    } 
    // For production, use the JSON string from environment variables
    else if (process.env.FIREBASE_ADMIN_SERVICE_ACCOUNT_JSON) {
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

async function testTemplate() {
  try {
    // Template and overrides file paths
    const templatePath = resolve(__dirname, '../firestore/websiteTemplates/holiday-house-multipage.json');
    const overridesPath = resolve(__dirname, '../firestore/propertyOverrides/prahova-mountain-chalet-multipage.json');
    
    console.log('🧪 Testing template validation...');
    console.log(`📦 Reading template file: ${templatePath}`);
    const templateData = JSON.parse(readFileSync(templatePath, 'utf8'));
    
    // Validate template against the schema
    try {
      websiteTemplateSchema.parse(templateData);
      console.log('✅ Template validation passed!');
      
      // Log some template stats
      const pageCount = Object.keys(templateData.pages).length;
      const blockCount = Object.keys(templateData.defaults).length;
      
      console.log(`📊 Template Statistics:`);
      console.log(`  • Template ID: ${templateData.templateId}`);
      console.log(`  • Pages: ${pageCount}`);
      console.log(`  • Total blocks: ${blockCount}`);
      console.log(`  • Pages defined: ${Object.keys(templateData.pages).join(', ')}`);
    } catch (error) {
      console.error('❌ Template validation failed:', error);
      return;
    }
    
    console.log('\n🧪 Testing overrides validation...');
    console.log(`📦 Reading overrides file: ${overridesPath}`);
    const overridesData = JSON.parse(readFileSync(overridesPath, 'utf8'));
    
    // Validate overrides against the schema
    try {
      propertyOverridesSchema.parse(overridesData);
      console.log('✅ Overrides validation passed!');
      
      // Log some overrides stats
      const visiblePages = overridesData.visiblePages.length;
      
      console.log(`📊 Overrides Statistics:`);
      console.log(`  • Visible pages: ${visiblePages}`);
      console.log(`  • Pages enabled: ${overridesData.visiblePages.join(', ')}`);
      console.log(`  • Custom menu items: ${overridesData.menuItems?.length || 0}`);
      
      // Check for page overrides
      const pagesWithOverrides = Object.keys(overridesData)
        .filter(key => overridesData.visiblePages.includes(key));
      
      console.log(`  • Pages with overrides: ${pagesWithOverrides.join(', ')}`);
      
      // Verify all visible pages have corresponding template definitions
      const missingPages = overridesData.visiblePages.filter(
        page => !templateData.pages[page]
      );
      
      if (missingPages.length > 0) {
        console.warn(`⚠️ Warning: The following pages are marked as visible but not defined in the template: ${missingPages.join(', ')}`);
      } else {
        console.log('✅ All visible pages are properly defined in the template.');
      }
    } catch (error) {
      console.error('❌ Overrides validation failed:', error);
    }
    
    console.log('\n🧪 Checking pages and blocks consistency...');
    
    // Check if all blocks referenced in pages have default content
    const blocksWithoutDefaults = [];
    
    for (const [pageName, page] of Object.entries(templateData.pages)) {
      for (const block of page.blocks) {
        if (templateData.defaults[block.id] === undefined) {
          blocksWithoutDefaults.push(`${pageName}:${block.id}`);
        }
      }
    }
    
    if (blocksWithoutDefaults.length > 0) {
      console.warn(`⚠️ Warning: The following blocks are used in pages but have no default content: ${blocksWithoutDefaults.join(', ')}`);
    } else {
      console.log('✅ All blocks used in pages have corresponding default content.');
    }
    
    // Test complete
    console.log('\n🎉 Multi-page structure validation complete!');
  } catch (error) {
    console.error('❌ Test failed with an unexpected error:', error);
  }
}

async function main() {
  try {
    await initializeFirebase();
    await testTemplate();
  } catch (error) {
    console.error('❌ Script failed:', error);
  } finally {
    process.exit(0);
  }
}

main();