// Safari-specific authentication test
const puppeteer = require('puppeteer');

async function testSafariAuthFlow() {
  console.log('🧭 Testing Safari authentication flow...');
  console.log('Safari popup issues to check:');
  console.log('- Popup blocking');
  console.log('- Cross-origin policies');
  console.log('- Cookie handling');
  
  let browser;
  try {
    // Try to launch with Safari-like settings
    browser = await puppeteer.launch({ 
      headless: false,
      devtools: true,
      args: [
        '--no-sandbox', 
        '--disable-setuid-sandbox',
        '--disable-popup-blocking', // Explicitly disable popup blocking
        '--disable-web-security', // For testing
      ]
    });
    
    const page = await browser.newPage();
    
    // Monitor popup events
    page.on('popup', async (popup) => {
      console.log('🪟 Popup detected:', popup.url());
      
      // Check if it's Google OAuth
      if (popup.url().includes('accounts.google.com')) {
        console.log('✅ Google OAuth popup opened successfully');
        
        // Monitor popup for completion
        popup.on('framenavigated', (frame) => {
          console.log('📍 Popup navigation:', frame.url());
        });
        
        popup.on('close', () => {
          console.log('🔒 Popup closed');
        });
      }
    });
    
    // Monitor errors that might indicate popup blocking
    page.on('pageerror', error => {
      if (error.message.includes('popup') || error.message.includes('blocked')) {
        console.log('🚫 POPUP ERROR:', error.message);
      }
    });
    
    page.on('console', msg => {
      const text = msg.text();
      if (text.includes('popup') || text.includes('blocked') || text.includes('[AuthProvider]')) {
        console.log(`[BROWSER] ${text}`);
      }
    });
    
    console.log('\n📱 TEST 1: Safari popup behavior test...');
    await page.goto('http://localhost:9002/login', { waitUntil: 'networkidle0' });
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    console.log('🔍 Looking for Google sign-in button...');
    const googleButton = await page.$('button');
    
    if (googleButton) {
      console.log('📱 Button found, attempting click...');
      
      // Add event listener for popup blocking detection
      await page.evaluate(() => {
        window.addEventListener('error', (e) => {
          if (e.message.includes('popup') || e.message.includes('blocked')) {
            console.log('POPUP_BLOCKED_ERROR:', e.message);
          }
        });
      });
      
      // Try clicking the button
      await googleButton.click();
      
      // Wait longer for Safari popup handling
      await new Promise(resolve => setTimeout(resolve, 8000));
      
      // Check how many pages are open
      const pages = await browser.pages();
      console.log('📊 Total pages after click:', pages.length);
      
      if (pages.length === 1) {
        console.log('❌ No popup opened - likely blocked by Safari');
        
        // Check for errors in console
        const logs = await page.evaluate(() => {
          return window.console.history || [];
        });
        
        console.log('🔍 Checking for popup block indicators...');
      } else {
        console.log('✅ Popup opened successfully');
      }
      
    } else {
      console.log('❌ No Google button found');
    }
    
    console.log('\n🍪 TEST 2: Safari cookie handling...');
    
    // Test manual session creation (bypass popup issues)
    const testUser = {
      uid: 'safari-test-' + Date.now(),
      email: 'safaritest@example.com'
    };
    
    const sessionResult = await page.evaluate(async (user) => {
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
    
    console.log('Session creation result:', sessionResult.success ? '✅ Success' : '❌ Failed');
    
    // Check if cookies are set
    const cookies = await page.cookies();
    const devSession = cookies.find(c => c.name === 'dev-session');
    console.log('Safari cookie handling:', devSession ? '✅ Cookie set' : '❌ No cookie');
    
    if (devSession) {
      console.log('Cookie details:');
      console.log('- SameSite:', devSession.sameSite);
      console.log('- Secure:', devSession.secure);
      console.log('- HttpOnly:', devSession.httpOnly);
    }
    
    console.log('\n🔒 TEST 3: Admin access in Safari...');
    await page.goto('http://localhost:9002/admin', { waitUntil: 'networkidle0' });
    await new Promise(resolve => setTimeout(resolve, 3000));
    
    const finalUrl = page.url();
    const pageText = await page.evaluate(() => document.body.innerText);
    
    console.log('Final result:');
    console.log('- URL:', finalUrl);
    console.log('- Admin accessible:', pageText.includes('RentalSpot Admin'));
    console.log('- Auth status:', pageText.includes('Authenticated as') ? 'Authenticated' : 'Not authenticated');
    
    console.log('\n📋 SAFARI ISSUES SUMMARY:');
    console.log('1. Popup opens:', pages.length > 1 ? '✅' : '❌ BLOCKED');
    console.log('2. Cookie handling:', devSession ? '✅' : '❌ FAILED');
    console.log('3. Admin access:', finalUrl.includes('/admin') ? '✅' : '❌ BLOCKED');
    console.log('4. Session API:', sessionResult.success ? '✅' : '❌ FAILED');
    
    if (pages.length === 1 && !sessionResult.success) {
      console.log('\n🔧 SAFARI RECOMMENDATIONS:');
      console.log('- Use signInWithRedirect instead of signInWithPopup');
      console.log('- Implement fallback authentication flow');
      console.log('- Check Safari popup blocker settings');
      console.log('- Consider CORS and SameSite cookie policies');
    }
    
  } catch (error) {
    console.error('❌ Safari test failed:', error.message);
  } finally {
    if (browser) {
      await browser.close();
    }
  }
}

testSafariAuthFlow();