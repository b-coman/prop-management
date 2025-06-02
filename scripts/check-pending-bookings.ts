#!/usr/bin/env ts-node
// scripts/check-pending-bookings.ts
// Check for bookings stuck in pending status

import * as dotenv from 'dotenv';
import { config } from 'dotenv';
import { resolve } from 'path';
import { initializeApp, getApps, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

// Load environment variables
config({ path: resolve(__dirname, '../.env.local') });

// Initialize Firebase Admin
let app;
if (!getApps().length) {
  const serviceAccount = process.env.FIREBASE_SERVICE_ACCOUNT
    ? JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT)
    : null;

  if (serviceAccount) {
    app = initializeApp({
      credential: cert(serviceAccount),
    });
  } else {
    console.error('❌ FIREBASE_SERVICE_ACCOUNT not found in environment');
    process.exit(1);
  }
} else {
  app = getApps()[0];
}

const db = getFirestore(app);

async function checkPendingBookings() {
  console.log('🔍 Checking for Pending Bookings\n');

  try {
    // Query for all bookings
    const bookingsSnapshot = await db.collection('bookings')
      .orderBy('createdAt', 'desc')
      .limit(20)
      .get();

    console.log(`Found ${bookingsSnapshot.size} recent bookings\n`);

    const pendingBookings: any[] = [];
    const onHoldBookings: any[] = [];
    const confirmedBookings: any[] = [];
    const otherBookings: any[] = [];

    bookingsSnapshot.forEach((doc) => {
      const booking = { id: doc.id, ...doc.data() };
      const createdAt = booking.createdAt?.toDate ? booking.createdAt.toDate() : booking.createdAt;
      
      const bookingInfo = {
        id: booking.id,
        status: booking.status,
        propertyId: booking.propertyId,
        createdAt: createdAt ? new Date(createdAt).toISOString() : 'Unknown',
        paymentInfo: {
          stripePaymentIntentId: booking.paymentInfo?.stripePaymentIntentId || 'None',
          status: booking.paymentInfo?.status || 'None',
          amount: booking.paymentInfo?.amount || 0,
          paidAt: booking.paymentInfo?.paidAt?.toDate ? 
            new Date(booking.paymentInfo.paidAt.toDate()).toISOString() : 
            booking.paymentInfo?.paidAt || 'Not paid'
        },
        pricing: {
          total: booking.pricing?.total || 0,
          currency: booking.pricing?.currency || 'Unknown'
        },
        guestEmail: booking.guestInfo?.email || 'Unknown'
      };

      switch (booking.status) {
        case 'pending':
          pendingBookings.push(bookingInfo);
          break;
        case 'on-hold':
          onHoldBookings.push(bookingInfo);
          break;
        case 'confirmed':
          confirmedBookings.push(bookingInfo);
          break;
        default:
          otherBookings.push(bookingInfo);
      }
    });

    // Display results
    console.log('📊 Booking Status Summary:');
    console.log('-------------------------');
    console.log(`✅ Confirmed: ${confirmedBookings.length}`);
    console.log(`⏳ Pending: ${pendingBookings.length}`);
    console.log(`🔒 On Hold: ${onHoldBookings.length}`);
    console.log(`❓ Other: ${otherBookings.length}\n`);

    if (pendingBookings.length > 0) {
      console.log('⚠️  PENDING BOOKINGS (Need Investigation):');
      console.log('==========================================');
      pendingBookings.forEach((booking, index) => {
        console.log(`\n${index + 1}. Booking ID: ${booking.id}`);
        console.log(`   Property: ${booking.propertyId}`);
        console.log(`   Created: ${booking.createdAt}`);
        console.log(`   Guest Email: ${booking.guestEmail}`);
        console.log(`   Amount: ${booking.pricing.total} ${booking.pricing.currency}`);
        console.log(`   Payment Intent: ${booking.paymentInfo.stripePaymentIntentId}`);
        console.log(`   Payment Status: ${booking.paymentInfo.status}`);
        
        // Calculate how long it's been pending
        const createdDate = new Date(booking.createdAt);
        const hoursPending = (Date.now() - createdDate.getTime()) / (1000 * 60 * 60);
        console.log(`   ⏱️  Pending for: ${hoursPending.toFixed(1)} hours`);
        
        if (booking.paymentInfo.stripePaymentIntentId && booking.paymentInfo.stripePaymentIntentId !== 'None') {
          console.log(`   💡 This booking has a payment intent but is still pending!`);
          console.log(`      → Check Stripe dashboard for payment intent: ${booking.paymentInfo.stripePaymentIntentId}`);
          console.log(`      → The webhook might not have fired or processed correctly`);
        }
      });
      
      console.log('\n🔧 Troubleshooting Steps:');
      console.log('------------------------');
      console.log('1. Check if webhook is configured in Stripe dashboard');
      console.log('2. Verify STRIPE_WEBHOOK_SECRET is set correctly');
      console.log('3. Check server logs for webhook errors');
      console.log('4. Use Stripe CLI to replay webhook events');
      console.log('\nTo replay a webhook for a specific payment:');
      console.log('stripe events resend <event_id>');
    } else {
      console.log('✅ No pending bookings found!');
    }

    // Show recent confirmed bookings
    if (confirmedBookings.length > 0) {
      console.log('\n✅ Recent Confirmed Bookings:');
      console.log('============================');
      confirmedBookings.slice(0, 5).forEach((booking, index) => {
        console.log(`\n${index + 1}. Booking ID: ${booking.id}`);
        console.log(`   Property: ${booking.propertyId}`);
        console.log(`   Confirmed: ${booking.paymentInfo.paidAt}`);
        console.log(`   Amount: ${booking.paymentInfo.amount} ${booking.pricing.currency}`);
      });
    }

    // Check for webhook processing patterns
    console.log('\n📈 Webhook Processing Analysis:');
    console.log('==============================');
    
    const recentBookings = [...pendingBookings, ...confirmedBookings].sort((a, b) => 
      new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    ).slice(0, 10);
    
    let webhookWorking = false;
    recentBookings.forEach(booking => {
      if (booking.status === 'confirmed' && booking.paymentInfo.paidAt !== 'Not paid') {
        webhookWorking = true;
      }
    });
    
    if (webhookWorking) {
      console.log('✅ Webhook appears to be working (found recent confirmed bookings)');
    } else if (pendingBookings.length > 0) {
      console.log('❌ Webhook may not be working properly');
      console.log('   No recent bookings have been confirmed via webhook');
    }

  } catch (error) {
    console.error('❌ Error checking bookings:', error);
  }
}

// Run the check
checkPendingBookings()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });