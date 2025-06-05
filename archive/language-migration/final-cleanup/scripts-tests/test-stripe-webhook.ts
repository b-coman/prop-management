#!/usr/bin/env ts-node
// scripts/test-stripe-webhook.ts
// Test script to diagnose Stripe webhook issues

import * as dotenv from 'dotenv';
import { config } from 'dotenv';
import { resolve } from 'path';

// Load environment variables
config({ path: resolve(__dirname, '../.env.local') });

console.log('🔧 Stripe Webhook Diagnostics\n');

// Check environment variables
console.log('1. Environment Variables Check:');
console.log('--------------------------------');
console.log(`STRIPE_SECRET_KEY: ${process.env.STRIPE_SECRET_KEY ? '✅ Set' : '❌ Missing'}`);
console.log(`STRIPE_WEBHOOK_SECRET: ${process.env.STRIPE_WEBHOOK_SECRET ? '✅ Set' : '❌ Missing'}`);
console.log(`NODE_ENV: ${process.env.NODE_ENV || 'development'}\n`);

// Webhook URL information
console.log('2. Webhook Endpoint Information:');
console.log('--------------------------------');
const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:9002';
console.log(`Expected webhook URL: ${baseUrl}/api/webhooks/stripe`);
console.log(`Make sure this URL is configured in your Stripe dashboard.\n`);

// Stripe Dashboard instructions
console.log('3. Stripe Dashboard Configuration:');
console.log('--------------------------------');
console.log('Go to: https://dashboard.stripe.com/webhooks');
console.log('1. Check if webhook endpoint is configured');
console.log('2. Verify the endpoint URL matches the one above');
console.log('3. Ensure these events are selected:');
console.log('   - checkout.session.completed ✅ (Required)');
console.log('   - payment_intent.succeeded (Optional)');
console.log('   - payment_intent.payment_failed (Optional)\n');

// Testing with Stripe CLI
console.log('4. Testing with Stripe CLI:');
console.log('--------------------------------');
console.log('Install Stripe CLI: https://stripe.com/docs/stripe-cli');
console.log('Then run these commands:\n');
console.log('# Login to Stripe');
console.log('stripe login\n');
console.log('# Forward webhooks to local server');
console.log('stripe listen --forward-to localhost:9002/api/webhooks/stripe\n');
console.log('# In another terminal, trigger a test event');
console.log('stripe trigger checkout.session.completed\n');

// Common issues
console.log('5. Common Issues & Solutions:');
console.log('--------------------------------');
console.log('❌ Issue: Webhook signature verification failed');
console.log('✅ Solution: Make sure STRIPE_WEBHOOK_SECRET matches the signing secret from Stripe dashboard\n');

console.log('❌ Issue: Webhook not receiving events');
console.log('✅ Solution: Check if the endpoint URL is correct and publicly accessible\n');

console.log('❌ Issue: Booking status not updating');
console.log('✅ Solution: Check if metadata is correctly set in checkout session creation\n');

// Metadata requirements
console.log('6. Required Metadata in Checkout Session:');
console.log('--------------------------------');
console.log('For full bookings:');
console.log(`{
  type: 'booking_full',
  propertyId: '<property-slug>',
  pendingBookingId: '<booking-id>',
  priceCurrency: '<currency-code>'
}\n`);

console.log('For hold bookings:');
console.log(`{
  type: 'booking_hold',
  propertyId: '<property-slug>',
  holdBookingId: '<booking-id>',
  holdCurrency: '<currency-code>'
}\n`);

// Test webhook secret format
if (process.env.STRIPE_WEBHOOK_SECRET) {
  console.log('7. Webhook Secret Format Check:');
  console.log('--------------------------------');
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  const isValidFormat = secret.startsWith('whsec_');
  console.log(`Secret format: ${isValidFormat ? '✅ Valid (starts with whsec_)' : '❌ Invalid format'}`);
  console.log(`Secret length: ${secret.length} characters\n`);
}

console.log('8. Next Steps:');
console.log('--------------------------------');
console.log('1. Verify all environment variables are set correctly');
console.log('2. Check Stripe dashboard webhook configuration');
console.log('3. Test with Stripe CLI locally');
console.log('4. Check server logs for webhook requests');
console.log('5. Verify booking metadata is being set correctly\n');

console.log('Run this script again after making changes to verify configuration.');