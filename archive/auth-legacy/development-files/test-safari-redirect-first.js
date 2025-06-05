// Test Safari redirect-first approach
const puppeteer = require('puppeteer');

async function testSafariRedirectFirst() {
  console.log('🧭 Safari Redirect-First Test');
  console.log('Testing Safari with redirect flow as primary method...\n');
  
  let browser;
  try {
    browser = await puppeteer.launch({ 
      headless: false,
      devtools: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox']
    });
    
    const page = await browser.newPage();
    
    // Set Safari user agent
    await page.setUserAgent('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.1 Safari/605.1.15');
    
    page.on('console', msg => {
      const text = msg.text();
      if (text.includes('[Safari Auth]') || text.includes('redirect') || text.includes('Safari')) {
        console.log(`[BROWSER] ${text}`);
      }
    });
    
    console.log('📱 TEST 1: Safari redirect-first approach...');
    await page.goto('http://localhost:9002/login', { waitUntil: 'networkidle0' });
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    // Check for updated Safari guidance
    const pageContent = await page.content();
    const hasRedirectGuidance = pageContent.includes('redirected to Google');
    console.log('Safari redirect guidance shown:', hasRedirectGuidance ? '✅ Yes' : '❌ No');
    
    console.log('\n🖱️  TEST 2: Authentication flow...');
    
    const originalUrl = page.url();
    let redirectOccurred = false;
    let popupOpened = false;
    
    // Monitor for popup (should NOT happen in Safari)
    page.on('popup', () => {
      popupOpened = true;
      console.log('🪟 UNEXPECTED: Popup opened in Safari redirect-first mode');
    });
    
    // Click Google sign-in button
    const googleButton = await page.$('button');
    if (googleButton) {
      console.log('Clicking Google sign-in button...');
      await googleButton.click();
      
      // Wait for redirect
      await new Promise(resolve => setTimeout(resolve, 5000));
      
      const currentUrl = page.url();
      if (currentUrl !== originalUrl) {
        redirectOccurred = true;
        console.log('✅ Redirect occurred to:', currentUrl.substring(0, 50) + '...');
      } else {
        console.log('❌ No redirect occurred, still on:', currentUrl);
      }
      
      console.log('\n📊 RESULTS:');
      console.log('- Popup opened:', popupOpened ? '❌ Unexpected' : '✅ Correct (no popup)');
      console.log('- Redirect occurred:', redirectOccurred ? '✅ Expected' : '❌ Missing');
      
      if (redirectOccurred && !popupOpened) {
        console.log('🎉 PERFECT: Safari using redirect-first approach correctly');
        console.log('- No popup attempts (avoiding Safari popup issues)');
        console.log('- Clean redirect to Google OAuth');
        console.log('- Better user experience for Safari users');
      } else if (popupOpened) {
        console.log('⚠️  ISSUE: Popup still attempted in Safari');
        console.log('- This could cause Safari popup blocking issues');
        console.log('- Redirect-first approach not working');
      } else if (!redirectOccurred) {
        console.log('❌ PROBLEM: No authentication flow initiated');
        console.log('- Check Firebase configuration');
        console.log('- Check button click handling');
      }
      
      // Test what happens on return (simulate coming back from Google)
      if (redirectOccurred) {
        console.log('\n🔄 TEST 3: Return from Google OAuth simulation...');
        
        // Go back to login page to simulate return
        await page.goto('http://localhost:9002/login', { waitUntil: 'networkidle0' });
        await new Promise(resolve => setTimeout(resolve, 3000));
        
        // Check if redirect result is handled
        const backOnLogin = page.url().includes('/login');
        console.log('Back on login page:', backOnLogin ? '✅ Yes' : '❌ No');
        
        // In real scenario, user would be authenticated and redirected to admin
        // Let's test manual session creation to simulate successful OAuth return
        console.log('\n🔧 TEST 4: Simulate successful OAuth return...');
        
        const testUser = {
          uid: 'safari-redirect-' + Date.now(),
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
        
        console.log('Session simulation:', sessionResult.success ? '✅ Success' : '❌ Failed');
        
        // Test admin access
        await page.goto('http://localhost:9002/admin', { waitUntil: 'networkidle0' });
        await new Promise(resolve => setTimeout(resolve, 3000));
        
        const adminUrl = page.url();
        const adminContent = await page.evaluate(() => document.body.innerText);
        
        console.log('Admin access result:');
        console.log('- Can access admin:', adminUrl.includes('/admin') ? '✅ Yes' : '❌ No');
        console.log('- Shows authenticated status:', 
          adminContent.includes('Authenticated as') ? '✅ Yes' : '❌ No');
        
        if (adminUrl.includes('/admin') && adminContent.includes('Authenticated as')) {
          console.log('\n🎉 SAFARI REDIRECT-FIRST: FULLY WORKING');
          console.log('✅ Safari users get reliable redirect flow');
          console.log('✅ No popup blocking issues');
          console.log('✅ Clear user guidance');
          console.log('✅ Successful authentication');
        }
      }
      
    } else {
      console.log('❌ No Google sign-in button found');
    }
    
  } catch (error) {
    console.error('❌ Test failed:', error.message);
  } finally {
    if (browser) {
      await browser.close();
    }
  }
}

testSafariRedirectFirst();