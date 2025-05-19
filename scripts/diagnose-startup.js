#!/usr/bin/env node
/**
 * Diagnostic script to test startup behavior similar to Cloud Run
 */

const { spawn } = require('child_process');
const http = require('http');
const path = require('path');

// Simulate Cloud Run environment
process.env.PORT = '8080';
process.env.NODE_ENV = 'production';

console.log('[Diagnostic] Starting server with Cloud Run-like configuration...');
console.log('[Diagnostic] PORT:', process.env.PORT);
console.log('[Diagnostic] NODE_ENV:', process.env.NODE_ENV);

// Start the standalone server like Cloud Run would
const serverPath = path.join(__dirname, '..', '.next', 'standalone', 'server.js');
console.log('[Diagnostic] Server path:', serverPath);

const server = spawn('node', [serverPath], {
  env: process.env,
  stdio: 'inherit'
});

let healthCheckInterval;
let healthCheckAttempts = 0;
const MAX_ATTEMPTS = 30; // 3 minutes with 6-second intervals

function checkHealth() {
  healthCheckAttempts++;
  
  const endpoints = ['/api/health', '/api/readiness'];
  
  endpoints.forEach(endpoint => {
    const options = {
      hostname: 'localhost',
      port: 8080,
      path: endpoint,
      method: 'GET',
      timeout: 5000
    };
    
    const req = http.request(options, (res) => {
      console.log(`[Diagnostic] ${endpoint} - Status: ${res.statusCode}`);
      if (res.statusCode !== 200) {
        console.error(`[Diagnostic] ${endpoint} failed with status ${res.statusCode}`);
      }
    });
    
    req.on('error', (err) => {
      console.error(`[Diagnostic] ${endpoint} - Error:`, err.message);
    });
    
    req.end();
  });
  
  if (healthCheckAttempts >= MAX_ATTEMPTS) {
    console.error('[Diagnostic] Health check timeout - server not ready after 3 minutes');
    clearInterval(healthCheckInterval);
    server.kill();
    process.exit(1);
  }
}

// Wait a bit for server to start
setTimeout(() => {
  console.log('[Diagnostic] Starting health checks...');
  checkHealth(); // First check
  healthCheckInterval = setInterval(checkHealth, 6000); // Then every 6 seconds
}, 5000);

// Handle process termination
process.on('SIGINT', () => {
  console.log('[Diagnostic] Shutting down...');
  clearInterval(healthCheckInterval);
  server.kill();
  process.exit(0);
});

server.on('error', (err) => {
  console.error('[Diagnostic] Server error:', err);
  process.exit(1);
});

server.on('exit', (code) => {
  console.log('[Diagnostic] Server exited with code:', code);
  clearInterval(healthCheckInterval);
  process.exit(code);
});