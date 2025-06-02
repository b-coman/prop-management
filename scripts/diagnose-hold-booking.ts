#!/usr/bin/env npx ts-node

/**
 * Diagnose Hold Booking Issue
 * Check specific hold booking and webhook status
 */

import { initializeApp } from 'firebase/app';
import { getFirestore, doc, getDoc } from 'firebase/firestore';

// Firebase config - using environment or fallback
const firebaseConfig = {
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || 'rental-spot-builder',
  // Add other config if needed
};

async function diagnoseHoldBooking() {
  console.log('🔍 Diagnosing Hold Booking Issue...\n');
  
  try {
    // Initialize Firebase
    const app = initializeApp(firebaseConfig);
    const db = getFirestore(app);
    
    // The booking ID from the logs
    const bookingId = 'cRjCmfCYHSitnGN4ihAd';
    
    console.log(`📋 Checking booking: ${bookingId}`);
    
    // Get the booking document
    const bookingRef = doc(db, 'bookings', bookingId);
    const bookingSnap = await getDoc(bookingRef);
    
    if (!bookingSnap.exists()) {
      console.log('❌ Booking not found!');
      return;
    }
    
    const booking = bookingSnap.data();
    console.log('\n📊 Booking Status:');
    console.log(`   Status: ${booking.status}`);
    console.log(`   Payment Status: ${booking.paymentInfo?.status || 'N/A'}`);
    console.log(`   Payment Amount: ${booking.paymentInfo?.amount || 'N/A'}`);
    console.log(`   Stripe Payment Intent: ${booking.paymentInfo?.stripePaymentIntentId || 'N/A'}`);
    console.log(`   Paid At: ${booking.paymentInfo?.paidAt || 'N/A'}`);
    console.log(`   Created At: ${booking.createdAt?.toDate?.() || booking.createdAt}`);
    console.log(`   Updated At: ${booking.updatedAt?.toDate?.() || booking.updatedAt}`);
    
    // Check if this is the expected booking
    console.log('\n🔍 Booking Details:');
    console.log(`   Property: ${booking.propertyId}`);
    console.log(`   Guest: ${booking.guestInfo?.firstName} ${booking.guestInfo?.lastName}`);
    console.log(`   Email: ${booking.guestInfo?.email}`);
    console.log(`   Check-in: ${booking.checkInDate?.toDate?.() || booking.checkInDate}`);
    console.log(`   Check-out: ${booking.checkOutDate?.toDate?.() || booking.checkOutDate}`);
    console.log(`   Hold Fee: ${booking.holdFee}`);
    console.log(`   Hold Until: ${booking.holdUntil?.toDate?.() || booking.holdUntil}`);
    
    // Analyze the issue
    console.log('\n🎯 Analysis:');
    
    if (booking.status === 'on-hold' && booking.paymentInfo?.status === 'pending') {
      console.log('❌ ISSUE FOUND: Payment completed on Stripe but booking not updated');
      console.log('   This indicates webhook is NOT firing or failing');
      
      console.log('\n🔧 Potential Causes:');
      console.log('   1. Webhook not configured in Stripe dashboard');
      console.log('   2. Webhook URL not accessible (wrong URL, firewall, etc.)');
      console.log('   3. STRIPE_WEBHOOK_SECRET missing or incorrect');
      console.log('   4. Webhook endpoint returning errors');
      
      console.log('\n📋 Action Items:');
      console.log('   1. Check Stripe dashboard webhook configuration');
      console.log('   2. Verify webhook endpoint is accessible');
      console.log('   3. Check server logs for webhook requests');
      console.log('   4. Test webhook endpoint manually');
    } else if (booking.paymentInfo?.status === 'completed') {
      console.log('✅ Payment status is completed - webhook is working');
    } else {
      console.log(`⚠️  Unexpected status combination: booking.status=${booking.status}, payment.status=${booking.paymentInfo?.status}`);
    }
    
    // Check environment variables
    console.log('\n🔧 Environment Check:');
    console.log(`   STRIPE_SECRET_KEY: ${process.env.STRIPE_SECRET_KEY ? '✅ Set' : '❌ Missing'}`);
    console.log(`   STRIPE_WEBHOOK_SECRET: ${process.env.STRIPE_WEBHOOK_SECRET ? '✅ Set' : '❌ Missing'}`);
    console.log(`   NODE_ENV: ${process.env.NODE_ENV || 'development'}`);
    
  } catch (error) {
    console.error('❌ Error diagnosing booking:', error);
  }
}

// Run the diagnosis
diagnoseHoldBooking();