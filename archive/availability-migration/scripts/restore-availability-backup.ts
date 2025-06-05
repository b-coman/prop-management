/**
 * @fileoverview Backup restoration script for availability data
 * 
 * This script can restore individual documents or entire backup sets
 * created during the cleanup process.
 */

import { getFirestoreForPricing } from '../src/lib/firebaseAdminPricing';
import * as fs from 'fs';
import * as path from 'path';

interface BackupDocument {
  collection: string;
  docId: string;
  timestamp: string;
  data: any;
}

interface RestoreOperation {
  backupFile: string;
  collection: string;
  docId: string;
  status: 'success' | 'failed' | 'skipped';
  error?: string;
}

interface RestoreReport {
  timestamp: string;
  backupLocation: string;
  operations: RestoreOperation[];
  summary: {
    totalFiles: number;
    successful: number;
    failed: number;
    skipped: number;
  };
}

async function restoreFromBackup(
  backupLocation: string,
  options: {
    dryRun?: boolean;
    specificFiles?: string[];
    collections?: string[];
  } = {}
): Promise<RestoreReport> {
  console.log('🔄 Starting Availability Data Restoration');
  console.log('=========================================');
  
  if (options.dryRun !== false) {
    console.log('🔍 DRY RUN MODE - No changes will be made');
  } else {
    console.log('⚠️  LIVE MODE - Changes will be made to production data!');
    console.log('Press Ctrl+C within 10 seconds to cancel...');
    await new Promise(resolve => setTimeout(resolve, 10000));
  }

  const db = await getFirestoreForPricing();
  if (!db) {
    throw new Error('Failed to connect to Firestore');
  }

  // Validate backup location
  if (!fs.existsSync(backupLocation)) {
    throw new Error(`Backup location does not exist: ${backupLocation}`);
  }

  // Get all backup files
  const backupFiles = getBackupFiles(backupLocation, options);
  console.log(`📁 Found ${backupFiles.length} backup files to process`);

  const operations: RestoreOperation[] = [];

  // Process each backup file
  for (const backupFile of backupFiles) {
    try {
      const backupPath = path.join(backupLocation, backupFile);
      const backupData: BackupDocument = JSON.parse(fs.readFileSync(backupPath, 'utf8'));

      console.log(`📄 Processing: ${backupFile}`);
      console.log(`   Collection: ${backupData.collection}`);
      console.log(`   Document: ${backupData.docId}`);
      console.log(`   Timestamp: ${backupData.timestamp}`);

      // Validate backup data
      if (!backupData.collection || !backupData.docId || !backupData.data) {
        operations.push({
          backupFile,
          collection: backupData.collection || 'unknown',
          docId: backupData.docId || 'unknown',
          status: 'skipped',
          error: 'Invalid backup file format'
        });
        continue;
      }

      // Check if document currently exists
      const currentDoc = await db.collection(backupData.collection).doc(backupData.docId).get();
      
      if (currentDoc.exists) {
        console.log(`   ⚠️  Document currently exists - will overwrite`);
      } else {
        console.log(`   ℹ️  Document does not exist - will create`);
      }

      // Restore the document
      if (options.dryRun !== false) {
        console.log(`   🔍 Would restore document ${backupData.docId}`);
        operations.push({
          backupFile,
          collection: backupData.collection,
          docId: backupData.docId,
          status: 'success'
        });
      } else {
        await db.collection(backupData.collection).doc(backupData.docId).set(backupData.data);
        console.log(`   ✅ Restored document ${backupData.docId}`);
        
        operations.push({
          backupFile,
          collection: backupData.collection,
          docId: backupData.docId,
          status: 'success'
        });
      }

    } catch (error) {
      console.error(`   ❌ Failed to restore ${backupFile}:`, error);
      
      operations.push({
        backupFile,
        collection: 'unknown',
        docId: 'unknown',
        status: 'failed',
        error: error instanceof Error ? error.message : String(error)
      });
    }
  }

  // Generate summary
  const summary = {
    totalFiles: backupFiles.length,
    successful: operations.filter(op => op.status === 'success').length,
    failed: operations.filter(op => op.status === 'failed').length,
    skipped: operations.filter(op => op.status === 'skipped').length
  };

  const report: RestoreReport = {
    timestamp: new Date().toISOString(),
    backupLocation,
    operations,
    summary
  };

  return report;
}

function getBackupFiles(
  backupLocation: string,
  options: {
    specificFiles?: string[];
    collections?: string[];
  }
): string[] {
  const allFiles = fs.readdirSync(backupLocation).filter(file => file.endsWith('.json'));

  // Filter by specific files if provided
  if (options.specificFiles && options.specificFiles.length > 0) {
    return allFiles.filter(file => options.specificFiles!.includes(file));
  }

  // Filter by collections if provided
  if (options.collections && options.collections.length > 0) {
    return allFiles.filter(file => {
      return options.collections!.some(collection => file.startsWith(`${collection}_`));
    });
  }

  return allFiles;
}

async function listBackupLocations(): Promise<string[]> {
  const backupRootDir = path.join(process.cwd(), 'logs', 'availability-cleanup-backups');
  
  if (!fs.existsSync(backupRootDir)) {
    return [];
  }

  const directories = fs.readdirSync(backupRootDir, { withFileTypes: true })
    .filter(dirent => dirent.isDirectory())
    .map(dirent => path.join(backupRootDir, dirent.name))
    .sort((a, b) => b.localeCompare(a)); // Newest first

  return directories;
}

async function inspectBackupLocation(backupLocation: string): Promise<void> {
  console.log(`🔍 Inspecting Backup Location: ${backupLocation}`);
  console.log('='.repeat(50));

  if (!fs.existsSync(backupLocation)) {
    console.log('❌ Backup location does not exist');
    return;
  }

  const files = fs.readdirSync(backupLocation).filter(file => file.endsWith('.json'));
  console.log(`📁 Total backup files: ${files.length}`);

  // Group by collection
  const collections: { [key: string]: string[] } = {};
  files.forEach(file => {
    const collection = file.split('_')[0];
    if (!collections[collection]) {
      collections[collection] = [];
    }
    collections[collection].push(file);
  });

  console.log('\n📊 Files by Collection:');
  Object.entries(collections).forEach(([collection, files]) => {
    console.log(`   ${collection}: ${files.length} files`);
  });

  // Show sample files
  console.log('\n📄 Sample Files:');
  files.slice(0, 5).forEach(file => {
    try {
      const filePath = path.join(backupLocation, file);
      const backupData: BackupDocument = JSON.parse(fs.readFileSync(filePath, 'utf8'));
      console.log(`   ${file}`);
      console.log(`     Collection: ${backupData.collection}`);
      console.log(`     Document: ${backupData.docId}`);
      console.log(`     Timestamp: ${backupData.timestamp}`);
    } catch (error) {
      console.log(`   ${file} - Error reading: ${error}`);
    }
  });

  if (files.length > 5) {
    console.log(`   ... and ${files.length - 5} more files`);
  }
}

async function saveRestoreReport(report: RestoreReport): Promise<string> {
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const filename = `availability-restore-${timestamp}.json`;
  const filepath = path.join(process.cwd(), 'logs', filename);

  fs.writeFileSync(filepath, JSON.stringify(report, null, 2));
  return filepath;
}

// CLI interface
async function main() {
  const args = process.argv.slice(2);
  const command = args[0];

  try {
    switch (command) {
      case 'list':
        console.log('📋 Available Backup Locations:');
        console.log('============================');
        
        const locations = await listBackupLocations();
        if (locations.length === 0) {
          console.log('No backup locations found');
        } else {
          locations.forEach((location, index) => {
            const basename = path.basename(location);
            console.log(`${index + 1}. ${basename} (${location})`);
          });
        }
        break;

      case 'inspect':
        const inspectLocation = args[1];
        if (!inspectLocation) {
          console.error('❌ Please provide a backup location to inspect');
          console.log('Usage: npm run restore-backup inspect <backup-location>');
          process.exit(1);
        }
        await inspectBackupLocation(inspectLocation);
        break;

      case 'restore':
        const backupLocation = args[1];
        if (!backupLocation) {
          console.error('❌ Please provide a backup location to restore from');
          console.log('Usage: npm run restore-backup restore <backup-location> [--live]');
          process.exit(1);
        }

        const isDryRun = !args.includes('--live');
        const collections = args.includes('--collections') ? 
          args[args.indexOf('--collections') + 1]?.split(',') : undefined;

        const restoreOptions = {
          dryRun: isDryRun,
          collections
        };

        const report = await restoreFromBackup(backupLocation, restoreOptions);
        const reportPath = await saveRestoreReport(report);

        console.log('\n📊 RESTORE SUMMARY');
        console.log('==================');
        console.log(`Mode: ${isDryRun ? 'DRY RUN' : 'LIVE'}`);
        console.log(`Total files: ${report.summary.totalFiles}`);
        console.log(`Successful: ${report.summary.successful}`);
        console.log(`Failed: ${report.summary.failed}`);
        console.log(`Skipped: ${report.summary.skipped}`);
        console.log(`\n📄 Detailed report: ${reportPath}`);
        
        if (isDryRun) {
          console.log('\n💡 To apply changes, run with --live flag');
        }
        break;

      case 'help':
      default:
        console.log('🔄 Availability Backup Restoration Tool');
        console.log('======================================');
        console.log('');
        console.log('Commands:');
        console.log('  list                           - List available backup locations');
        console.log('  inspect <backup-location>      - Inspect backup contents');
        console.log('  restore <backup-location>      - Restore from backup (dry run)');
        console.log('  restore <backup-location> --live - Restore from backup (live)');
        console.log('  help                           - Show this help');
        console.log('');
        console.log('Options:');
        console.log('  --live                         - Apply changes (default is dry run)');
        console.log('  --collections <list>           - Only restore specific collections (comma-separated)');
        console.log('');
        console.log('Examples:');
        console.log('  npm run restore-backup list');
        console.log('  npm run restore-backup inspect logs/availability-cleanup-backups/2025-06-03_14-30-15');
        console.log('  npm run restore-backup restore logs/availability-cleanup-backups/2025-06-03_14-30-15');
        console.log('  npm run restore-backup restore logs/availability-cleanup-backups/2025-06-03_14-30-15 --live');
        console.log('  npm run restore-backup restore logs/availability-cleanup-backups/2025-06-03_14-30-15 --live --collections availability,bookings');
        break;
    }
  } catch (error) {
    console.error('❌ Command failed:', error);
    process.exit(1);
  }
}

// Run if called directly
if (require.main === module) {
  main().catch(console.error);
}

export { restoreFromBackup, listBackupLocations, inspectBackupLocation };