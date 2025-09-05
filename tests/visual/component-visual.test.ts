/**
 * @fileoverview Component-level visual validation tests
 * @module tests/visual/component-visual
 * @description AC3 - Individual component visual regression testing
 * 
 * @author Claude AI Assistant
 * @since 2025-06-06
 * @lastModified 2025-06-06
 * 
 * @architecture
 * Component Visual Testing:
 * - Individual component isolation
 * - State variation testing
 * - Theme and styling validation
 * - Responsive component behavior
 * - Accessibility visual checks
 */

import { test, expect, Page, Locator } from '@playwright/test';

/**
 * Helper to isolate and test individual components
 */
async function testComponentVisually(
  page: Page, 
  selector: string, 
  componentName: string, 
  options: { threshold?: number; mask?: Locator[] } = {}
) {
  const component = page.locator(selector).first();
  
  if (await component.isVisible()) {
    await expect(component).toHaveScreenshot(`component-${componentName}.png`, {
      animations: 'disabled',
      threshold: options.threshold || 0.1,
      mask: options.mask
    });
    return true;
  }
  return false;
}

/**
 * Test component in different states
 */
async function testComponentStates(
  page: Page,
  selector: string,
  componentName: string,
  states: Array<{ name: string; action: () => Promise<void> }>
) {
  const component = page.locator(selector).first();
  
  if (await component.isVisible()) {
    // Test initial state
    await expect(component).toHaveScreenshot(`component-${componentName}-initial.png`, {
      animations: 'disabled',
      threshold: 0.1
    });
    
    // Test each state
    for (const state of states) {
      await state.action();
      await page.waitForTimeout(300); // Allow for state transition
      
      await expect(component).toHaveScreenshot(`component-${componentName}-${state.name}.png`, {
        animations: 'disabled',
        threshold: 0.1
      });
    }
  }
}

test.describe('AC3: Component-Level Visual Validation', () => {
  
  test.beforeEach(async ({ page }) => {
    await page.goto('http://localhost:9002');
    await page.waitForLoadState('networkidle');
  });

  test('header component visual validation', async ({ page }) => {
    // Test main header
    await testComponentVisually(page, 'header, [data-testid="header"]', 'header');
    
    // Test header navigation
    await testComponentVisually(page, 'nav, header nav', 'navigation');
    
    // Test header interactions
    const headerStates = [
      {
        name: 'menu-hover',
        action: async () => {
          const menuItem = page.locator('nav a').first();
          if (await menuItem.isVisible()) {
            await menuItem.hover();
          }
        }
      },
      {
        name: 'currency-dropdown',
        action: async () => {
          const currencyButton = page.locator('button').filter({ hasText: /USD|EUR|\$/ }).first();
          if (await currencyButton.isVisible()) {
            await currencyButton.click();
          }
        }
      },
      {
        name: 'language-dropdown',
        action: async () => {
          const langButton = page.locator('button').filter({ hasText: /EN|RO/ }).first();
          if (await langButton.isVisible()) {
            await langButton.click();
          }
        }
      }
    ];
    
    await testComponentStates(page, 'header', 'header-interactive', headerStates);
  });

  test('hero section component validation', async ({ page }) => {
    // Test hero section
    await testComponentVisually(page, 'section:first-child, .hero, [data-testid="hero"]', 'hero-section');
    
    // Test hero with booking form
    await testComponentVisually(page, '.hero form, form[data-testid="booking"]', 'hero-booking-form');
    
    // Test hero at different viewport sizes
    const viewports = [
      { width: 375, height: 667, name: 'mobile' },
      { width: 768, height: 1024, name: 'tablet' },
      { width: 1280, height: 720, name: 'desktop' },
      { width: 1920, height: 1080, name: 'large-desktop' }
    ];
    
    for (const viewport of viewports) {
      await page.setViewportSize(viewport);
      await page.waitForTimeout(500);
      
      await testComponentVisually(
        page, 
        'section:first-child, .hero, [data-testid="hero"]', 
        `hero-${viewport.name}`
      );
    }
    
    // Reset to default viewport
    await page.setViewportSize({ width: 1280, height: 720 });
  });

  test('booking form component validation', async ({ page }) => {
    // Navigate to dedicated booking page for better component isolation
    await page.goto('http://localhost:9002/properties/prahova-mountain-chalet/booking');
    await page.waitForLoadState('networkidle');
    
    // Test main booking form
    await testComponentVisually(page, 'form, [data-testid="booking-form"]', 'booking-form');
    
    // Test form field components
    await testComponentVisually(page, 'input[type="email"], .email-field', 'booking-email-field');
    await testComponentVisually(page, '.date-picker, [data-testid="date-picker"]', 'booking-date-picker');
    await testComponentVisually(page, '.guest-selector, [data-testid="guest-selector"]', 'booking-guest-selector');
    
    // Test form states
    const bookingFormStates = [
      {
        name: 'date-picker-open',
        action: async () => {
          const dateButton = page.locator('button').filter({ hasText: /select.*date|check.*in/i }).first();
          if (await dateButton.isVisible()) {
            await dateButton.click();
          }
        }
      },
      {
        name: 'guest-selector-open',
        action: async () => {
          const guestButton = page.locator('button').filter({ hasText: /guest|adult/i }).first();
          if (await guestButton.isVisible()) {
            await guestButton.click();
          }
        }
      },
      {
        name: 'form-filled',
        action: async () => {
          const emailInput = page.locator('input[type="email"]').first();
          if (await emailInput.isVisible()) {
            await emailInput.fill('test@example.com');
          }
        }
      },
      {
        name: 'validation-errors',
        action: async () => {
          const submitButton = page.locator('button[type="submit"], button').filter({ hasText: /book|submit/i }).first();
          if (await submitButton.isVisible()) {
            await submitButton.click();
          }
        }
      }
    ];
    
    await testComponentStates(page, 'form, [data-testid="booking-form"]', 'booking-form', bookingFormStates);
  });

  test('pricing display component validation', async ({ page }) => {
    // Test pricing components
    await testComponentVisually(page, '.price, [data-testid="price"]', 'price-display');
    await testComponentVisually(page, '.pricing-summary, [data-testid="pricing-summary"]', 'pricing-summary');
    
    // Test pricing with different currencies
    const currencies = ['USD', 'EUR', 'RON'];
    
    for (const currency of currencies) {
      const currencyButton = page.locator('button').filter({ hasText: new RegExp(currency, 'i') }).first();
      if (await currencyButton.isVisible()) {
        await currencyButton.click();
        await page.waitForTimeout(500);
        
        await testComponentVisually(
          page, 
          '.price, [data-testid="price"]', 
          `price-display-${currency.toLowerCase()}`
        );
      }
    }
  });

  test('image gallery component validation', async ({ page }) => {
    // Test gallery components
    await testComponentVisually(page, '.gallery, [data-testid="gallery"]', 'image-gallery');
    
    // Test gallery interactions
    const galleryStates = [
      {
        name: 'image-hover',
        action: async () => {
          const firstImage = page.locator('.gallery img, [data-testid="gallery"] img').first();
          if (await firstImage.isVisible()) {
            await firstImage.hover();
          }
        }
      },
      {
        name: 'image-clicked',
        action: async () => {
          const firstImage = page.locator('.gallery img, [data-testid="gallery"] img').first();
          if (await firstImage.isVisible()) {
            await firstImage.click();
          }
        }
      }
    ];
    
    await testComponentStates(page, '.gallery, [data-testid="gallery"]', 'gallery', galleryStates);
  });

  test('amenities component validation', async ({ page }) => {
    // Test amenities display
    await testComponentVisually(page, '.amenities, [data-testid="amenities"]', 'amenities-list');
    
    // Test individual amenity items
    const amenityItems = page.locator('.amenity-item, .amenities li, [data-testid="amenity"]');
    const amenityCount = await amenityItems.count();
    
    if (amenityCount > 0) {
      // Test first few amenity items
      for (let i = 0; i < Math.min(amenityCount, 3); i++) {
        await expect(amenityItems.nth(i)).toHaveScreenshot(`component-amenity-item-${i}.png`, {
          animations: 'disabled',
          threshold: 0.1
        });
      }
    }
  });

  test('testimonials component validation', async ({ page }) => {
    // Test testimonials section
    await testComponentVisually(page, '.testimonials, [data-testid="testimonials"]', 'testimonials-section');
    
    // Test individual testimonial cards
    const testimonialCards = page.locator('.testimonial, .testimonials .card, [data-testid="testimonial"]');
    const cardCount = await testimonialCards.count();
    
    if (cardCount > 0) {
      for (let i = 0; i < Math.min(cardCount, 2); i++) {
        await expect(testimonialCards.nth(i)).toHaveScreenshot(`component-testimonial-${i}.png`, {
          animations: 'disabled',
          threshold: 0.1
        });
      }
    }
  });

  test('footer component validation', async ({ page }) => {
    // Scroll to footer
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
    await page.waitForTimeout(500);
    
    // Test footer
    await testComponentVisually(page, 'footer, [data-testid="footer"]', 'footer');
    
    // Test footer sections
    await testComponentVisually(page, 'footer nav, footer .links', 'footer-navigation');
    await testComponentVisually(page, 'footer .contact, footer .contact-info', 'footer-contact');
    await testComponentVisually(page, 'footer .social, footer .social-links', 'footer-social');
  });

  test('theme switcher component validation', async ({ page }) => {
    // Find theme switcher
    const themeButton = page.locator('button').filter({ hasText: /theme|toggle/i }).first();
    
    if (await themeButton.isVisible()) {
      // Test theme button
      await testComponentVisually(page, 'button', 'theme-switcher', {
        threshold: 0.15 // More lenient for theme variations
      });
      
      // Test theme switching
      const themeStates = [
        {
          name: 'theme-switched',
          action: async () => {
            await themeButton.click();
          }
        },
        {
          name: 'theme-reverted',
          action: async () => {
            await themeButton.click();
          }
        }
      ];
      
      await testComponentStates(page, 'body, html', 'page-theme', themeStates);
    }
  });

  test('loading states component validation', async ({ page }) => {
    // Test loading components by simulating slow network
    await page.route('**/*', route => {
      setTimeout(() => route.continue(), 200);
    });
    
    const loadingPage = await page.context().newPage();
    await loadingPage.goto('http://localhost:9002');
    
    // Try to capture loading states quickly
    await loadingPage.waitForTimeout(100);
    
    // Test skeleton loaders or loading spinners
    const loadingElements = [
      '.loading, [data-testid="loading"]',
      '.skeleton, [data-testid="skeleton"]',
      '.spinner, [data-testid="spinner"]'
    ];
    
    for (const selector of loadingElements) {
      const element = loadingPage.locator(selector).first();
      if (await element.isVisible()) {
        await expect(element).toHaveScreenshot(`component-loading-${selector.replace(/[^\w]/g, '')}.png`, {
          animations: 'disabled',
          threshold: 0.2
        });
      }
    }
    
    await loadingPage.close();
  });

  test('error states component validation', async ({ page }) => {
    // Test error boundary components
    await page.goto('http://localhost:9002/properties/non-existent-property');
    await page.waitForLoadState('networkidle');
    
    // Test error page components
    await testComponentVisually(page, '.error, [data-testid="error"]', 'error-component');
    await testComponentVisually(page, '.error-message, .error-text', 'error-message');
    await testComponentVisually(page, '.error-actions, .error-buttons', 'error-actions');
  });

  test('form validation component validation', async ({ page }) => {
    await page.goto('http://localhost:9002/properties/prahova-mountain-chalet/booking');
    await page.waitForLoadState('networkidle');
    
    // Trigger validation errors
    const submitButton = page.locator('button[type="submit"], button').filter({ hasText: /book|submit/i }).first();
    if (await submitButton.isVisible()) {
      await submitButton.click();
      await page.waitForTimeout(500);
      
      // Test validation error components
      await testComponentVisually(page, '.error, .validation-error, [data-testid="error"]', 'validation-error');
      await testComponentVisually(page, '.field-error, .input-error', 'field-error');
    }
    
    // Test invalid email validation
    const emailInput = page.locator('input[type="email"]').first();
    if (await emailInput.isVisible()) {
      await emailInput.fill('invalid-email');
      await emailInput.blur();
      await page.waitForTimeout(300);
      
      await testComponentVisually(page, '.email-field, .field', 'email-validation-error');
    }
  });
});

test.describe('AC3: Component Accessibility Visual Checks', () => {
  
  test('focus states visual validation', async ({ page }) => {
    await page.goto('http://localhost:9002');
    await page.waitForLoadState('networkidle');
    
    // Test focus states for interactive elements
    const interactiveElements = [
      'button',
      'input',
      'a',
      '[role="button"]',
      '[tabindex="0"]'
    ];
    
    for (const selector of interactiveElements) {
      const elements = page.locator(selector);
      const count = await elements.count();
      
      if (count > 0) {
        // Test first few elements of each type
        for (let i = 0; i < Math.min(count, 2); i++) {
          const element = elements.nth(i);
          if (await element.isVisible()) {
            await element.focus();
            await page.waitForTimeout(200);
            
            await expect(element).toHaveScreenshot(`component-focus-${selector.replace(/[^\w]/g, '')}-${i}.png`, {
              animations: 'disabled',
              threshold: 0.1
            });
          }
        }
      }
    }
  });

  test('high contrast mode validation', async ({ page }) => {
    // Simulate high contrast mode with custom CSS
    await page.goto('http://localhost:9002');
    await page.waitForLoadState('networkidle');
    
    await page.addStyleTag({
      content: `
        * {
          filter: contrast(200%) brightness(150%) !important;
        }
      `
    });
    
    await page.waitForTimeout(500);
    
    // Test high contrast rendering
    await testComponentVisually(page, 'body', 'high-contrast-page', { threshold: 0.3 });
    await testComponentVisually(page, 'header', 'high-contrast-header', { threshold: 0.3 });
    await testComponentVisually(page, 'form, [data-testid="booking-form"]', 'high-contrast-form', { threshold: 0.3 });
  });

  test('reduced motion validation', async ({ page }) => {
    // Test with reduced motion preference
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.goto('http://localhost:9002');
    await page.waitForLoadState('networkidle');
    
    // Test that animations are properly reduced
    await testComponentVisually(page, 'body', 'reduced-motion-page');
    
    // Test interactive elements with reduced motion
    const themeButton = page.locator('button').filter({ hasText: /theme/i }).first();
    if (await themeButton.isVisible()) {
      await themeButton.click();
      await page.waitForTimeout(100); // Shorter wait for reduced motion
      
      await testComponentVisually(page, 'body', 'reduced-motion-theme-switched');
    }
  });
});

test.describe('AC3: Component Responsive Validation', () => {
  
  test('component breakpoint behavior', async ({ page }) => {
    const breakpoints = [
      { width: 320, height: 568, name: 'small-mobile' },
      { width: 375, height: 667, name: 'mobile' },
      { width: 768, height: 1024, name: 'tablet' },
      { width: 1024, height: 768, name: 'laptop' },
      { width: 1280, height: 720, name: 'desktop' },
      { width: 1920, height: 1080, name: 'large-desktop' }
    ];
    
    await page.goto('http://localhost:9002');
    
    for (const breakpoint of breakpoints) {
      await page.setViewportSize(breakpoint);
      await page.waitForTimeout(500);
      
      // Test key components at each breakpoint
      await testComponentVisually(page, 'header', `responsive-header-${breakpoint.name}`);
      await testComponentVisually(page, '.hero, section:first-child', `responsive-hero-${breakpoint.name}`);
      await testComponentVisually(page, 'form, [data-testid="booking-form"]', `responsive-form-${breakpoint.name}`);
    }
  });

  test('component overflow and text wrapping', async ({ page }) => {
    // Test with very narrow viewport to check text wrapping
    await page.setViewportSize({ width: 280, height: 600 });
    await page.goto('http://localhost:9002');
    await page.waitForLoadState('networkidle');
    
    // Test components handle narrow spaces well
    await testComponentVisually(page, 'header', 'narrow-header');
    await testComponentVisually(page, '.hero h1, h1', 'narrow-title');
    await testComponentVisually(page, 'form, [data-testid="booking-form"]', 'narrow-form');
    
    // Test with very wide viewport
    await page.setViewportSize({ width: 2560, height: 1440 });
    await page.reload();
    await page.waitForLoadState('networkidle');
    
    await testComponentVisually(page, 'body', 'wide-page-layout');
    await testComponentVisually(page, 'header', 'wide-header');
  });
});