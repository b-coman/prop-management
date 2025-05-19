#!/bin/bash

# Start Firebase Emulator with Firestore only for pricing API testing
# This script starts the emulator and loads test data for pricing

echo "🚀 Starting Firebase Emulator for Pricing API Testing"

# Check if Firebase CLI is installed
if ! command -v firebase &> /dev/null; then
    echo "❌ Firebase CLI is not installed. Installing now..."
    npm install -g firebase-tools
fi

# Set environment variable to use emulator
export FIREBASE_USE_EMULATOR=true
export FIRESTORE_EMULATOR_HOST=localhost:8080

# Kill any existing emulator processes
echo "🔧 Stopping any existing emulator processes..."
pkill -f "firebase-emulator" || true
pkill -f "java.*firestore" || true

# Create emulator settings if they don't exist
if [ ! -f firebase.json ]; then
    echo "❌ firebase.json not found. Creating minimal configuration..."
    cat > firebase.json << 'EOF'
{
  "emulators": {
    "firestore": {
      "port": 8080
    },
    "ui": {
      "enabled": true,
      "port": 4000
    }
  },
  "firestore": {
    "rules": "firestore.rules",
    "indexes": "firestore.indexes.json"
  }
}
EOF
fi

# Start the emulator in background
echo "🌟 Starting Firebase Firestore emulator..."
firebase emulators:start --only firestore &

# Get the PID
EMULATOR_PID=$!

# Wait for emulator to be ready
echo "⏳ Waiting for emulator to be ready..."
sleep 5

# Check if emulator is running
if ps -p $EMULATOR_PID > /dev/null; then
    echo "✅ Firebase emulator is running (PID: $EMULATOR_PID)"
    echo "📌 Firestore emulator: http://localhost:8080"
    echo "📊 Emulator UI: http://localhost:4000"
    
    # Load test data
    echo "\n📦 Loading test pricing data..."
    npm run load-pricing-data-emulator
    
    echo "\n✅ Emulator is ready for testing!"
    echo "🧪 Run pricing tests with: npm run test-pricing-api-local"
    echo "\n🛑 Press Ctrl+C to stop the emulator"
    
    # Keep the script running
    wait $EMULATOR_PID
else
    echo "❌ Failed to start Firebase emulator"
    exit 1
fi
