// Comprehensive authentication flow test
const puppeteer = require('puppeteer');

async function testCompleteAuthFlow() {
  console.log('🚀 Starting comprehensive authentication test...');
  
  let browser;
  try {
    browser = await puppeteer.launch({ 
      headless: false,
      devtools: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox']
    });
    
    const page = await browser.newPage();
    
    // Listen to all events
    page.on('console', msg => {
      console.log(`[BROWSER] ${msg.type()}: ${msg.text()}`);
    });
    
    page.on('pageerror', error => {
      console.log(`[PAGE ERROR] ${error.message}`);
    });
    
    page.on('requestfailed', request => {
      console.log(`[REQUEST FAILED] ${request.url()}: ${request.failure().errorText}`);
    });
    
    // Test 1: Login page loads correctly
    console.log('\n📍 TEST 1: Login page loading...');
    await page.goto('http://localhost:9002/login', { waitUntil: 'networkidle0' });
    await new Promise(resolve => setTimeout(resolve, 3000));
    
    const pageText = await page.evaluate(() => document.body.innerText);
    console.log('Page content preview:', pageText.substring(0, 300));
    
    // Test 2: Check if Google sign-in button is clickable
    console.log('\n🔍 TEST 2: Looking for Google sign-in button...');
    const googleButton = await page.$('button');
    if (googleButton) {
      const buttonText = await page.evaluate(el => el.innerText, googleButton);
      console.log('Button found with text:', buttonText);
      
      // Test 3: Try clicking the Google sign-in button
      console.log('\n🖱️  TEST 3: Attempting to click sign-in button...');
      await googleButton.click();
      
      // Wait for potential popup or redirect
      await new Promise(resolve => setTimeout(resolve, 5000));
      
      const currentUrl = page.url();
      console.log('Current URL after click:', currentUrl);
      
      // Check if Google OAuth popup opened
      const pages = await browser.pages();
      console.log('Number of open pages:', pages.length);
      
      if (pages.length > 1) {
        console.log('🎉 Google OAuth popup opened successfully');
        const popupPage = pages[pages.length - 1];
        const popupUrl = popupPage.url();
        console.log('Popup URL:', popupUrl);
        
        if (popupUrl.includes('accounts.google.com')) {
          console.log('✅ Correctly redirected to Google OAuth');
        } else {
          console.log('❌ Popup not pointing to Google OAuth');
        }
      } else {
        console.log('❌ No OAuth popup opened');
      }
      
    } else {
      console.log('❌ No button found on page');
    }
    
    // Test 4: Test development session creation
    console.log('\n🔧 TEST 4: Testing development session API...');
    const testUser = {
      uid: 'test-auth-flow-' + Date.now(),
      email: 'authtest@example.com',
      displayName: 'Auth Test User'
    };
    
    // Simulate creating a dev session
    const sessionResponse = await page.evaluate(async (user) => {
      try {
        const response = await fetch('/api/auth/dev-session', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ user })
        });
        return await response.json();
      } catch (error) {
        return { error: error.message };
      }
    }, testUser);
    
    console.log('Dev session API response:', sessionResponse);
    
    // Test 5: Check if session cookie was set
    console.log('\n🍪 TEST 5: Checking session cookies...');
    const cookies = await page.cookies();
    const devSessionCookie = cookies.find(c => c.name === 'dev-session');
    
    if (devSessionCookie) {
      console.log('✅ Dev session cookie found');
      try {
        const sessionData = JSON.parse(Buffer.from(devSessionCookie.value, 'base64').toString());
        console.log('Session data:', sessionData);
      } catch (e) {
        console.log('❌ Could not parse session cookie');
      }
    } else {
      console.log('❌ No dev session cookie found');
    }
    
    // Test 6: Try accessing admin with session
    console.log('\n🔒 TEST 6: Testing admin access with session...');
    await page.goto('http://localhost:9002/admin', { waitUntil: 'networkidle0' });
    await new Promise(resolve => setTimeout(resolve, 3000));
    
    const finalUrl = page.url();
    const finalPageText = await page.evaluate(() => document.body.innerText);
    
    console.log('Final URL:', finalUrl);
    console.log('Final page preview:', finalPageText.substring(0, 200));
    
    if (finalUrl.includes('/admin') && !finalUrl.includes('/login')) {
      console.log('✅ Successfully accessed admin page');
    } else {
      console.log('❌ Still redirected to login or other page');
    }
    
    console.log('\n📋 TEST SUMMARY:');
    console.log('- Login page loads:', !pageText.includes('Error'));
    console.log('- Google button exists:', !!googleButton);
    console.log('- Dev session API works:', sessionResponse.success || false);
    console.log('- Session cookie set:', !!devSessionCookie);
    console.log('- Admin access works:', finalUrl.includes('/admin'));
    
  } catch (error) {
    console.error('❌ Test failed:', error);
  } finally {
    if (browser) {
      await browser.close();
    }
  }
}

testCompleteAuthFlow();