// Test what happens when authentication actually completes
const puppeteer = require('puppeteer');

async function testActualAuthFlow() {
  console.log('🔍 Testing what happens after authentication...');
  
  let browser;
  try {
    browser = await puppeteer.launch({ 
      headless: false,
      devtools: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox']
    });
    
    const page = await browser.newPage();
    
    page.on('console', msg => {
      if (msg.text().includes('[AuthProvider]') || msg.text().includes('[AdminAuthCheck]')) {
        console.log(`[BROWSER] ${msg.type()}: ${msg.text()}`);
      }
    });
    
    // Test 1: Simulate a successful Google login by creating a dev session directly
    console.log('\n🔧 TEST 1: Creating development session manually...');
    
    const testUser = {
      uid: 'manual-test-' + Date.now(),
      email: 'manualtest@example.com',
      displayName: 'Manual Test User'
    };
    
    await page.goto('http://localhost:9002/login');
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    // Create dev session via API
    const sessionResult = await page.evaluate(async (user) => {
      const response = await fetch('/api/auth/dev-session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user })
      });
      return await response.json();
    }, testUser);
    
    console.log('Session creation result:', sessionResult);
    
    // Check cookies after session creation
    const cookies = await page.cookies();
    const devSession = cookies.find(c => c.name === 'dev-session');
    console.log('Dev session cookie exists:', !!devSession);
    
    if (devSession) {
      console.log('Cookie value length:', devSession.value.length);
      
      // Try to decode it
      try {
        const decoded = Buffer.from(devSession.value, 'base64').toString();
        console.log('Decoded session data:', decoded);
        const parsed = JSON.parse(decoded);
        console.log('Parsed session data:', parsed);
      } catch (e) {
        console.log('❌ Error decoding cookie:', e.message);
      }
    }
    
    // Test 2: Now try to access admin with this session
    console.log('\n🔒 TEST 2: Accessing admin with session...');
    await page.goto('http://localhost:9002/admin');
    await new Promise(resolve => setTimeout(resolve, 3000));
    
    const adminPageText = await page.evaluate(() => document.body.innerText);
    console.log('Admin page loaded:', adminPageText.includes('RentalSpot Admin'));
    console.log('Bypass message shown:', adminPageText.includes('Development Mode - Authentication Bypassed'));
    
    // Test 3: What happens if we disable development mode check?
    console.log('\n⚙️  TEST 3: Checking middleware authentication...');
    
    // Check what middleware sees
    const middlewareResult = await page.evaluate(async () => {
      const response = await fetch('/api/debug-admin-firebase');
      return await response.text();
    });
    
    console.log('Middleware debug result:', middlewareResult.substring(0, 200));
    
    // Test 4: Direct test of auth check
    console.log('\n🔍 TEST 4: Direct auth helper test...');
    const authResult = await page.evaluate(async () => {
      try {
        const response = await fetch('/api/auth/session', {
          method: 'GET',
          credentials: 'include'
        });
        return await response.json();
      } catch (e) {
        return { error: e.message };
      }
    });
    
    console.log('Auth session check result:', authResult);
    
    console.log('\n📋 ACTUAL ISSUES FOUND:');
    console.log('1. Dev session cookie:', !!devSession ? '✅ Created' : '❌ Missing');
    console.log('2. Admin access:', adminPageText.includes('RentalSpot Admin') ? '✅ Works' : '❌ Blocked');
    console.log('3. Auth bypass active:', adminPageText.includes('Bypassed') ? '⚠️  YES' : '✅ Proper auth');
    console.log('4. Session API works:', sessionResult.success ? '✅ Yes' : '❌ No');
    
  } catch (error) {
    console.error('❌ Test failed:', error);
  } finally {
    if (browser) {
      await browser.close();
    }
  }
}

testActualAuthFlow();