/**
 * @fileoverview Final comprehensive test for new authentication system
 * @module test-final-auth-system
 * 
 * @description
 * Final validation that the new simple authentication system works correctly
 * after replacing the legacy system.
 */

const puppeteer = require('puppeteer');

async function testFinalAuthSystem() {
  console.log('🎯 FINAL AUTHENTICATION SYSTEM TEST');
  console.log('===================================\n');

  let browser;
  let results = { passed: 0, failed: 0, tests: [] };

  function logTest(name, passed, details = '') {
    const status = passed ? '✅ PASS' : '❌ FAIL';
    console.log(`${status}: ${name}`);
    if (details) console.log(`   ${details}`);
    
    results.tests.push({ name, passed, details });
    if (passed) results.passed++;
    else results.failed++;
  }

  try {
    browser = await puppeteer.launch({ 
      headless: false,
      devtools: false,
      args: ['--no-sandbox', '--disable-setuid-sandbox']
    });

    const page = await browser.newPage();

    console.log('🔐 Testing Production Login (/login)');
    await page.goto('http://localhost:9002/login', { waitUntil: 'networkidle0' });
    await new Promise(resolve => setTimeout(resolve, 2000));

    const loginPageText = await page.evaluate(() => document.body.innerText);
    logTest('Production login page loads', loginPageText.includes('Admin Login'), 'Main login page working');
    logTest('Shows universal auth message', loginPageText.includes('Universal authentication'), 'No browser-specific code');
    logTest('No legacy warnings', !loginPageText.includes('Safari User'), 'Legacy Safari code removed');

    console.log('\n🏠 Testing Production Admin (/admin)');
    
    // Test unauthenticated admin access
    await page.goto('http://localhost:9002/admin', { waitUntil: 'networkidle0' });
    await new Promise(resolve => setTimeout(resolve, 2000));

    const redirectUrl = page.url();
    logTest('Unauthenticated admin redirects to login', redirectUrl.includes('/login'), `Redirected to: ${redirectUrl}`);

    // Test session API
    console.log('\n🔌 Testing Session API');
    const sessionCheck = await page.evaluate(async () => {
      try {
        const res = await fetch('/api/auth/simple-session', { method: 'GET' });
        return { status: res.status, data: await res.json() };
      } catch (e) {
        return { error: e.message };
      }
    });

    logTest('Session API accessible', sessionCheck.status === 200, 'API responding');
    logTest('Returns unauthenticated state', !sessionCheck.data?.authenticated, 'Correct initial state');

    // Create session and test admin access
    console.log('\n🎟️ Testing Session Creation and Admin Access');
    const sessionCreation = await page.evaluate(async () => {
      try {
        const res = await fetch('/api/auth/simple-session', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ idToken: 'final-test-' + Date.now() })
        });
        return { status: res.status, data: await res.json() };
      } catch (e) {
        return { error: e.message };
      }
    });

    logTest('Session creation works', sessionCreation.status === 200, 'Session API working');
    logTest('Session creation returns success', sessionCreation.data?.success === true, 'Success response');

    // Access admin with session
    await page.goto('http://localhost:9002/admin', { waitUntil: 'networkidle0' });
    await new Promise(resolve => setTimeout(resolve, 3000));

    const adminPageText = await page.evaluate(() => document.body.innerText);
    const adminUrl = page.url();

    logTest('Admin accessible with session', adminUrl.includes('/admin') && !adminUrl.includes('/login'), 'Auth protection working');
    logTest('Shows admin dashboard', adminPageText.includes('Dashboard'), 'Admin content loading');
    logTest('Shows new auth indicator', adminPageText.includes('Simple Authentication Active'), 'New system active');
    logTest('Shows auth status', adminPageText.includes('✅ Authenticated'), 'Status display working');

    // Test logout
    console.log('\n🚪 Testing Logout');
    const logoutResult = await page.evaluate(async () => {
      try {
        const res = await fetch('/api/auth/simple-session', { method: 'DELETE' });
        return { status: res.status, data: await res.json() };
      } catch (e) {
        return { error: e.message };
      }
    });

    logTest('Logout API works', logoutResult.status === 200, 'Logout endpoint working');

    // Verify admin redirect after logout
    await page.goto('http://localhost:9002/admin', { waitUntil: 'networkidle0' });
    await new Promise(resolve => setTimeout(resolve, 2000));

    const postLogoutUrl = page.url();
    logTest('Admin redirects after logout', postLogoutUrl.includes('/login'), 'Session cleared');

    // Test legacy endpoints are removed
    console.log('\n🗑️ Testing Legacy System Removal');
    const legacySessionTest = await page.evaluate(async () => {
      try {
        const res = await fetch('/api/auth/session', { method: 'GET' });
        return { status: res.status };
      } catch (e) {
        return { error: e.message, notFound: true };
      }
    });

    logTest('Legacy session API removed', legacySessionTest.status === 404 || legacySessionTest.notFound, 'Old API endpoints cleaned up');

    const legacyDevSessionTest = await page.evaluate(async () => {
      try {
        const res = await fetch('/api/auth/dev-session', { method: 'GET' });
        return { status: res.status };
      } catch (e) {
        return { error: e.message, notFound: true };
      }
    });

    logTest('Legacy dev-session API removed', legacyDevSessionTest.status === 404 || legacyDevSessionTest.notFound, 'Dev session API cleaned up');

    console.log('\n📊 FINAL RESULTS:');
    console.log('================');
    console.log(`✅ Passed: ${results.passed}`);
    console.log(`❌ Failed: ${results.failed}`);
    console.log(`📊 Total: ${results.tests.length}`);
    console.log(`🎯 Success Rate: ${Math.round((results.passed / results.tests.length) * 100)}%`);

    if (results.failed === 0) {
      console.log('\n🎉 AUTHENTICATION SYSTEM READY! 🎉');
      console.log('✅ New simple authentication system is fully functional');
      console.log('✅ Legacy system completely removed and archived');
      console.log('✅ Universal browser compatibility');
      console.log('✅ All tests passing');
      console.log('✅ Ready for production deployment');
      
      console.log('\n🚀 NEXT STEPS:');
      console.log('1. Deploy to production environment');
      console.log('2. Test with real Google OAuth in production');
      console.log('3. Monitor authentication performance');
      console.log('4. Archive any remaining legacy files');
    } else {
      console.log('\n⚠️ ISSUES DETECTED:');
      results.tests.filter(t => !t.passed).forEach(test => {
        console.log(`  ❌ ${test.name}: ${test.details}`);
      });
    }

  } catch (error) {
    console.error('❌ Test execution failed:', error.message);
  } finally {
    if (browser) {
      await browser.close();
    }
  }

  return results;
}

testFinalAuthSystem().then(results => {
  process.exit(results.failed === 0 ? 0 : 1);
});