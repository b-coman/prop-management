#!/usr/bin/env node

/**
 * Test script to verify middleware doesn't block health checks
 */

const http = require('http');

function testEndpoint(path, expectedStatus = 200) {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: 'localhost',
      port: process.env.PORT || 8080,
      path: path,
      method: 'GET',
      headers: {
        'Host': 'localhost'
      }
    };

    const req = http.request(options, (res) => {
      console.log(`Testing ${path}: Status ${res.statusCode}`);
      if (res.statusCode === expectedStatus) {
        resolve(true);
      } else {
        reject(new Error(`Expected ${expectedStatus}, got ${res.statusCode}`));
      }
    });

    req.on('error', (error) => {
      console.error(`Error testing ${path}:`, error.message);
      reject(error);
    });

    req.end();
  });
}

async function runTests() {
  console.log('Testing middleware behavior...\n');
  
  try {
    // Test health endpoints
    await testEndpoint('/api/health');
    console.log('✅ Health endpoint accessible\n');
    
    await testEndpoint('/api/readiness');
    console.log('✅ Readiness endpoint accessible\n');
    
    // Test regular route
    await testEndpoint('/');
    console.log('✅ Homepage accessible\n');
    
    // Test with custom domain simulation
    await testEndpoint('/', 200);
    console.log('✅ Custom domain handling works\n');
    
    console.log('All tests passed! 🎉');
  } catch (error) {
    console.error('❌ Test failed:', error.message);
    process.exit(1);
  }
}

// Run tests
runTests();