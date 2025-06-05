#!/usr/bin/env npx ts-node

/**
 * Manual Webhook Test
 * Simulate a Stripe webhook call to test our endpoint
 */

async function testWebhookEndpoint() {
  console.log('🧪 Testing Webhook Endpoint...\n');
  
  const webhookUrl = process.env.NODE_ENV === 'production' 
    ? 'https://your-domain.com/api/webhooks/stripe'
    : 'http://localhost:9002/api/webhooks/stripe';
  
  console.log(`🎯 Testing URL: ${webhookUrl}`);
  
  // Test 1: Basic GET request (should return health check)
  try {
    console.log('\n1️⃣ Testing GET request (health check)...');
    const getResponse = await fetch(webhookUrl, {
      method: 'GET'
    });
    
    console.log(`   Status: ${getResponse.status}`);
    const getBody = await getResponse.text();
    console.log(`   Response: ${getBody}`);
    
  } catch (error) {
    console.log(`   ❌ GET request failed: ${error}`);
  }
  
  // Test 2: Simulate webhook payload (minimal test)
  try {
    console.log('\n2️⃣ Testing POST request (simulated webhook)...');
    
    const mockWebhookPayload = {
      id: 'evt_test_123',
      object: 'event',
      type: 'checkout.session.completed',
      data: {
        object: {
          id: 'cs_test_123',
          payment_status: 'paid',
          payment_intent: 'pi_test_123',
          amount_total: 2500, // $25.00 in cents
          created: Math.floor(Date.now() / 1000),
          metadata: {
            type: 'booking_hold',
            propertyId: 'prahova-mountain-chalet',
            holdBookingId: 'cRjCmfCYHSitnGN4ihAd', // The actual booking ID
            holdCurrency: 'USD'
          }
        }
      }
    };
    
    const postResponse = await fetch(webhookUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        // Skip signature for test - webhook should handle dev mode
      },
      body: JSON.stringify(mockWebhookPayload)
    });
    
    console.log(`   Status: ${postResponse.status}`);
    const postBody = await postResponse.text();
    console.log(`   Response: ${postBody}`);
    
    if (postResponse.status === 200) {
      console.log('   ✅ Webhook endpoint is working!');
    } else {
      console.log('   ❌ Webhook endpoint returned error');
    }
    
  } catch (error) {
    console.log(`   ❌ POST request failed: ${error}`);
  }
  
  // Test 3: Check environment variables
  console.log('\n3️⃣ Environment Check:');
  console.log(`   STRIPE_SECRET_KEY: ${process.env.STRIPE_SECRET_KEY ? '✅ Set' : '❌ Missing'}`);
  console.log(`   STRIPE_WEBHOOK_SECRET: ${process.env.STRIPE_WEBHOOK_SECRET ? '✅ Set' : '❌ Missing'}`);
  console.log(`   NODE_ENV: ${process.env.NODE_ENV || 'development'}`);
  
  console.log('\n🔍 Next Steps:');
  console.log('1. Run the diagnostic script: npx ts-node scripts/diagnose-hold-booking.ts');
  console.log('2. Check Stripe dashboard webhook configuration');
  console.log('3. Check server logs for webhook requests');
  console.log('4. If using ngrok/tunneling in dev, ensure webhook URL is correct');
}

// Run the test
testWebhookEndpoint().catch(console.error);