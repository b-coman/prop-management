#!/usr/bin/env node

/**
 * Comprehensive Firestore audit to check data structures across all collections
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

async function analyzeDocument(collectionName: string, docId: string): Promise<any> {
  try {
    const doc = await db.collection(collectionName).doc(docId).get();
    
    if (!doc.exists) {
      return { exists: false };
    }
    
    const data = doc.data();
    
    // Analyze structure
    const analysis = {
      exists: true,
      topLevelKeys: Object.keys(data || {}),
      hasVisiblePages: !!data?.visiblePages,
      hasVisibleBlocks: !!data?.visibleBlocks,
      hasHomepage: !!data?.homepage,
      hasPages: !!data?.pages,
      structure: 'unknown'
    };
    
    // Determine structure type
    if (data?.visiblePages && data?.homepage) {
      analysis.structure = 'hierarchical-multipage';
    } else if (data?.pages) {
      analysis.structure = 'template-pages';
    } else if (data?.visibleBlocks) {
      analysis.structure = 'flat-blocks';
    } else {
      analysis.structure = 'other';
    }
    
    return analysis;
  } catch (error) {
    return { exists: false, error: error.message };
  }
}

async function auditCollection(collectionName: string): Promise<void> {
  console.log(`\n=== ${collectionName.toUpperCase()} COLLECTION AUDIT ===`);
  
  try {
    const snapshot = await db.collection(collectionName).get();
    
    if (snapshot.empty) {
      console.log('(empty collection)');
      return;
    }
    
    for (const doc of snapshot.docs) {
      const analysis = await analyzeDocument(collectionName, doc.id);
      
      console.log(`\n📄 ${doc.id}:`);
      console.log(`   Structure: ${analysis.structure}`);
      console.log(`   Top-level keys: [${analysis.topLevelKeys?.join(', ') || 'none'}]`);
      
      if (analysis.hasVisiblePages) {
        const data = doc.data();
        console.log(`   ✅ visiblePages: [${data.visiblePages.join(', ')}]`);
        
        // Check each page structure
        if (data.visiblePages) {
          for (const pageName of data.visiblePages) {
            if (data[pageName]?.visibleBlocks) {
              console.log(`   📄 ${pageName}: [${data[pageName].visibleBlocks.join(', ')}]`);
            }
          }
        }
      }
      
      if (analysis.hasVisibleBlocks) {
        const data = doc.data();
        console.log(`   ⚠️ Top-level visibleBlocks: [${data.visibleBlocks.join(', ')}]`);
      }
      
      if (analysis.hasPages) {
        const data = doc.data();
        console.log(`   📋 Template pages: [${Object.keys(data.pages).join(', ')}]`);
      }
    }
  } catch (error) {
    console.error(`Error auditing collection:`, error);
  }
}

async function compareWithLocalFiles(): Promise<void> {
  console.log(`\n=== LOCAL FILES vs FIRESTORE COMPARISON ===`);
  
  // Check if we have local files
  const fs = require('fs');
  const localOverridesPath = path.join(__dirname, '..', 'firestore', 'propertyOverrides');
  
  if (fs.existsSync(localOverridesPath)) {
    const localFiles = fs.readdirSync(localOverridesPath).filter(f => f.endsWith('.json'));
    
    for (const filename of localFiles) {
      const docId = filename.replace('.json', '');
      console.log(`\n🔍 Comparing ${docId}:`);
      
      try {
        // Read local file
        const localData = JSON.parse(fs.readFileSync(path.join(localOverridesPath, filename), 'utf8'));
        const localAnalysis = {
          hasVisiblePages: !!localData.visiblePages,
          hasVisibleBlocks: !!localData.visibleBlocks,
          hasHomepage: !!localData.homepage,
          topLevelKeys: Object.keys(localData)
        };
        
        // Get Firestore data
        const firestoreAnalysis = await analyzeDocument('propertyOverrides', docId);
        
        console.log(`   Local file: ${localAnalysis.hasVisiblePages ? 'hierarchical' : 'flat'}`);
        console.log(`   Firestore: ${firestoreAnalysis.structure}`);
        
        if (localAnalysis.hasVisiblePages !== firestoreAnalysis.hasVisiblePages) {
          console.log(`   ❌ MISMATCH: Different visiblePages structure`);
        } else {
          console.log(`   ✅ MATCH: Same structure type`);
        }
        
      } catch (error) {
        console.log(`   ❌ Error comparing: ${error.message}`);
      }
    }
  } else {
    console.log('No local propertyOverrides directory found');
  }
}

async function main() {
  console.log('=== COMPREHENSIVE FIRESTORE DATA STRUCTURE AUDIT ===');
  
  // Audit all relevant collections
  await auditCollection('properties');
  await auditCollection('propertyOverrides');
  await auditCollection('websiteTemplates');
  
  // Compare with local files
  await compareWithLocalFiles();
  
  console.log('\n=== AUDIT COMPLETE ===');
  
  console.log('\n📊 SUMMARY:');
  console.log('- properties: Contains basic property data');
  console.log('- propertyOverrides: Contains page structure and content overrides'); 
  console.log('- websiteTemplates: Contains template definitions');
  console.log('- Local files: May be out of sync with Firestore data');
  console.log('\n🎯 RECOMMENDATION: Always verify Firestore as source of truth for Task #44 type work');
}

main().catch(console.error);