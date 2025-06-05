// Simple browser automation test for authentication
const puppeteer = require('puppeteer');

async function testAuthFlow() {
  console.log('🚀 Starting browser automation test...');
  
  let browser;
  try {
    browser = await puppeteer.launch({ 
      headless: false, // Show browser so we can see what's happening
      devtools: true   // Open dev tools
    });
    
    const page = await browser.newPage();
    
    // Listen to console messages from the page
    page.on('console', msg => {
      console.log(`[BROWSER] ${msg.type()}: ${msg.text()}`);
    });
    
    // Listen to page errors
    page.on('pageerror', error => {
      console.log(`[PAGE ERROR] ${error.message}`);
    });
    
    console.log('📍 Navigating to login page...');
    await page.goto('http://localhost:9002/login', { waitUntil: 'networkidle0' });
    
    console.log('⏱️  Waiting for page to load...');
    await new Promise(resolve => setTimeout(resolve, 5000));
    
    // Check what's on the page
    const pageText = await page.evaluate(() => document.body.innerText);
    console.log('📄 Page content:', pageText.substring(0, 500));
    
    // Check if login form appeared  
    const hasGoogleButton = await page.$('button');
    console.log('🔍 Google login button found:', !!hasGoogleButton);
    
    // Check if still loading
    const isLoading = pageText.includes('Authenticating, please wait');
    console.log('⏳ Still loading:', isLoading);
    
    // Check if login form is showing
    const hasLoginForm = pageText.includes('Sign in with Google') || pageText.includes('Login') || pageText.includes('Sign in');
    console.log('📝 Login form showing:', hasLoginForm);
    
    // Test navigation to admin page (should redirect to login)
    console.log('🔒 Testing admin page redirect...');
    await page.goto('http://localhost:9002/admin', { waitUntil: 'networkidle0' });
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    const currentUrl = page.url();
    const redirectedToLogin = currentUrl.includes('/login');
    console.log('🔄 Admin redirected to login:', redirectedToLogin);
    
    console.log('✅ Test completed');
    
  } catch (error) {
    console.error('❌ Test failed:', error);
  } finally {
    if (browser) {
      await browser.close();
    }
  }
}

// Check if puppeteer is available
try {
  testAuthFlow();
} catch (error) {
  console.log('❌ Puppeteer not available. Installing...');
  console.log('Run: npm install puppeteer');
  console.log('Then run: node test-browser-auth.js');
}