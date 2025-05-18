#!/usr/bin/env node

/**
 * Test script to check environment variables
 */

import * as dotenv from 'dotenv';
import * as path from 'path';
import * as fs from 'fs';

console.log('Current working directory:', process.cwd());

// Try to load .env.local
const envLocalPath = path.join(process.cwd(), '.env.local');
console.log('Checking for .env.local at:', envLocalPath);
console.log('.env.local exists:', fs.existsSync(envLocalPath));

// Load .env.local
dotenv.config({ path: '.env.local' });

// Also try .env
const envPath = path.join(process.cwd(), '.env');
console.log('Checking for .env at:', envPath);
console.log('.env exists:', fs.existsSync(envPath));
dotenv.config({ path: '.env' });

// Check the environment variable
console.log('\nFIREBASE_ADMIN_SERVICE_ACCOUNT_PATH:');
console.log(process.env.FIREBASE_ADMIN_SERVICE_ACCOUNT_PATH);

console.log('\nAll env vars starting with FIREBASE:');
Object.keys(process.env).forEach(key => {
  if (key.startsWith('FIREBASE')) {
    console.log(`${key}: ${process.env[key]}`);
  }
});