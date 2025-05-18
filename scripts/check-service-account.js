#!/usr/bin/env node

/**
 * Service Account Verification Script
 * 
 * This script checks if a Firebase service account file is properly formatted
 * and contains all the required fields.
 * 
 * Usage:
 *   node check-service-account.js [path/to/service-account.json]
 * 
 * If no path is provided, it will use the FIREBASE_ADMIN_SERVICE_ACCOUNT_PATH
 * environment variable from .env.local if available.
 */

const fs = require('fs');
const path = require('path');
const dotenv = require('dotenv');

// Load environment variables from .env.local
try {
  dotenv.config({ path: '.env.local' });
} catch (error) {
  console.log('Note: .env.local not found, using existing environment variables');
}

// Get service account path
let serviceAccountPath = process.argv[2];

// If not provided, use environment variable
if (!serviceAccountPath) {
  serviceAccountPath = process.env.FIREBASE_ADMIN_SERVICE_ACCOUNT_PATH;
  if (!serviceAccountPath) {
    console.error('❌ No service account path provided!');
    console.error('Either provide a path as an argument or set FIREBASE_ADMIN_SERVICE_ACCOUNT_PATH in .env.local');
    process.exit(1);
  }
  console.log(`Using service account path from environment: ${serviceAccountPath}`);
}

// Resolve path
const resolvedPath = path.isAbsolute(serviceAccountPath)
  ? serviceAccountPath
  : path.resolve(process.cwd(), serviceAccountPath);

console.log(`Checking service account file at: ${resolvedPath}\n`);

// Check if file exists
if (!fs.existsSync(resolvedPath)) {
  console.error(`❌ Service account file not found at: ${resolvedPath}`);
  process.exit(1);
}

// Read and parse the file
let serviceAccount;
try {
  const fileContent = fs.readFileSync(resolvedPath, 'utf8');
  serviceAccount = JSON.parse(fileContent);
  console.log('✅ Service account file is valid JSON');
} catch (error) {
  console.error('❌ Failed to parse service account JSON:', error.message);
  process.exit(1);
}

// Check required fields
const requiredFields = [
  'type',
  'project_id',
  'private_key_id',
  'private_key',
  'client_email',
  'client_id',
  'auth_uri',
  'token_uri',
  'auth_provider_x509_cert_url',
  'client_x509_cert_url'
];

console.log('\n-- Required Fields Check --');
let missingFields = [];

for (const field of requiredFields) {
  if (serviceAccount[field]) {
    // For private key, check for BEGIN/END markers
    if (field === 'private_key') {
      const privateKey = serviceAccount[field];
      if (!privateKey.includes('BEGIN PRIVATE KEY') || !privateKey.includes('END PRIVATE KEY')) {
        console.log(`⚠️ ${field}: Present but may be malformed (missing BEGIN/END markers)`);
        continue;
      }
      
      if (privateKey.includes('\\n')) {
        console.log(`⚠️ ${field}: Contains escaped newlines (\\n) which may cause issues`);
        continue;
      }
    }
    
    // For other fields, just check presence
    const value = serviceAccount[field];
    const displayValue = typeof value === 'string' 
      ? field === 'private_key' 
        ? '[REDACTED]' 
        : value.length > 30 
          ? value.substring(0, 27) + '...' 
          : value
      : typeof value;
      
    console.log(`✅ ${field}: ${displayValue}`);
  } else {
    console.log(`❌ ${field}: MISSING`);
    missingFields.push(field);
  }
}

// Additional validations
console.log('\n-- Additional Validations --');

// Service account type
if (serviceAccount.type !== 'service_account') {
  console.log(`❌ Type should be 'service_account', but found '${serviceAccount.type}'`);
} else {
  console.log('✅ Correct service account type');
}

// Project ID format
if (serviceAccount.project_id && !/^[a-z0-9-]+$/.test(serviceAccount.project_id)) {
  console.log(`❌ Project ID '${serviceAccount.project_id}' has an unexpected format`);
} else if (serviceAccount.project_id) {
  console.log('✅ Project ID format is valid');
}

// Client email format
if (serviceAccount.client_email && !serviceAccount.client_email.includes('@') && !serviceAccount.client_email.endsWith('.gserviceaccount.com')) {
  console.log(`❌ Client email '${serviceAccount.client_email}' has an unexpected format`);
} else if (serviceAccount.client_email) {
  console.log('✅ Client email format is valid');
}

// Summary
console.log('\n-- Summary --');
if (missingFields.length > 0) {
  console.log(`❌ Missing ${missingFields.length} required fields: ${missingFields.join(', ')}`);
  console.log('\n❌ Service account file is INVALID. Fix the issues above and try again.');
  process.exit(1);
} else {
  console.log('✅ All required fields are present!');
  console.log(`✅ Service account file for project '${serviceAccount.project_id}' is VALID.`);
  
  // Suggestion for testing
  console.log('\n-- Next Steps --');
  console.log('Try initializing Firebase Admin SDK with this service account:');
  console.log(`
const admin = require('firebase-admin');
const serviceAccount = require('${resolvedPath}');

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

const db = admin.firestore();
console.log('Successfully initialized Firebase Admin SDK!');
  `);
}