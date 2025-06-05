/**
 * @fileoverview Manual test script for simple authentication
 * @module test-simple-auth-manual
 * 
 * @description
 * Comprehensive manual test for the new simple authentication system.
 * Tests all flows and provides clear pass/fail results.
 */

const puppeteer = require('puppeteer');

async function testSimpleAuthentication() {
  console.log('🔥 Simple Authentication - Comprehensive Test');
  console.log('============================================\n');

  let browser;
  let testResults = {
    passed: 0,
    failed: 0,
    tests: []
  };

  function logTest(name, passed, details = '') {
    const status = passed ? '✅ PASS' : '❌ FAIL';
    console.log(`${status}: ${name}`);
    if (details) console.log(`   ${details}`);
    
    testResults.tests.push({ name, passed, details });
    if (passed) testResults.passed++;
    else testResults.failed++;
  }

  try {
    console.log('🚀 Starting browser...');
    browser = await puppeteer.launch({ 
      headless: false,
      devtools: false,
      args: ['--no-sandbox', '--disable-setuid-sandbox']
    });

    const page = await browser.newPage();

    // Capture console messages for debugging
    const consoleMessages = [];
    page.on('console', msg => {
      if (msg.text().includes('[SimpleAuth]') || msg.text().includes('[SimpleSession]')) {
        consoleMessages.push(msg.text());
      }
    });

    console.log('\n📋 TEST 1: Login Page Load and Content');
    await page.goto('http://localhost:9002/simple-test/login', { waitUntil: 'networkidle0' });
    await new Promise(resolve => setTimeout(resolve, 2000));

    const pageContent = await page.content();
    const pageText = await page.evaluate(() => document.body.innerText);

    logTest('Login page loads without errors', !pageContent.includes('error'), 'Page loaded successfully');
    logTest('Shows "Admin Login" title', pageText.includes('Admin Login'), 'Title found');
    logTest('Shows Google sign-in button', pageText.includes('Sign in with Google'), 'Button found');
    logTest('Shows universal auth message', pageText.includes('Universal authentication'), 'Message found');
    logTest('NO browser-specific warnings', !pageText.includes('Safari User'), 'No Safari warnings');

    console.log('\n📋 TEST 2: Session API Testing');
    
    // Test unauthenticated session check
    const unauthedSession = await page.evaluate(async () => {
      try {
        const res = await fetch('/api/auth/simple-session', { method: 'GET' });
        return { status: res.status, data: await res.json() };
      } catch (e) {
        return { error: e.message };
      }
    });

    logTest('Session API responds to GET', unauthedSession.status === 200, `Status: ${unauthedSession.status}`);
    logTest('Returns unauthenticated when no session', !unauthedSession.data?.authenticated, 'Correct auth status');

    // Test session creation
    const sessionCreation = await page.evaluate(async () => {
      try {
        const res = await fetch('/api/auth/simple-session', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ idToken: 'test-manual-' + Date.now() })
        });
        return { status: res.status, data: await res.json() };
      } catch (e) {
        return { error: e.message };
      }
    });

    logTest('Session creation API works', sessionCreation.status === 200, `Status: ${sessionCreation.status}`);
    logTest('Session creation returns success', sessionCreation.data?.success === true, 'Success flag set');
    logTest('Session creation returns user data', !!sessionCreation.data?.user, 'User data present');

    // Test authenticated session check
    const authedSession = await page.evaluate(async () => {
      try {
        const res = await fetch('/api/auth/simple-session', { method: 'GET' });
        return { status: res.status, data: await res.json() };
      } catch (e) {
        return { error: e.message };
      }
    });

    logTest('Session check after creation works', authedSession.status === 200, `Status: ${authedSession.status}`);
    logTest('Returns authenticated with session', authedSession.data?.authenticated === true, 'Auth status correct');

    console.log('\n📋 TEST 3: Admin Access Protection');

    // Clear session first
    await page.evaluate(async () => {
      await fetch('/api/auth/simple-session', { method: 'DELETE' });
    });

    // Test unauthenticated admin access
    await page.goto('http://localhost:9002/simple-test/admin', { waitUntil: 'networkidle0' });
    await new Promise(resolve => setTimeout(resolve, 2000));

    const currentUrl = page.url();
    logTest('Unauthenticated admin redirects to login', currentUrl.includes('login'), `URL: ${currentUrl}`);

    // Create session and test authenticated admin access
    await page.evaluate(async () => {
      await fetch('/api/auth/simple-session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ idToken: 'admin-test-' + Date.now() })
      });
    });

    await page.goto('http://localhost:9002/simple-test/admin', { waitUntil: 'networkidle0' });
    await new Promise(resolve => setTimeout(resolve, 3000));

    const adminPageText = await page.evaluate(() => document.body.innerText);
    const adminUrl = page.url();

    logTest('Authenticated admin access works', adminUrl.includes('admin') && !adminUrl.includes('login'), `URL: ${adminUrl}`);
    logTest('Shows admin dashboard', adminPageText.includes('Dashboard'), 'Dashboard content found');
    logTest('Shows authentication status', adminPageText.includes('✅ Authenticated'), 'Auth status displayed');
    logTest('Shows success message', adminPageText.includes('Simple Authentication Success'), 'Success message found');

    console.log('\n📋 TEST 4: Session Lifecycle');

    // Test session deletion
    const sessionDeletion = await page.evaluate(async () => {
      try {
        const res = await fetch('/api/auth/simple-session', { method: 'DELETE' });
        return { status: res.status, data: await res.json() };
      } catch (e) {
        return { error: e.message };
      }
    });

    logTest('Session deletion works', sessionDeletion.status === 200, `Status: ${sessionDeletion.status}`);
    logTest('Session deletion returns success', sessionDeletion.data?.success === true, 'Success flag set');

    // Verify session is cleared
    const clearedSession = await page.evaluate(async () => {
      try {
        const res = await fetch('/api/auth/simple-session', { method: 'GET' });
        return { status: res.status, data: await res.json() };
      } catch (e) {
        return { error: e.message };
      }
    });

    logTest('Session cleared after deletion', !clearedSession.data?.authenticated, 'Auth status false');

    // Test admin access after session cleared
    await page.goto('http://localhost:9002/simple-test/admin', { waitUntil: 'networkidle0' });
    await new Promise(resolve => setTimeout(resolve, 2000));

    const finalUrl = page.url();
    logTest('Admin redirects to login after session cleared', finalUrl.includes('login'), `URL: ${finalUrl}`);

    console.log('\n📋 TEST 5: Error Handling');

    // Test invalid token
    const invalidToken = await page.evaluate(async () => {
      try {
        const res = await fetch('/api/auth/simple-session', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({}) // No idToken
        });
        return { status: res.status, data: await res.json() };
      } catch (e) {
        return { error: e.message };
      }
    });

    logTest('Handles missing idToken correctly', invalidToken.status === 400, `Status: ${invalidToken.status}`);
    logTest('Returns appropriate error message', invalidToken.data?.error === 'ID token required', 'Error message correct');

    console.log('\n📊 FINAL RESULTS:');
    console.log('================');
    console.log(`✅ Passed: ${testResults.passed}`);
    console.log(`❌ Failed: ${testResults.failed}`);
    console.log(`📊 Total: ${testResults.tests.length}`);
    console.log(`🎯 Success Rate: ${Math.round((testResults.passed / testResults.tests.length) * 100)}%`);

    if (testResults.failed === 0) {
      console.log('\n🎉 ALL TESTS PASSED! 🎉');
      console.log('✅ Simple authentication is working perfectly');
      console.log('✅ Ready for production deployment');
    } else {
      console.log('\n⚠️  SOME TESTS FAILED');
      console.log('❌ Review failed tests before proceeding');
      
      console.log('\nFailed tests:');
      testResults.tests.filter(t => !t.passed).forEach(test => {
        console.log(`  ❌ ${test.name}: ${test.details}`);
      });
    }

    if (consoleMessages.length > 0) {
      console.log('\n📝 Console Messages:');
      consoleMessages.forEach(msg => console.log(`  ${msg}`));
    }

  } catch (error) {
    console.error('❌ Test execution failed:', error.message);
    logTest('Test execution', false, error.message);
  } finally {
    if (browser) {
      await browser.close();
    }
  }

  return testResults;
}

// Run the test
testSimpleAuthentication().then(results => {
  process.exit(results.failed === 0 ? 0 : 1);
});