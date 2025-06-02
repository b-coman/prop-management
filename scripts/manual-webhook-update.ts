#!/usr/bin/env npx tsx

/**
 * Manual Webhook Update
 * Simulate webhook payment confirmation for local testing
 */

import { initializeApp } from 'firebase/app';
import { getFirestore, doc, updateDoc, serverTimestamp, Timestamp } from 'firebase/firestore';

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || 'rental-spot-builder',
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
};

async function manuallyUpdateHoldBooking() {
  console.log('🔧 Manually updating hold booking payment status...\n');
  
  try {
    // Initialize Firebase
    const app = initializeApp(firebaseConfig);
    const db = getFirestore(app);
    
    // The booking ID from your logs
    const bookingId = 'cRjCmfCYHSitnGN4ihAd';
    const sessionId = 'cs_test_a1cxNzQmYG7By3Muqtgdb2L7xCowpd9wtQmURA6OGSKsKq4gFT6Sqh2W7O';
    
    console.log(`📋 Updating booking: ${bookingId}`);
    console.log(`💳 Stripe session: ${sessionId}`);
    
    // Update the booking with payment confirmation
    const bookingRef = doc(db, 'bookings', bookingId);
    
    const updateData = {
      'paymentInfo.status': 'succeeded',
      'paymentInfo.paidAt': Timestamp.now(),
      'paymentInfo.stripePaymentIntentId': `pi_simulated_${Date.now()}`,
      holdPaymentId: `pi_simulated_${Date.now()}`,
      updatedAt: serverTimestamp()
    };
    
    await updateDoc(bookingRef, updateData);
    
    console.log('✅ Booking updated successfully!');
    console.log('\n📊 Updated fields:');
    console.log('   paymentInfo.status: "succeeded"');
    console.log('   paymentInfo.paidAt: [current timestamp]');
    console.log('   paymentInfo.stripePaymentIntentId: [simulated ID]');
    console.log('   holdPaymentId: [simulated ID]');
    
    console.log('\n🎯 Next steps:');
    console.log('1. Refresh your Firestore console to see the updates');
    console.log('2. The hold is now marked as paid');
    console.log('3. For production, use Stripe CLI or deploy to a public URL');
    
  } catch (error) {
    console.error('❌ Error updating booking:', error);
  }
}

// Run the update
manuallyUpdateHoldBooking();