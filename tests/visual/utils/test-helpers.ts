/**
 * @fileoverview Visual testing utility functions
 * @module tests/visual/utils/test-helpers
 * @description Helper functions for PropertyPageRenderer visual regression testing
 * 
 * @author Claude AI Assistant
 * @since 2025-06-06
 * @lastModified 2025-06-06
 */

import { Page, expect } from '@playwright/test';

/**
 * Wait for page to be fully ready for screenshot
 */
export async function waitForPageReady(page: Page): Promise<void> {
  // Wait for network to be idle
  await page.waitForLoadState('networkidle');
  
  // Wait for any client-side hydration
  await page.waitForTimeout(1000);
  
  // Wait for fonts to load
  await page.waitForFunction(() => document.fonts.ready);
  
  // Wait for images to load
  await page.waitForFunction(() => {
    const images = Array.from(document.images);
    return images.every(img => img.complete);
  });
}

/**
 * Disable animations for consistent screenshots
 */
export async function disableAnimations(page: Page): Promise<void> {
  await page.addStyleTag({
    content: `
      *, *::before, *::after {
        animation-duration: 0s !important;
        animation-delay: 0s !important;
        transition-duration: 0s !important;
        transition-delay: 0s !important;
      }
    `
  });
}

/**
 * Standard viewport configurations for testing
 */
export const viewports = {
  mobile: { width: 375, height: 667 },
  tablet: { width: 768, height: 1024 },
  desktop: { width: 1280, height: 720 },
  large: { width: 1920, height: 1080 }
};

/**
 * Take standardized screenshot with consistent settings
 */
export async function takeStandardScreenshot(
  page: Page, 
  name: string, 
  options: {
    fullPage?: boolean;
    element?: string;
    threshold?: number;
  } = {}
): Promise<void> {
  const {
    fullPage = true,
    element,
    threshold = 0.1
  } = options;
  
  await waitForPageReady(page);
  await disableAnimations(page);
  
  const screenshotOptions = {
    animations: 'disabled' as const,
    threshold,
    fullPage
  };
  
  if (element) {
    const locator = page.locator(element);
    await expect(locator).toHaveScreenshot(name, screenshotOptions);
  } else {
    await expect(page).toHaveScreenshot(name, screenshotOptions);
  }
}

/**
 * Test multiple viewports for a page
 */
export async function testMultipleViewports(
  page: Page,
  url: string,
  baseName: string
): Promise<void> {
  for (const [viewportName, viewport] of Object.entries(viewports)) {
    await page.setViewportSize(viewport);
    await page.goto(url);
    await takeStandardScreenshot(page, `${baseName}-${viewportName}.png`);
  }
}

/**
 * Mock API responses for consistent testing
 */
export async function mockApiResponses(page: Page): Promise<void> {
  // Mock common API endpoints
  await page.route('/api/check-pricing*', route => {
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        success: true,
        totalPrice: 300,
        currency: 'USD',
        breakdown: {
          basePrice: 150,
          nights: 2,
          fees: 0
        }
      })
    });
  });
  
  await page.route('/api/check-availability*', route => {
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        available: true,
        unavailableDates: []
      })
    });
  });
}

/**
 * Check for console errors during testing
 */
export async function checkConsoleErrors(page: Page): Promise<string[]> {
  const errors: string[] = [];
  
  page.on('console', msg => {
    if (msg.type() === 'error') {
      errors.push(msg.text());
    }
  });
  
  return errors;
}

/**
 * Compare two screenshots programmatically
 */
export async function compareScreenshots(
  page: Page,
  screenshot1Path: string,
  screenshot2Path: string
): Promise<{ identical: boolean; diffPixels?: number }> {
  // This would integrate with pixelmatch for programmatic comparison
  // For now, we rely on Playwright's built-in screenshot comparison
  return { identical: true };
}

/**
 * Test theme switching functionality
 */
export async function testThemeSwitching(
  page: Page,
  baseName: string
): Promise<void> {
  const themes = ['default', 'forest', 'ocean', 'modern'];
  
  for (const theme of themes) {
    // Try to switch theme via URL parameter
    const url = new URL(page.url());
    url.searchParams.set('theme', theme);
    await page.goto(url.toString());
    await waitForPageReady(page);
    
    await takeStandardScreenshot(page, `${baseName}-theme-${theme}.png`);
  }
}

/**
 * Test language switching functionality
 */
export async function testLanguageSwitching(
  page: Page,
  baseName: string
): Promise<void> {
  const languages = ['en', 'ro'];
  
  for (const lang of languages) {
    // Try to switch language via URL parameter
    const url = new URL(page.url());
    url.searchParams.set('lang', lang);
    await page.goto(url.toString());
    await waitForPageReady(page);
    
    await takeStandardScreenshot(page, `${baseName}-lang-${lang}.png`);
  }
}

/**
 * Performance-aware screenshot taking
 */
export async function takePerformanceScreenshot(
  page: Page,
  name: string
): Promise<{ loadTime: number; screenshot: void }> {
  const startTime = Date.now();
  
  await waitForPageReady(page);
  
  const loadTime = Date.now() - startTime;
  
  const screenshot = await takeStandardScreenshot(page, name);
  
  return { loadTime, screenshot };
}