#!/bin/bash

echo "=== Simulating Cloud Run startup sequence ==="
echo "1. Building Next.js standalone build..."

# Build the app
npm run build

if [ ! -f ".next/standalone/server.js" ]; then
  echo "ERROR: Standalone build not found!"
  exit 1
fi

echo "2. Starting server on port 8080..."

# Start the server in background
PORT=8080 NODE_ENV=production node .next/standalone/server.js &
SERVER_PID=$!

echo "Server PID: $SERVER_PID"
echo "3. Waiting for server to start..."
sleep 5

echo "4. Testing health endpoints (like Cloud Run would)..."

# Test health endpoint
echo "Testing GET /api/health..."
curl -f -X GET http://localhost:8080/api/health || echo "GET /api/health failed"

echo "Testing POST /api/health..."
curl -f -X POST http://localhost:8080/api/health || echo "POST /api/health failed"

echo "Testing GET /api/readiness..."
curl -f -X GET http://localhost:8080/api/readiness || echo "GET /api/readiness failed"

echo "Testing POST /api/readiness..."
curl -f -X POST http://localhost:8080/api/readiness || echo "POST /api/readiness failed"

echo "5. Checking if server is still running..."
if kill -0 $SERVER_PID 2>/dev/null; then
  echo "Server is still running"
else
  echo "Server crashed!"
fi

echo "6. Testing regular route..."
curl -f http://localhost:8080/ || echo "Root route failed"

echo "7. Checking logs..."
echo "Press Ctrl+C to stop the server and exit"

# Keep server running for manual testing
trap "echo 'Stopping server...'; kill $SERVER_PID; exit" SIGINT
wait $SERVER_PID