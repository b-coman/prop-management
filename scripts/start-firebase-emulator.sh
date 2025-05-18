#!/bin/bash

# Start Firebase Emulator
echo "Starting Firebase Emulator Suite..."
echo "Make sure you have Firebase CLI installed."
echo "If not, install it with: npm install -g firebase-tools"

# Check if Firebase CLI is installed
if ! command -v firebase &> /dev/null; then
    echo "Firebase CLI is not installed. Installing now..."
    npm install -g firebase-tools
fi

# Set environment variable for scripts to use emulator
export FIREBASE_USE_EMULATOR=true

# Start emulators
echo "Starting Firebase emulators (Auth, Firestore, Storage)"
firebase emulators:start --only auth,firestore,storage

# Note: This will keep running until you press Ctrl+C to stop it