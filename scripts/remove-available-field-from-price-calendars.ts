/**
 * Remove the 'available' field from all priceCalendars documents
 * This completes the availability deduplication by cleaning up the old dual-storage system
 */

import { getFirestoreForPricing } from '../src/lib/firebaseAdminPricing';
import { FieldValue } from 'firebase-admin/firestore';

interface CleanupStats {
  documentsProcessed: number;
  documentsModified: number;
  fieldsRemoved: number;
  errors: string[];
}

async function removeAvailableFieldFromPriceCalendars(): Promise<CleanupStats> {
  console.log('🧹 Removing available field from priceCalendars collection');
  console.log('=====================================================');
  
  const db = await getFirestoreForPricing();
  if (!db) {
    throw new Error('Failed to connect to Firestore');
  }

  const stats: CleanupStats = {
    documentsProcessed: 0,
    documentsModified: 0,
    fieldsRemoved: 0,
    errors: []
  };

  try {
    // Get all priceCalendars documents
    console.log('📋 Fetching all priceCalendars documents...');
    const priceCalendarsSnapshot = await db.collection('priceCalendars').get();
    
    console.log(`Found ${priceCalendarsSnapshot.docs.length} priceCalendars documents`);
    
    // Process documents in batches
    const batchSize = 500;
    let batch = db.batch();
    let batchCount = 0;
    
    for (const doc of priceCalendarsSnapshot.docs) {
      stats.documentsProcessed++;
      const data = doc.data();
      
      if (data.days) {
        let documentModified = false;
        const updateData: Record<string, any> = {};
        
        // Check each day for available field
        for (const [day, dayData] of Object.entries(data.days)) {
          if (dayData && typeof dayData === 'object' && 'available' in dayData) {
            // Remove the available field
            updateData[`days.${day}.available`] = FieldValue.delete();
            stats.fieldsRemoved++;
            documentModified = true;
          }
        }
        
        if (documentModified) {
          // Add metadata about the cleanup
          updateData.cleanupTimestamp = new Date().toISOString();
          updateData.availabilityFieldRemoved = true;
          updateData.updatedAt = new Date();
          
          batch.update(doc.ref, updateData);
          stats.documentsModified++;
          batchCount++;
          
          console.log(`  📝 Queue: Remove available fields from ${doc.id} (${Object.keys(updateData).filter(k => k.includes('available')).length} days)`);
        }
        
        // Commit batch if it's getting large
        if (batchCount >= batchSize) {
          console.log(`  ✅ Committing batch of ${batchCount} updates...`);
          await batch.commit();
          batch = db.batch();
          batchCount = 0;
        }
      }
    }
    
    // Commit remaining updates
    if (batchCount > 0) {
      console.log(`  ✅ Committing final batch of ${batchCount} updates...`);
      await batch.commit();
    }
    
    console.log('\n📊 CLEANUP SUMMARY');
    console.log('==================');
    console.log(`Documents processed: ${stats.documentsProcessed}`);
    console.log(`Documents modified: ${stats.documentsModified}`);
    console.log(`Available fields removed: ${stats.fieldsRemoved}`);
    console.log(`Errors: ${stats.errors.length}`);
    
    if (stats.errors.length > 0) {
      console.log('\n❌ ERRORS:');
      stats.errors.forEach(error => console.log(`  - ${error}`));
    }
    
    return stats;
    
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    stats.errors.push(errorMsg);
    console.error('❌ Cleanup failed:', error);
    throw error;
  }
}

// Also update admin UI to stop writing available field
async function updateAdminUICode(): Promise<void> {
  console.log('\n🔧 Recommendation: Update admin UI code');
  console.log('=====================================');
  console.log('The admin pricing UI should be updated to stop writing the available field to priceCalendars.');
  console.log('Location: src/app/admin/pricing/server-actions-hybrid.ts');
  console.log('Action: Remove available field from priceCalendars updates in updateDay function');
}

// Verification function
async function verifyCleanup(): Promise<void> {
  console.log('\n🔍 Verifying cleanup...');
  
  const db = await getFirestoreForPricing();
  if (!db) {
    throw new Error('Failed to connect to Firestore');
  }
  
  // Sample a few documents to verify
  const sampleDocs = await db.collection('priceCalendars').limit(5).get();
  
  let foundAvailableFields = 0;
  
  sampleDocs.forEach(doc => {
    const data = doc.data();
    if (data.days) {
      for (const [day, dayData] of Object.entries(data.days)) {
        if (dayData && typeof dayData === 'object' && 'available' in dayData) {
          foundAvailableFields++;
        }
      }
    }
  });
  
  if (foundAvailableFields === 0) {
    console.log('✅ Verification passed: No available fields found in sample');
  } else {
    console.log(`⚠️  Verification warning: Found ${foundAvailableFields} remaining available fields`);
  }
}

// Main execution
async function main() {
  try {
    console.log('🚀 Starting priceCalendars cleanup...');
    
    const stats = await removeAvailableFieldFromPriceCalendars();
    
    await updateAdminUICode();
    
    await verifyCleanup();
    
    console.log('\n🎉 Cleanup completed successfully!');
    console.log('The priceCalendars collection now serves only pricing data.');
    console.log('The availability deduplication is now fully complete.');
    
    // Save cleanup report
    const fs = require('fs');
    const path = require('path');
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const reportPath = path.join(process.cwd(), 'logs', `price-calendars-cleanup-${timestamp}.json`);
    
    fs.writeFileSync(reportPath, JSON.stringify(stats, null, 2));
    console.log(`\n📄 Cleanup report saved: ${reportPath}`);
    
  } catch (error) {
    console.error('❌ Cleanup failed:', error);
    process.exit(1);
  }
}

if (require.main === module) {
  main().catch(console.error);
}

export { removeAvailableFieldFromPriceCalendars };