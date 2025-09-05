/**
 * @fileoverview Smoke test for visual regression framework
 * @module tests/visual/smoke-test
 * @description Basic validation test to ensure framework setup is working
 * 
 * @author Claude AI Assistant
 * @since 2025-06-06
 * @lastModified 2025-06-06
 */

import { test, expect } from '@playwright/test';

test.describe('Visual Framework Smoke Tests', () => {
  
  test('playwright framework loads correctly', async ({ page }) => {
    // This test validates that Playwright can launch and navigate
    await page.goto('http://localhost:9002');
    
    // Basic page load validation
    await expect(page).toHaveTitle(/RentalSpot - Your Vacation Getaway/);
    
    // Take a simple screenshot to verify capture works
    await expect(page).toHaveScreenshot('smoke-test-homepage.png', {
      threshold: 0.2, // More lenient for smoke test
      animations: 'disabled'
    });
  });
  
  test('screenshot capture functionality', async ({ page }) => {
    await page.goto('http://localhost:9002');
    await page.waitForLoadState('networkidle');
    
    // Test that we can capture specific elements
    const header = page.locator('header, [data-testid="header"]').first();
    
    if (await header.isVisible()) {
      await expect(header).toHaveScreenshot('smoke-test-header.png', {
        animations: 'disabled'
      });
    }
  });
  
  test('cross-viewport functionality', async ({ page }) => {
    // Test mobile viewport
    await page.setViewportSize({ width: 375, height: 667 });
    await page.goto('http://localhost:9002');
    await page.waitForLoadState('networkidle');
    
    await expect(page).toHaveScreenshot('smoke-test-mobile.png', {
      threshold: 0.2,
      animations: 'disabled'
    });
    
    // Test desktop viewport  
    await page.setViewportSize({ width: 1280, height: 720 });
    await page.goto('http://localhost:9002');
    await page.waitForLoadState('networkidle');
    
    await expect(page).toHaveScreenshot('smoke-test-desktop.png', {
      threshold: 0.2,
      animations: 'disabled'
    });
  });
});

test.describe('Configuration Validation', () => {
  
  test('test utilities load correctly', async ({ page }) => {
    // Import our test helpers to ensure they work
    const { waitForPageReady } = await import('./utils/test-helpers');
    
    await page.goto('http://localhost:9002');
    
    // This should not throw errors
    await waitForPageReady(page);
    
    expect(true).toBe(true); // If we get here, utilities loaded correctly
  });
  
  test('test fixtures load correctly', async ({ page }) => {
    // Import test data to ensure it's valid
    const { testProperty, testTemplate } = await import('./fixtures/test-property-data');
    
    // Basic validation that test data is structured correctly
    expect(testProperty.slug).toBeDefined();
    expect(testTemplate.homepage).toBeDefined();
    expect(Array.isArray(testTemplate.homepage)).toBe(true);
  });
});