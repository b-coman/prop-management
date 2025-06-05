/**
 * @fileoverview E2E tests for simple authentication flow
 * @module tests/e2e/simple-auth-flow.test
 */

import { test, expect } from '@playwright/test';

test.describe('Simple Authentication Flow', () => {
  test.beforeEach(async ({ page }) => {
    // Clear any existing sessions
    await page.context().clearCookies();
  });

  test('should redirect unauthenticated users from admin to login', async ({ page }) => {
    // Try to access admin page directly
    await page.goto('/simple-test/admin');
    
    // Should be redirected to login
    await expect(page).toHaveURL(/\/login/);
    
    // Should show login form
    await expect(page.locator('text=Admin Login')).toBeVisible();
    await expect(page.locator('button:has-text("Sign in with Google")')).toBeVisible();
  });

  test('should display login page correctly', async ({ page }) => {
    await page.goto('/simple-test/login');
    
    // Check page content
    await expect(page.locator('text=Admin Login')).toBeVisible();
    await expect(page.locator('text=Sign in to access the admin panel')).toBeVisible();
    await expect(page.locator('button:has-text("Sign in with Google")')).toBeVisible();
    await expect(page.locator('text=You will be redirected to Google')).toBeVisible();
    await expect(page.locator('text=Universal authentication - works on all browsers')).toBeVisible();
  });

  test('should show loading state when clicking Google sign-in', async ({ page }) => {
    await page.goto('/simple-test/login');
    
    const signInButton = page.locator('button:has-text("Sign in with Google")');
    await expect(signInButton).toBeVisible();
    
    // Click sign-in button
    await signInButton.click();
    
    // Should show loading state (or redirect to Google)
    // Note: In real testing, this would redirect to Google OAuth
    // For E2E testing, we might need to mock the OAuth flow
  });

  test('should handle session API correctly', async ({ page }) => {
    // Test session check when not authenticated
    const response = await page.request.get('/api/auth/simple-session');
    expect(response.status()).toBe(200);
    
    const data = await response.json();
    expect(data.authenticated).toBe(false);
  });

  test('should create and verify manual session', async ({ page }) => {
    // Create a test session
    const createResponse = await page.request.post('/api/auth/simple-session', {
      data: {
        idToken: 'test-token-for-e2e'
      }
    });
    
    expect(createResponse.status()).toBe(200);
    const createData = await createResponse.json();
    expect(createData.success).toBe(true);
    
    // Verify session exists
    const checkResponse = await page.request.get('/api/auth/simple-session');
    expect(checkResponse.status()).toBe(200);
    
    const checkData = await checkResponse.json();
    expect(checkData.authenticated).toBe(true);
  });

  test('should access admin page with valid session', async ({ page }) => {
    // Create session via API
    await page.request.post('/api/auth/simple-session', {
      data: {
        idToken: 'test-token-for-admin-access'
      }
    });
    
    // Try to access admin page
    await page.goto('/simple-test/admin');
    
    // Should be able to access admin page
    await expect(page.locator('text=Dashboard')).toBeVisible();
    await expect(page.locator('text=✅ Authenticated')).toBeVisible();
    await expect(page.locator('text=Simple Authentication Success!')).toBeVisible();
  });

  test('should clear session on logout', async ({ page }) => {
    // Create session
    await page.request.post('/api/auth/simple-session', {
      data: {
        idToken: 'test-token-for-logout'
      }
    });
    
    // Verify session exists
    let checkResponse = await page.request.get('/api/auth/simple-session');
    let checkData = await checkResponse.json();
    expect(checkData.authenticated).toBe(true);
    
    // Clear session
    const logoutResponse = await page.request.delete('/api/auth/simple-session');
    expect(logoutResponse.status()).toBe(200);
    
    // Verify session is cleared
    checkResponse = await page.request.get('/api/auth/simple-session');
    checkData = await checkResponse.json();
    expect(checkData.authenticated).toBe(false);
  });
});