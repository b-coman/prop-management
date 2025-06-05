// Final comprehensive authentication test
const puppeteer = require('puppeteer');

async function testAuthenticationFlow() {
  console.log('🚀 Final authentication test - please restart dev server first!');
  console.log('Expected: Admin should require actual authentication, not bypass');
  
  let browser;
  try {
    browser = await puppeteer.launch({ 
      headless: false,
      devtools: false, // Less verbose
      args: ['--no-sandbox', '--disable-setuid-sandbox']
    });
    
    const page = await browser.newPage();
    
    // Simplified logging - only auth-related messages
    page.on('console', msg => {
      const text = msg.text();
      if (text.includes('[Auth') || text.includes('Authentication') || text.includes('Development Mode')) {
        console.log(`[BROWSER] ${text}`);
      }
    });
    
    console.log('\n🔒 TEST 1: Admin access without authentication...');
    await page.goto('http://localhost:9002/admin', { waitUntil: 'domcontentloaded' });
    await new Promise(resolve => setTimeout(resolve, 3000));
    
    const currentUrl = page.url();
    const pageText = await page.evaluate(() => document.body.innerText);
    
    console.log('Current URL:', currentUrl);
    console.log('Shows admin panel:', pageText.includes('RentalSpot Admin'));
    console.log('Redirected to login:', currentUrl.includes('/login'));
    console.log('Authentication status:', pageText.includes('Not Authenticated') ? 'Not Authenticated' : 
                 pageText.includes('Authenticated as') ? 'Authenticated' : 'Unknown');
    
    if (currentUrl.includes('/login')) {
      console.log('✅ Good: Admin properly redirects to login when not authenticated');
      
      // Test login flow
      console.log('\n📱 TEST 2: Creating dev session and testing access...');
      
      const testUser = {
        uid: 'final-test-' + Date.now(),
        email: 'finaltest@example.com'
      };
      
      // Create session
      const sessionResult = await page.evaluate(async (user) => {
        const response = await fetch('/api/auth/dev-session', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ user })
        });
        return await response.json();
      }, testUser);
      
      console.log('Session creation:', sessionResult.success ? '✅ Success' : '❌ Failed');
      
      // Now try admin again
      console.log('\n🔒 TEST 3: Admin access with session...');
      await page.goto('http://localhost:9002/admin', { waitUntil: 'domcontentloaded' });
      await new Promise(resolve => setTimeout(resolve, 3000));
      
      const finalUrl = page.url();
      const finalPageText = await page.evaluate(() => document.body.innerText);
      
      console.log('Final URL:', finalUrl);
      console.log('Shows admin panel:', finalPageText.includes('RentalSpot Admin'));
      console.log('Authentication status:', finalPageText.includes('Not Authenticated') ? 'Not Authenticated' : 
                   finalPageText.includes('Authenticated as') ? `Authenticated as ${testUser.email}` : 'Unknown');
      
      if (finalUrl.includes('/admin') && finalPageText.includes('RentalSpot Admin')) {
        if (finalPageText.includes('Authenticated as')) {
          console.log('🎉 PERFECT: Authentication is working correctly!');
          console.log('   - Admin redirects to login when not authenticated');
          console.log('   - Admin allows access when authenticated');
          console.log('   - Shows proper authentication status');
        } else {
          console.log('⚠️  PARTIAL: Admin access works but status unclear');
        }
      } else {
        console.log('❌ BROKEN: Session created but admin still blocked');
      }
      
    } else if (pageText.includes('RentalSpot Admin')) {
      if (pageText.includes('Not Authenticated')) {
        console.log('❌ BROKEN: Admin shows but claims not authenticated');
      } else if (pageText.includes('Authenticated as')) {
        console.log('⚠️  UNEXPECTED: Admin accessible, claims authenticated, but no session created');
      } else {
        console.log('❌ BROKEN: Admin accessible without authentication check');
      }
    }
    
    // Test session API
    console.log('\n🔍 TEST 4: Session API check...');
    const sessionCheck = await page.evaluate(async () => {
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
    
    console.log('Session API result:', sessionCheck.authenticated ? 
      `✅ Authenticated as ${sessionCheck.user?.email}` : 
      `❌ Not authenticated: ${sessionCheck.error || 'Unknown'}`);
    
    console.log('\n📋 FINAL SUMMARY:');
    console.log('Session API works:', sessionCheck.authenticated ? '✅' : '❌');
    console.log('Admin protection works:', currentUrl.includes('/login') ? '✅' : '❌');
    console.log('Authentication flow complete:', finalUrl.includes('/admin') && finalPageText.includes('Authenticated as') ? '✅' : '❌');
    
  } catch (error) {
    console.error('❌ Test failed:', error.message);
  } finally {
    if (browser) {
      await browser.close();
    }
  }
}

testAuthenticationFlow();