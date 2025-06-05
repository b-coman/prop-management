#!/usr/bin/env node

const { spawn } = require('child_process');
const http = require('http');

console.log('Starting minimal standalone test...');

// Start standalone server
const server = spawn('node', ['.next/standalone/server.js'], {
  env: {
    ...process.env,
    PORT: '8080',
    NODE_ENV: 'production'
  },
  stdio: ['ignore', 'pipe', 'pipe']
});

// Capture and display stdout
server.stdout.on('data', (data) => {
  console.log(`[STDOUT] ${data.toString().trim()}`);
});

// Capture and display stderr
server.stderr.on('data', (data) => {
  console.error(`[STDERR] ${data.toString().trim()}`);
});

server.on('exit', (code) => {
  console.log(`Server exited with code: ${code}`);
});

server.on('error', (err) => {
  console.error('Server error:', err);
});

// Give it some time then test health
setTimeout(() => {
  console.log('Testing health endpoint...');
  
  const req = http.get('http://localhost:8080/api/health', (res) => {
    console.log(`Health check status: ${res.statusCode}`);
    res.on('data', (data) => {
      console.log(`Response: ${data}`);
    });
  });
  
  req.on('error', (err) => {
    console.error('Health check error:', err);
  });
  
  req.end();
}, 5000);

// Keep running
process.on('SIGINT', () => {
  console.log('Shutting down...');
  server.kill();
  process.exit(0);
});