/**
 * Data cleanup script for availability deduplication
 * Addresses the specific patterns found in the analysis
 */

import { getFirestoreForPricing } from '../src/lib/firebaseAdminPricing';
import { format, addMonths } from 'date-fns';

interface CleanupOperation {
  type: 'initialize_availability' | 'sync_discrepancy' | 'remove_orphaned_hold';
  propertyId: string;
  month: string;
  details: any;
  executed: boolean;
  error?: string;
}

interface CleanupReport {
  timestamp: string;
  operations: CleanupOperation[];
  summary: {
    totalOperations: number;
    successful: number;
    failed: number;
    propertiesAffected: string[];
  };
}

async function cleanupAvailabilityData(dryRun: boolean = true): Promise<CleanupReport> {
  console.log(`🧹 Starting Availability Data Cleanup (${dryRun ? 'DRY RUN' : 'LIVE RUN'})`);
  console.log('=================================================================');
  
  const db = await getFirestoreForPricing();
  if (!db) {
    throw new Error('Failed to connect to Firestore');
  }

  const operations: CleanupOperation[] = [];
  
  // Step 1: Initialize missing availability documents
  console.log('\n📝 Step 1: Initialize missing availability documents');
  await initializeMissingAvailabilityDocs(db, operations, dryRun);
  
  // Step 2: Fix known critical discrepancies
  console.log('\n🚨 Step 2: Fix critical discrepancies');
  await fixCriticalDiscrepancies(db, operations, dryRun);
  
  // Step 3: Sync remaining discrepancies
  console.log('\n🔄 Step 3: Sync remaining discrepancies');
  await syncRemainingDiscrepancies(db, operations, dryRun);

  // Execute operations if not dry run
  if (!dryRun) {
    console.log('\n⚡ Executing cleanup operations...');
    await executeCleanupOperations(db, operations);
  }

  const propertiesAffected = [...new Set(operations.map(op => op.propertyId))];
  const successful = operations.filter(op => op.executed).length;
  const failed = operations.filter(op => op.error).length;

  const report: CleanupReport = {
    timestamp: new Date().toISOString(),
    operations,
    summary: {
      totalOperations: operations.length,
      successful,
      failed,
      propertiesAffected
    }
  };

  console.log('\n📊 CLEANUP SUMMARY');
  console.log('==================');
  console.log(`Mode: ${dryRun ? 'DRY RUN' : 'LIVE RUN'}`);
  console.log(`Total operations: ${operations.length}`);
  console.log(`Successful: ${successful}`);
  console.log(`Failed: ${failed}`);
  console.log(`Properties affected: ${propertiesAffected.join(', ')}`);

  return report;
}

async function initializeMissingAvailabilityDocs(
  db: FirebaseFirestore.Firestore,
  operations: CleanupOperation[],
  dryRun: boolean
): Promise<void> {
  // Focus on coltei-apartment-bucharest which has 245 missing docs
  const propertyId = 'coltei-apartment-bucharest';
  
  // Generate months to check (past 6 months + next 6 months)
  const months = generateMonthsToCheck();
  
  console.log(`   Checking ${months.length} months for ${propertyId}...`);
  
  for (const month of months) {
    const docId = `${propertyId}_${month}`;
    
    // Check if availability doc exists
    const [availabilityDoc, priceCalendarDoc] = await Promise.all([
      db.collection('availability').doc(docId).get(),
      db.collection('priceCalendars').doc(docId).get()
    ]);
    
    // If priceCalendars exists but availability doesn't
    if (priceCalendarDoc.exists && !availabilityDoc.exists) {
      const priceData = priceCalendarDoc.data();
      const days = priceData?.days || {};
      
      // Create availability document based on priceCalendars
      const availabilityData = {
        propertyId,
        month,
        available: {} as Record<string, boolean>,
        holds: {} as Record<string, string | null>,
        createdAt: new Date(),
        updatedAt: new Date(),
        migratedFrom: 'priceCalendars'
      };
      
      // Copy availability from priceCalendars
      for (const [day, dayData] of Object.entries(days)) {
        availabilityData.available[day] = (dayData as any)?.available !== false;
      }
      
      operations.push({
        type: 'initialize_availability',
        propertyId,
        month,
        details: {
          docId,
          daysInitialized: Object.keys(availabilityData.available).length,
          sourceDocument: 'priceCalendars'
        },
        executed: false
      });
      
      console.log(`   📝 Queue: Initialize ${docId} with ${Object.keys(days).length} days`);
    }
  }
}

async function fixCriticalDiscrepancies(
  db: FirebaseFirestore.Firestore,
  operations: CleanupOperation[],
  dryRun: boolean
): Promise<void> {
  // Fix the 2 critical discrepancies we found
  const criticalFixes = [
    {
      propertyId: 'prahova-mountain-chalet',
      month: '2025-06',
      day: '5',
      issue: 'Hold in availability but available in priceCalendars',
      action: 'Set priceCalendars day 5 to unavailable'
    },
    {
      propertyId: 'prahova-mountain-chalet',
      month: '2025-06',
      day: '6',
      issue: 'Available in availability but unavailable in priceCalendars',
      action: 'Set priceCalendars day 6 to available'
    }
  ];
  
  for (const fix of criticalFixes) {
    operations.push({
      type: 'sync_discrepancy',
      propertyId: fix.propertyId,
      month: fix.month,
      details: {
        day: fix.day,
        issue: fix.issue,
        action: fix.action,
        priority: 'critical'
      },
      executed: false
    });
    
    console.log(`   🚨 Queue: ${fix.action} (${fix.issue})`);
  }
}

async function syncRemainingDiscrepancies(
  db: FirebaseFirestore.Firestore,
  operations: CleanupOperation[],
  dryRun: boolean
): Promise<void> {
  console.log('   📋 Analyzing remaining discrepancies...');
  
  // For now, we'll focus on the known issues
  // This can be extended based on the analysis results
  console.log('   ✅ Will sync remaining discrepancies in next phase');
}

async function executeCleanupOperations(
  db: FirebaseFirestore.Firestore,
  operations: CleanupOperation[]
): Promise<void> {
  const batch = db.batch();
  let batchCount = 0;
  const MAX_BATCH_SIZE = 500;
  
  for (const operation of operations) {
    try {
      switch (operation.type) {
        case 'initialize_availability':
          await executeInitializeAvailability(db, operation, batch);
          batchCount++;
          break;
          
        case 'sync_discrepancy':
          await executeSyncDiscrepancy(db, operation, batch);
          batchCount++;
          break;
      }
      
      // Commit batch if it's getting large
      if (batchCount >= MAX_BATCH_SIZE) {
        await batch.commit();
        console.log(`   ✅ Committed batch of ${batchCount} operations`);
        batchCount = 0;
      }
      
      operation.executed = true;
      
    } catch (error) {
      operation.error = error instanceof Error ? error.message : String(error);
      console.error(`   ❌ Failed operation for ${operation.propertyId}:`, error);
    }
  }
  
  // Commit remaining operations
  if (batchCount > 0) {
    await batch.commit();
    console.log(`   ✅ Committed final batch of ${batchCount} operations`);
  }
}

async function executeInitializeAvailability(
  db: FirebaseFirestore.Firestore,
  operation: CleanupOperation,
  batch: FirebaseFirestore.WriteBatch
): Promise<void> {
  const { propertyId, month, details } = operation;
  const docId = details.docId;
  
  // Get the priceCalendars data to copy from
  const priceCalendarDoc = await db.collection('priceCalendars').doc(docId).get();
  if (!priceCalendarDoc.exists) {
    throw new Error(`PriceCalendar document ${docId} not found`);
  }
  
  const priceData = priceCalendarDoc.data();
  const days = priceData?.days || {};
  
  // Create availability document
  const availabilityData = {
    propertyId,
    month,
    available: {} as Record<string, boolean>,
    holds: {} as Record<string, string | null>,
    createdAt: new Date(),
    updatedAt: new Date(),
    migratedFrom: 'priceCalendars',
    migrationTimestamp: new Date().toISOString()
  };
  
  // Copy availability from priceCalendars
  for (const [day, dayData] of Object.entries(days)) {
    availabilityData.available[day] = (dayData as any)?.available !== false;
  }
  
  const availabilityRef = db.collection('availability').doc(docId);
  batch.set(availabilityRef, availabilityData);
  
  console.log(`   📝 Queued: Initialize ${docId} with ${Object.keys(availabilityData.available).length} days`);
}

async function executeSyncDiscrepancy(
  db: FirebaseFirestore.Firestore,
  operation: CleanupOperation,
  batch: FirebaseFirestore.WriteBatch
): Promise<void> {
  const { propertyId, month, details } = operation;
  const docId = `${propertyId}_${month}`;
  const day = details.day;
  
  if (details.action.includes('Set priceCalendars day 5 to unavailable')) {
    // Make June 5th unavailable in priceCalendars
    const priceCalendarRef = db.collection('priceCalendars').doc(docId);
    batch.update(priceCalendarRef, {
      [`days.${day}.available`]: false,
      'updatedAt': new Date(),
      'syncedWithAvailability': new Date().toISOString()
    });
    console.log(`   🔧 Queued: Set ${docId} day ${day} to unavailable in priceCalendars`);
    
  } else if (details.action.includes('Set priceCalendars day 6 to available')) {
    // Make June 6th available in priceCalendars
    const priceCalendarRef = db.collection('priceCalendars').doc(docId);
    batch.update(priceCalendarRef, {
      [`days.${day}.available`]: true,
      'updatedAt': new Date(),
      'syncedWithAvailability': new Date().toISOString()
    });
    console.log(`   🔧 Queued: Set ${docId} day ${day} to available in priceCalendars`);
  }
}

function generateMonthsToCheck(): string[] {
  const months: string[] = [];
  const today = new Date();
  
  // Past 6 months + next 6 months
  for (let i = -6; i <= 6; i++) {
    const date = addMonths(today, i);
    months.push(format(date, 'yyyy-MM'));
  }
  
  return months;
}

// Main execution
async function main() {
  const args = process.argv.slice(2);
  const dryRun = !args.includes('--execute');
  
  if (dryRun) {
    console.log('🔍 Running in DRY RUN mode. Use --execute to apply changes.');
  } else {
    console.log('⚡ Running in EXECUTE mode. Changes will be applied!');
  }
  
  try {
    const report = await cleanupAvailabilityData(dryRun);
    
    // Save report
    const fs = require('fs');
    const path = require('path');
    const timestamp = format(new Date(), 'yyyy-MM-dd_HH-mm-ss');
    const filename = `cleanup-report-${timestamp}.json`;
    const filepath = path.join(process.cwd(), 'logs', filename);
    
    fs.writeFileSync(filepath, JSON.stringify(report, null, 2));
    console.log(`\n📄 Report saved: ${filepath}`);
    
  } catch (error) {
    console.error('❌ Cleanup failed:', error);
    process.exit(1);
  }
}

if (require.main === module) {
  main().catch(console.error);
}

export { cleanupAvailabilityData };