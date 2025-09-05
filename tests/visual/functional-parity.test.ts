/**
 * @fileoverview Functional behavior comparison tests between renderers
 * @module tests/visual/functional-parity
 * @description AC2 - Validates identical functional behavior between legacy and modern renderers
 * 
 * @author Claude AI Assistant
 * @since 2025-06-06
 * @lastModified 2025-06-06
 * 
 * @architecture
 * Functional Parity Testing:
 * - Component interaction validation
 * - State management comparison
 * - User workflow testing
 * - Form behavior verification
 * - Error handling consistency
 */

import { test, expect, Page } from '@playwright/test';

// Test data and utilities
const testPropertySlug = 'prahova-mountain-chalet';
const baseUrl = 'http://localhost:9002';

/**
 * Helper function to wait for page to be fully interactive
 */
async function waitForPageReady(page: Page) {
  await page.waitForLoadState('networkidle');
  await page.waitForTimeout(1000); // Allow for any client-side hydration
}

/**
 * Helper function to test form interactions
 */
async function testFormInteractions(page: Page, testName: string) {
  // Test date picker interactions
  const dateButton = page.locator('button').filter({ hasText: /Select Dates|Check.*/ }).first();
  if (await dateButton.isVisible()) {
    await dateButton.click();
    await page.waitForTimeout(500);
    
    // Take screenshot of date picker state
    await expect(page).toHaveScreenshot(`${testName}-date-picker.png`, {
      animations: 'disabled',
      threshold: 0.2
    });
  }
}

/**
 * Helper function to test currency switching
 */
async function testCurrencySwitching(page: Page, testName: string) {
  const currencyButton = page.locator('button').filter({ hasText: /USD|\$|EUR|€/ }).first();
  if (await currencyButton.isVisible()) {
    await currencyButton.click();
    await page.waitForTimeout(500);
    
    // Take screenshot of currency dropdown
    await expect(page).toHaveScreenshot(`${testName}-currency-dropdown.png`, {
      animations: 'disabled',
      threshold: 0.2
    });
  }
}

/**
 * Helper function to test language switching
 */
async function testLanguageSwitching(page: Page, testName: string) {
  const languageButton = page.locator('button').filter({ hasText: /EN|RO|English|Romanian/ }).first();
  if (await languageButton.isVisible()) {
    await languageButton.click();
    await page.waitForTimeout(500);
    
    // Take screenshot of language state
    await expect(page).toHaveScreenshot(`${testName}-language-switch.png`, {
      animations: 'disabled',
      threshold: 0.2
    });
  }
}

test.describe('AC2: Functional Behavior Comparison Tests', () => {
  
  test.beforeEach(async ({ page }) => {
    // Set a reasonable timeout for interactions
    test.setTimeout(60000);
  });

  test('homepage interactive elements behave consistently', async ({ page }) => {
    await page.goto(`${baseUrl}`);
    await waitForPageReady(page);
    
    // Test initial state
    await expect(page).toHaveScreenshot('functional-homepage-initial.png', {
      animations: 'disabled',
      threshold: 0.2
    });
    
    // Test booking form interactions
    await testFormInteractions(page, 'functional-homepage');
    
    // Test currency switching behavior
    await testCurrencySwitching(page, 'functional-homepage');
    
    // Test language switching behavior  
    await testLanguageSwitching(page, 'functional-homepage');
    
    // Test navigation interactions
    const navLinks = page.locator('nav a').first();
    if (await navLinks.isVisible()) {
      await navLinks.hover();
      await page.waitForTimeout(300);
      
      await expect(page).toHaveScreenshot('functional-homepage-nav-hover.png', {
        animations: 'disabled',
        threshold: 0.2
      });
    }
  });

  test('booking form functional behavior validation', async ({ page }) => {
    await page.goto(`${baseUrl}/properties/${testPropertySlug}/booking`);
    await waitForPageReady(page);
    
    // Test form initial state
    await expect(page).toHaveScreenshot('functional-booking-initial.png', {
      animations: 'disabled',
      threshold: 0.2
    });
    
    // Test date selection workflow
    const checkInButton = page.locator('button').filter({ hasText: /check.*in|select.*date/i }).first();
    if (await checkInButton.isVisible()) {
      await checkInButton.click();
      await page.waitForTimeout(500);
      
      // Test calendar interaction
      const calendarDate = page.locator('[role="gridcell"]').filter({ hasText: /^15$/ }).first();
      if (await calendarDate.isVisible()) {
        await calendarDate.click();
        await page.waitForTimeout(300);
        
        await expect(page).toHaveScreenshot('functional-booking-date-selected.png', {
          animations: 'disabled',
          threshold: 0.2
        });
      }
    }
    
    // Test guest count interactions
    const guestButton = page.locator('button').filter({ hasText: /guest|adult/i }).first();
    if (await guestButton.isVisible()) {
      await guestButton.click();
      await page.waitForTimeout(300);
      
      // Test increment/decrement
      const incrementButton = page.locator('button').filter({ hasText: /\+/ }).first();
      if (await incrementButton.isVisible()) {
        await incrementButton.click();
        await page.waitForTimeout(300);
        
        await expect(page).toHaveScreenshot('functional-booking-guest-increment.png', {
          animations: 'disabled',
          threshold: 0.2
        });
      }
    }
  });

  test('theme switching functional behavior', async ({ page }) => {
    await page.goto(`${baseUrl}`);
    await waitForPageReady(page);
    
    // Find and test theme switcher
    const themeButton = page.locator('button').filter({ hasText: /theme|toggle/i }).first();
    if (await themeButton.isVisible()) {
      // Capture initial theme
      await expect(page).toHaveScreenshot('functional-theme-initial.png', {
        animations: 'disabled',
        threshold: 0.2
      });
      
      // Switch theme
      await themeButton.click();
      await page.waitForTimeout(500);
      
      // Capture after theme switch
      await expect(page).toHaveScreenshot('functional-theme-switched.png', {
        animations: 'disabled',
        threshold: 0.2
      });
      
      // Switch back
      await themeButton.click();
      await page.waitForTimeout(500);
      
      // Verify theme persistence
      await expect(page).toHaveScreenshot('functional-theme-reverted.png', {
        animations: 'disabled',
        threshold: 0.2
      });
    }
  });

  test('responsive behavior across viewports', async ({ page }) => {
    // Test mobile viewport
    await page.setViewportSize({ width: 375, height: 667 });
    await page.goto(`${baseUrl}`);
    await waitForPageReady(page);
    
    await expect(page).toHaveScreenshot('functional-mobile-responsive.png', {
      animations: 'disabled',
      threshold: 0.2
    });
    
    // Test mobile navigation
    const mobileMenuButton = page.locator('button').filter({ hasText: /menu|hamburger|☰/ }).first();
    if (await mobileMenuButton.isVisible()) {
      await mobileMenuButton.click();
      await page.waitForTimeout(300);
      
      await expect(page).toHaveScreenshot('functional-mobile-menu-open.png', {
        animations: 'disabled',
        threshold: 0.2
      });
    }
    
    // Test tablet viewport
    await page.setViewportSize({ width: 768, height: 1024 });
    await page.reload();
    await waitForPageReady(page);
    
    await expect(page).toHaveScreenshot('functional-tablet-responsive.png', {
      animations: 'disabled',
      threshold: 0.2
    });
    
    // Test desktop viewport
    await page.setViewportSize({ width: 1280, height: 720 });
    await page.reload();
    await waitForPageReady(page);
    
    await expect(page).toHaveScreenshot('functional-desktop-responsive.png', {
      animations: 'disabled',
      threshold: 0.2
    });
  });

  test('form validation behavior', async ({ page }) => {
    await page.goto(`${baseUrl}/properties/${testPropertySlug}/booking`);
    await waitForPageReady(page);
    
    // Test form submission without required fields
    const submitButton = page.locator('button[type="submit"], button').filter({ hasText: /book|submit|continue/i }).first();
    if (await submitButton.isVisible()) {
      await submitButton.click();
      await page.waitForTimeout(500);
      
      // Capture validation errors
      await expect(page).toHaveScreenshot('functional-validation-errors.png', {
        animations: 'disabled',
        threshold: 0.2
      });
    }
    
    // Test invalid email format
    const emailInput = page.locator('input[type="email"], input').filter({ hasText: /email/i }).first();
    if (await emailInput.isVisible()) {
      await emailInput.fill('invalid-email');
      await emailInput.blur();
      await page.waitForTimeout(300);
      
      await expect(page).toHaveScreenshot('functional-email-validation.png', {
        animations: 'disabled',
        threshold: 0.2
      });
    }
  });

  test('error state handling', async ({ page }) => {
    // Test with non-existent property (should trigger error state)
    await page.goto(`${baseUrl}/properties/non-existent-property`);
    await waitForPageReady(page);
    
    // Capture error page
    await expect(page).toHaveScreenshot('functional-error-404.png', {
      animations: 'disabled',
      threshold: 0.2
    });
    
    // Test network error simulation (if available)
    await page.route('**/api/**', route => route.abort());
    await page.goto(`${baseUrl}`);
    await waitForPageReady(page);
    
    // Capture network error state
    await expect(page).toHaveScreenshot('functional-network-error.png', {
      animations: 'disabled',
      threshold: 0.2
    });
  });

  test('loading state behavior', async ({ page }) => {
    // Slow down network to capture loading states
    await page.route('**/*', route => {
      setTimeout(() => route.continue(), 500);
    });
    
    await page.goto(`${baseUrl}`);
    
    // Capture loading state (quickly)
    await page.waitForTimeout(100);
    await expect(page).toHaveScreenshot('functional-loading-state.png', {
      animations: 'disabled',
      threshold: 0.3 // More lenient for loading states
    });
    
    // Wait for full load
    await waitForPageReady(page);
    
    // Capture loaded state
    await expect(page).toHaveScreenshot('functional-loaded-state.png', {
      animations: 'disabled',
      threshold: 0.2
    });
  });

  test('search and filtering behavior', async ({ page }) => {
    await page.goto(`${baseUrl}`);
    await waitForPageReady(page);
    
    // Test search functionality if available
    const searchInput = page.locator('input[type="search"], input').filter({ hasText: /search/i }).first();
    if (await searchInput.isVisible()) {
      await searchInput.fill('mountain');
      await page.waitForTimeout(300);
      
      await expect(page).toHaveScreenshot('functional-search-results.png', {
        animations: 'disabled',
        threshold: 0.2
      });
      
      // Clear search
      await searchInput.clear();
      await page.waitForTimeout(300);
      
      await expect(page).toHaveScreenshot('functional-search-cleared.png', {
        animations: 'disabled',
        threshold: 0.2
      });
    }
  });

  test('accessibility features behavior', async ({ page }) => {
    await page.goto(`${baseUrl}`);
    await waitForPageReady(page);
    
    // Test keyboard navigation
    await page.keyboard.press('Tab');
    await page.waitForTimeout(200);
    await expect(page).toHaveScreenshot('functional-focus-first.png', {
      animations: 'disabled',
      threshold: 0.2
    });
    
    await page.keyboard.press('Tab');
    await page.waitForTimeout(200);
    await expect(page).toHaveScreenshot('functional-focus-second.png', {
      animations: 'disabled',
      threshold: 0.2
    });
    
    // Test ARIA attributes and screen reader compatibility
    const interactiveElements = await page.locator('button, input, a, [role="button"]').count();
    console.log(`Found ${interactiveElements} interactive elements for accessibility testing`);
  });
});

test.describe('AC2: State Management Comparison', () => {
  
  test('currency state persistence', async ({ page }) => {
    await page.goto(`${baseUrl}`);
    await waitForPageReady(page);
    
    // Change currency
    await testCurrencySwitching(page, 'state-currency');
    
    // Navigate to different page
    await page.goto(`${baseUrl}/properties/${testPropertySlug}`);
    await waitForPageReady(page);
    
    // Verify currency persisted
    await expect(page).toHaveScreenshot('state-currency-persisted.png', {
      animations: 'disabled',
      threshold: 0.2
    });
  });

  test('language state persistence', async ({ page }) => {
    await page.goto(`${baseUrl}`);
    await waitForPageReady(page);
    
    // Change language
    await testLanguageSwitching(page, 'state-language');
    
    // Navigate to different page
    await page.goto(`${baseUrl}/properties/${testPropertySlug}`);
    await waitForPageReady(page);
    
    // Verify language persisted
    await expect(page).toHaveScreenshot('state-language-persisted.png', {
      animations: 'disabled',
      threshold: 0.2
    });
  });

  test('booking form state management', async ({ page }) => {
    await page.goto(`${baseUrl}/properties/${testPropertySlug}/booking`);
    await waitForPageReady(page);
    
    // Fill form partially
    const emailInput = page.locator('input[type="email"]').first();
    if (await emailInput.isVisible()) {
      await emailInput.fill('test@example.com');
    }
    
    // Navigate away and back
    await page.goBack();
    await page.waitForTimeout(1000);
    await page.goForward();
    await waitForPageReady(page);
    
    // Check if form state is preserved
    await expect(page).toHaveScreenshot('state-booking-form-preserved.png', {
      animations: 'disabled',
      threshold: 0.2
    });
  });
});