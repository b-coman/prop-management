// Test Safari popup detection logic
const puppeteer = require('puppeteer');

async function testSafariPopupLogic() {
  console.log('🧭 Safari Popup Logic Test');
  console.log('Testing popup detection and flow selection...\n');
  
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
      if (text.includes('[Safari Auth]') || text.includes('Popup') || text.includes('Redirect')) {
        console.log(`[BROWSER] ${text}`);
      }
    });
    
    console.log('📱 TEST 1: Safari detection and popup logic...');
    await page.goto('http://localhost:9002/login', { waitUntil: 'networkidle0' });
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    // Test the popup detection logic
    const browserTests = await page.evaluate(() => {
      // Test Safari detection
      const userAgent = window.navigator.userAgent;
      const isSafariBrowser = /Safari/.test(userAgent) && !/Chrome/.test(userAgent) && !/Chromium/.test(userAgent);
      
      // Test popup blocking detection
      let popupBlocked = false;
      try {
        const popup = window.open('', '_blank', 'width=1,height=1');
        if (popup) {
          popup.close();
          popupBlocked = false;
        } else {
          popupBlocked = true;
        }
      } catch (e) {
        popupBlocked = true;
      }
      
      // Test what would happen with auth flow
      let recommendedFlow = 'unknown';
      if (isSafariBrowser) {
        if (popupBlocked) {
          recommendedFlow = 'redirect';
        } else {
          recommendedFlow = 'popup';
        }
      } else {
        recommendedFlow = 'popup';
      }
      
      return {
        userAgent: userAgent,
        isSafariBrowser: isSafariBrowser,
        popupBlocked: popupBlocked,
        recommendedFlow: recommendedFlow
      };
    });
    
    console.log('Browser test results:');
    console.log('- User Agent:', browserTests.userAgent.substring(0, 80) + '...');
    console.log('- Detected as Safari:', browserTests.isSafariBrowser ? '✅ Yes' : '❌ No');
    console.log('- Popup blocked:', browserTests.popupBlocked ? '❌ Yes' : '✅ No');
    console.log('- Recommended flow:', browserTests.recommendedFlow);
    
    console.log('\n🖱️  TEST 2: Actual authentication flow...');
    
    // Track what actually happens
    let authFlowUsed = 'unknown';
    let popupOpened = false;
    let redirectOccurred = false;
    
    page.on('popup', () => {
      popupOpened = true;
      authFlowUsed = 'popup';
    });
    
    const originalUrl = page.url();
    
    // Click the Google sign-in button
    const googleButton = await page.$('button');
    if (googleButton) {
      await googleButton.click();
      
      // Wait and check what happened
      await new Promise(resolve => setTimeout(resolve, 8000));
      
      const currentUrl = page.url();
      if (currentUrl !== originalUrl && currentUrl.includes('google')) {
        redirectOccurred = true;
        authFlowUsed = 'redirect';
      }
      
      console.log('Authentication flow results:');
      console.log('- Popup opened:', popupOpened ? '✅ Yes' : '❌ No');
      console.log('- Redirect occurred:', redirectOccurred ? '✅ Yes' : '❌ No');
      console.log('- Actual flow used:', authFlowUsed);
      console.log('- Current URL:', currentUrl === originalUrl ? 'Same page' : 'Different page');
      
      // Analysis
      console.log('\n📊 LOGIC ANALYSIS:');
      
      if (browserTests.recommendedFlow === 'popup' && popupOpened) {
        console.log('✅ CORRECT: Popup enabled, popup used');
      } else if (browserTests.recommendedFlow === 'redirect' && redirectOccurred) {
        console.log('✅ CORRECT: Popup blocked, redirect used');
      } else if (browserTests.recommendedFlow === 'popup' && redirectOccurred) {
        console.log('⚠️  UNEXPECTED: Popup enabled but redirect used (popup failed?)');
      } else if (browserTests.recommendedFlow === 'redirect' && popupOpened) {
        console.log('❌ INCORRECT: Popup blocked but popup attempted');
      } else {
        console.log('❓ UNCLEAR: Unexpected combination');
      }
      
      console.log('\n🔧 RECOMMENDATIONS:');
      
      if (browserTests.popupBlocked && popupOpened) {
        console.log('- Popup detection may be inaccurate');
        console.log('- Consider more robust popup blocking detection');
      }
      
      if (!browserTests.popupBlocked && redirectOccurred && !popupOpened) {
        console.log('- Popup should work but redirect was used');
        console.log('- Check popup timeout or error handling');
      }
      
      if (browserTests.isSafariBrowser && authFlowUsed === 'unknown') {
        console.log('- No authentication flow detected');
        console.log('- Check button click handling or Firebase configuration');
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

testSafariPopupLogic();