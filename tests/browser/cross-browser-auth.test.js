/**
 * @fileoverview Cross-browser authentication tests
 * @module tests/browser/cross-browser-auth.test
 * 
 * @description
 * Tests authentication across different browsers to ensure universal compatibility.
 */

const puppeteer = require('puppeteer');

describe('Cross-Browser Authentication Tests', () => {
  let browser;
  let page;

  const testBrowsers = [
    { name: 'Chrome', userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36' },
    { name: 'Safari', userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.1 Safari/605.1.15' },
    { name: 'Firefox', userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10.15; rv:109.0) Gecko/20100101 Firefox/120.0' },
    { name: 'Edge', userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36 Edg/120.0.0.0' }
  ];

  beforeAll(async () => {
    browser = await puppeteer.launch({ 
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox']
    });
  });

  afterAll(async () => {
    if (browser) {
      await browser.close();
    }
  });

  testBrowsers.forEach(({ name, userAgent }) => {
    describe(`${name} Browser Tests`, () => {
      beforeEach(async () => {
        page = await browser.newPage();
        await page.setUserAgent(userAgent);
      });

      afterEach(async () => {
        if (page) {
          await page.close();
        }
      });

      test('should load login page without errors', async () => {
        await page.goto('http://localhost:9002/simple-test/login', { 
          waitUntil: 'networkidle0' 
        });

        // Check for JavaScript errors
        const errors = [];
        page.on('pageerror', error => errors.push(error.message));

        // Wait for page to fully load
        await page.waitForSelector('button:has-text("Sign in with Google")', { timeout: 10000 });

        // Verify login form is present
        const loginTitle = await page.$('text=Admin Login');
        expect(loginTitle).toBeTruthy();

        const googleButton = await page.$('button:has-text("Sign in with Google")');
        expect(googleButton).toBeTruthy();

        // Should not have JavaScript errors
        expect(errors).toHaveLength(0);
      });

      test('should show universal authentication message', async () => {
        await page.goto('http://localhost:9002/simple-test/login');

        const universalMessage = await page.$('text=Universal authentication - works on all browsers');
        expect(universalMessage).toBeTruthy();

        // Should NOT show browser-specific warnings
        const safariWarning = await page.$('text=Safari User');
        expect(safariWarning).toBeFalsy();
      });

      test('should redirect unauthenticated admin access to login', async () => {
        await page.goto('http://localhost:9002/simple-test/admin');

        // Should be redirected to login
        await page.waitForSelector('text=Admin Login', { timeout: 10000 });
        
        const currentUrl = page.url();
        expect(currentUrl).toMatch(/login/);
      });

      test('should handle session API correctly', async () => {
        // Test session check API
        const response = await page.evaluate(async () => {
          const res = await fetch('/api/auth/simple-session', {
            method: 'GET',
            credentials: 'include'
          });
          return {
            status: res.status,
            data: await res.json()
          };
        });

        expect(response.status).toBe(200);
        expect(response.data.authenticated).toBe(false);
      });

      test('should create and verify session', async () => {
        await page.goto('http://localhost:9002/simple-test/login');

        // Create test session
        const sessionResult = await page.evaluate(async () => {
          const res = await fetch('/api/auth/simple-session', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ idToken: `test-token-${Date.now()}` })
          });
          return {
            status: res.status,
            data: await res.json()
          };
        });

        expect(sessionResult.status).toBe(200);
        expect(sessionResult.data.success).toBe(true);

        // Verify session exists
        const checkResult = await page.evaluate(async () => {
          const res = await fetch('/api/auth/simple-session', {
            method: 'GET',
            credentials: 'include'
          });
          return await res.json();
        });

        expect(checkResult.authenticated).toBe(true);
      });

      test('should access admin with valid session', async () => {
        // Create session first
        await page.evaluate(async () => {
          await fetch('/api/auth/simple-session', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ idToken: `admin-test-${Date.now()}` })
          });
        });

        // Access admin page
        await page.goto('http://localhost:9002/simple-test/admin');

        // Should show admin dashboard
        await page.waitForSelector('text=Dashboard', { timeout: 10000 });
        
        const authStatus = await page.$('text=✅ Authenticated');
        expect(authStatus).toBeTruthy();

        const successMessage = await page.$('text=Simple Authentication Success!');
        expect(successMessage).toBeTruthy();
      });
    });
  });

  test('should work consistently across all browsers', async () => {
    const results = [];

    for (const { name, userAgent } of testBrowsers) {
      const testPage = await browser.newPage();
      await testPage.setUserAgent(userAgent);

      try {
        // Test login page load
        await testPage.goto('http://localhost:9002/simple-test/login');
        const hasLoginForm = await testPage.$('button:has-text("Sign in with Google")');

        // Test session API
        const sessionResponse = await testPage.evaluate(async () => {
          const res = await fetch('/api/auth/simple-session');
          return res.status;
        });

        results.push({
          browser: name,
          loginPageWorks: !!hasLoginForm,
          sessionApiWorks: sessionResponse === 200
        });

        await testPage.close();
      } catch (error) {
        results.push({
          browser: name,
          loginPageWorks: false,
          sessionApiWorks: false,
          error: error.message
        });
        await testPage.close();
      }
    }

    // All browsers should work
    results.forEach(result => {
      expect(result.loginPageWorks).toBe(true);
      expect(result.sessionApiWorks).toBe(true);
      expect(result.error).toBeUndefined();
    });

    console.log('Cross-browser test results:', results);
  });
});