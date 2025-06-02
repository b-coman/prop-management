#!/usr/bin/env ts-node
// scripts/test-webhook-endpoint.ts
// Test the webhook endpoint directly to check if it's working

import * as dotenv from 'dotenv';
import { config } from 'dotenv';
import { resolve } from 'path';

// Load environment variables
config({ path: resolve(__dirname, '../.env.local') });

async function testWebhookEndpoint() {
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:9002';
  const webhookUrl = `${baseUrl}/api/webhooks/stripe`;
  
  console.log('🧪 Testing Stripe Webhook Endpoint\n');
  console.log(`Testing URL: ${webhookUrl}\n`);

  // Test 1: GET request (health check)
  console.log('Test 1: GET Request (Health Check)');
  console.log('----------------------------------');
  try {
    const response = await fetch(webhookUrl, {
      method: 'GET',
    });
    
    const data = await response.json();
    console.log(`Status: ${response.status} ${response.statusText}`);
    console.log('Response:', JSON.stringify(data, null, 2));
    
    if (response.status === 200 && data.status === 'ok') {
      console.log('✅ Webhook endpoint is reachable\n');
    } else {
      console.log('❌ Unexpected response from webhook endpoint\n');
    }
  } catch (error) {
    console.log('❌ Failed to reach webhook endpoint');
    console.log('Error:', error);
    console.log('\nMake sure the server is running on port 9002\n');
  }

  // Test 2: POST request without signature (should fail)
  console.log('Test 2: POST Request without Signature');
  console.log('--------------------------------------');
  try {
    const testPayload = {
      id: 'evt_test',
      type: 'checkout.session.completed',
      data: {
        object: {
          id: 'cs_test',
          payment_status: 'paid',
          metadata: {
            type: 'booking_full',
            propertyId: 'test-property',
            pendingBookingId: 'test-booking-id',
            priceCurrency: 'EUR'
          }
        }
      }
    };

    const response = await fetch(webhookUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(testPayload),
    });
    
    const data = await response.json();
    console.log(`Status: ${response.status} ${response.statusText}`);
    console.log('Response:', JSON.stringify(data, null, 2));
    
    if (response.status === 400 || response.status === 500) {
      console.log('✅ Webhook correctly rejects unsigned requests\n');
    } else {
      console.log('⚠️  Unexpected response - webhook might be accepting unsigned requests\n');
    }
  } catch (error) {
    console.log('❌ Error testing POST request:', error, '\n');
  }

  // Test 3: Check if webhook secret is configured
  console.log('Test 3: Environment Configuration');
  console.log('---------------------------------');
  if (process.env.STRIPE_WEBHOOK_SECRET) {
    console.log('✅ STRIPE_WEBHOOK_SECRET is configured');
    console.log(`   Format: ${process.env.STRIPE_WEBHOOK_SECRET.startsWith('whsec_') ? 'Valid' : 'Invalid'}`);
  } else {
    console.log('❌ STRIPE_WEBHOOK_SECRET is not configured');
    console.log('   This will cause signature verification to fail in production');
  }

  if (process.env.STRIPE_SECRET_KEY) {
    console.log('✅ STRIPE_SECRET_KEY is configured');
  } else {
    console.log('❌ STRIPE_SECRET_KEY is not configured');
    console.log('   Webhook cannot process payments without this');
  }

  console.log('\n📝 Summary');
  console.log('-----------');
  console.log('If all tests pass, the webhook endpoint is properly configured.');
  console.log('Next steps:');
  console.log('1. Configure webhook in Stripe dashboard');
  console.log('2. Copy the signing secret to STRIPE_WEBHOOK_SECRET');
  console.log('3. Test with real Stripe events using Stripe CLI');
}

// Run the test
testWebhookEndpoint().catch(console.error);