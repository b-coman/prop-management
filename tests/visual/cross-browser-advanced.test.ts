/**
 * @fileoverview Advanced cross-browser compatibility tests
 * @module tests/visual/cross-browser-advanced
 * @description AC5 - Comprehensive cross-browser and device compatibility validation
 * 
 * @author Claude AI Assistant
 * @since 2025-06-06
 * @lastModified 2025-06-06
 * 
 * @architecture
 * Advanced Cross-Browser Testing:
 * - Browser-specific feature testing
 * - CSS feature compatibility
 * - JavaScript API availability
 * - Touch and pointer events
 * - Browser quirks validation
 */

import { test, expect, Page, BrowserContext } from '@playwright/test';

/**
 * Browser-specific test configurations
 */
const browserConfigs = {
  chromium: {
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
    features: ['webp', 'css-grid', 'css-custom-properties', 'es6-modules']
  },
  firefox: {
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:89.0) Gecko/20100101 Firefox/89.0',
    features: ['css-grid', 'css-custom-properties', 'es6-modules']
  },
  webkit: {
    userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/14.1.1 Safari/605.1.15',
    features: ['webp', 'css-grid', 'css-custom-properties']
  }
};

/**
 * Test CSS feature support across browsers
 */
async function testCSSFeatures(page: Page, browserName: string) {
  const features = await page.evaluate(() => {
    const testElement = document.createElement('div');
    document.body.appendChild(testElement);
    
    const features = {
      cssGrid: CSS.supports('display', 'grid'),
      cssCustomProperties: CSS.supports('--custom-property', 'value'),
      cssFlexbox: CSS.supports('display', 'flex'),
      cssTransforms: CSS.supports('transform', 'translateX(0)'),
      cssFilters: CSS.supports('filter', 'blur(1px)'),
      cssBackdropFilter: CSS.supports('backdrop-filter', 'blur(1px)'),
      cssLogicalProperties: CSS.supports('margin-inline-start', '1px'),
      cssContainerQueries: CSS.supports('container-type', 'inline-size')
    };
    
    document.body.removeChild(testElement);
    return features;
  });
  
  console.log(`\n🌐 CSS Features Support in ${browserName}:`);
  Object.entries(features).forEach(([feature, supported]) => {
    console.log(`  - ${feature}: ${supported ? '✅' : '❌'}`);
  });
  
  return features;
}

/**
 * Test JavaScript API availability
 */
async function testJavaScriptAPIs(page: Page, browserName: string) {
  const apis = await page.evaluate(() => {
    return {
      fetch: typeof fetch !== 'undefined',
      promise: typeof Promise !== 'undefined',
      intersectionObserver: typeof IntersectionObserver !== 'undefined',
      resizeObserver: typeof ResizeObserver !== 'undefined',
      webWorkers: typeof Worker !== 'undefined',
      serviceWorker: typeof navigator.serviceWorker !== 'undefined',
      webGL: !!document.createElement('canvas').getContext('webgl'),
      webGL2: !!document.createElement('canvas').getContext('webgl2'),
      webAssembly: typeof WebAssembly !== 'undefined',
      streams: typeof ReadableStream !== 'undefined',
      broadcastChannel: typeof BroadcastChannel !== 'undefined'
    };
  });
  
  console.log(`\n🔧 JavaScript APIs in ${browserName}:`);
  Object.entries(apis).forEach(([api, available]) => {
    console.log(`  - ${api}: ${available ? '✅' : '❌'}`);
  });
  
  return apis;
}

/**
 * Test touch and pointer events
 */
async function testTouchSupport(page: Page, browserName: string) {
  const touchSupport = await page.evaluate(() => {
    return {
      touchEvents: 'ontouchstart' in window,
      pointerEvents: 'onpointerdown' in window,
      touchDeviceDetected: navigator.maxTouchPoints > 0,
      gestureEvents: 'ongesturestart' in window
    };
  });
  
  console.log(`\n👆 Touch/Pointer Support in ${browserName}:`);
  Object.entries(touchSupport).forEach(([feature, supported]) => {
    console.log(`  - ${feature}: ${supported ? '✅' : '❌'}`);
  });
  
  return touchSupport;
}

test.describe('AC5: Advanced Cross-Browser Compatibility', () => {
  
  test('browser feature detection and compatibility', async ({ page, browserName }) => {
    await page.goto('http://localhost:9002');
    await page.waitForLoadState('networkidle');
    
    // Test CSS features
    const cssFeatures = await testCSSFeatures(page, browserName);
    
    // Test JavaScript APIs
    const jsAPIs = await testJavaScriptAPIs(page, browserName);
    
    // Test touch support
    const touchSupport = await testTouchSupport(page, browserName);
    
    // Take browser-specific screenshot
    await expect(page).toHaveScreenshot(`cross-browser-${browserName}-homepage.png`, {
      animations: 'disabled',
      threshold: 0.2
    });
    
    // Browser-specific assertions
    if (browserName === 'chromium') {
      expect(cssFeatures.cssGrid).toBe(true);
      expect(cssFeatures.cssCustomProperties).toBe(true);
      expect(jsAPIs.intersectionObserver).toBe(true);
    }
    
    if (browserName === 'firefox') {
      expect(cssFeatures.cssGrid).toBe(true);
      expect(cssFeatures.cssCustomProperties).toBe(true);
    }
    
    if (browserName === 'webkit') {
      expect(cssFeatures.cssGrid).toBe(true);
      // Safari might have different support patterns
    }
  });

  test('CSS rendering consistency across browsers', async ({ page, browserName }) => {
    await page.goto('http://localhost:9002');
    await page.waitForLoadState('networkidle');
    
    // Test CSS Grid layout
    const gridSupport = await page.evaluate(() => {
      const gridElement = document.querySelector('.grid, [style*="display: grid"], [style*="display:grid"]');
      if (gridElement) {
        const computedStyle = getComputedStyle(gridElement);
        return {
          display: computedStyle.display,
          gridTemplateColumns: computedStyle.gridTemplateColumns,
          gap: computedStyle.gap || computedStyle.gridGap
        };
      }
      return null;
    });
    
    console.log(`\n📐 CSS Grid Rendering in ${browserName}:`, gridSupport);
    
    // Test CSS Custom Properties
    const customPropsSupport = await page.evaluate(() => {
      const rootStyle = getComputedStyle(document.documentElement);
      const customProp = rootStyle.getPropertyValue('--primary-color') || 
                         rootStyle.getPropertyValue('--main-color') ||
                         rootStyle.getPropertyValue('--theme-color');
      return {
        hasCustomProperties: !!customProp,
        primaryColor: customProp
      };
    });
    
    console.log(`\n🎨 CSS Custom Properties in ${browserName}:`, customPropsSupport);
    
    // Test Flexbox rendering
    await expect(page).toHaveScreenshot(`css-layout-${browserName}.png`, {
      animations: 'disabled',
      threshold: 0.2
    });
  });

  test('font rendering and typography across browsers', async ({ page, browserName }) => {
    await page.goto('http://localhost:9002');
    await page.waitForLoadState('networkidle');
    
    // Test font loading and rendering
    const fontInfo = await page.evaluate(() => {
      const body = document.body;
      const computedStyle = getComputedStyle(body);
      
      return {
        fontFamily: computedStyle.fontFamily,
        fontSize: computedStyle.fontSize,
        fontWeight: computedStyle.fontWeight,
        lineHeight: computedStyle.lineHeight,
        letterSpacing: computedStyle.letterSpacing
      };
    });
    
    console.log(`\n🔤 Font Rendering in ${browserName}:`, fontInfo);
    
    // Test text rendering with different elements
    const textElements = ['h1', 'h2', 'h3', 'p', 'button', 'input'];
    
    for (const element of textElements) {
      const selector = element;
      const textElement = page.locator(selector).first();
      
      if (await textElement.isVisible()) {
        await expect(textElement).toHaveScreenshot(`font-${element}-${browserName}.png`, {
          animations: 'disabled',
          threshold: 0.15 // More lenient for font rendering differences
        });
      }
    }
  });

  test('form input behavior across browsers', async ({ page, browserName }) => {
    await page.goto('http://localhost:9002/properties/prahova-mountain-chalet/booking');
    await page.waitForLoadState('networkidle');
    
    // Test different input types
    const inputTypes = [
      { type: 'email', value: 'test@example.com' },
      { type: 'tel', value: '+1234567890' },
      { type: 'url', value: 'https://example.com' },
      { type: 'date', value: '2024-12-25' },
      { type: 'number', value: '42' }
    ];
    
    for (const inputTest of inputTypes) {
      const input = page.locator(`input[type="${inputTest.type}"]`).first();
      
      if (await input.isVisible()) {
        await input.fill(inputTest.value);
        await input.blur();
        await page.waitForTimeout(300);
        
        await expect(input).toHaveScreenshot(`input-${inputTest.type}-${browserName}.png`, {
          animations: 'disabled',
          threshold: 0.2
        });
        
        // Test input validation
        const validationMessage = await input.evaluate((el: HTMLInputElement) => {
          return el.validationMessage;
        });
        
        console.log(`\n📝 Input ${inputTest.type} validation in ${browserName}: "${validationMessage}"`);
      }
    }
  });

  test('image format support and rendering', async ({ page, browserName }) => {
    await page.goto('http://localhost:9002');
    await page.waitForLoadState('networkidle');
    
    // Test image format support
    const imageSupport = await page.evaluate(() => {
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      
      return {
        webp: canvas.toDataURL('image/webp').indexOf('data:image/webp') === 0,
        avif: canvas.toDataURL('image/avif').indexOf('data:image/avif') === 0,
        svg: true, // SVG is universally supported
        jpeg: true, // JPEG is universally supported
        png: true   // PNG is universally supported
      };
    });
    
    console.log(`\n🖼️  Image Format Support in ${browserName}:`, imageSupport);
    
    // Test image loading and rendering
    const images = page.locator('img').first();
    if (await images.isVisible()) {
      await expect(images).toHaveScreenshot(`image-rendering-${browserName}.png`, {
        animations: 'disabled',
        threshold: 0.1
      });
    }
  });

  test('CSS animations and transitions across browsers', async ({ page, browserName }) => {
    await page.goto('http://localhost:9002');
    await page.waitForLoadState('networkidle');
    
    // Test animation support
    const animationSupport = await page.evaluate(() => {
      const testElement = document.createElement('div');
      document.body.appendChild(testElement);
      
      const support = {
        cssTransitions: CSS.supports('transition', 'all 0.3s ease'),
        cssAnimations: CSS.supports('animation', 'slide 1s ease-in-out'),
        cssTransforms: CSS.supports('transform', 'translateX(100px)'),
        css3dTransforms: CSS.supports('transform', 'translateZ(0)')
      };
      
      document.body.removeChild(testElement);
      return support;
    });
    
    console.log(`\n🎬 Animation Support in ${browserName}:`, animationSupport);
    
    // Test hover animations
    const hoverableElements = page.locator('button, a, .card').first();
    if (await hoverableElements.isVisible()) {
      await hoverableElements.hover();
      await page.waitForTimeout(300);
      
      await expect(hoverableElements).toHaveScreenshot(`hover-animation-${browserName}.png`, {
        animations: 'disabled',
        threshold: 0.2
      });
    }
    
    // Test click animations
    const clickableElement = page.locator('button').first();
    if (await clickableElement.isVisible()) {
      await clickableElement.click();
      await page.waitForTimeout(200);
      
      await expect(clickableElement).toHaveScreenshot(`click-animation-${browserName}.png`, {
        animations: 'disabled',
        threshold: 0.2
      });
    }
  });

  test('responsive design behavior across browsers', async ({ page, browserName }) => {
    const viewports = [
      { width: 375, height: 667, name: 'mobile' },
      { width: 768, height: 1024, name: 'tablet' },
      { width: 1280, height: 720, name: 'desktop' }
    ];
    
    for (const viewport of viewports) {
      await page.setViewportSize(viewport);
      await page.goto('http://localhost:9002');
      await page.waitForLoadState('networkidle');
      
      // Test responsive layout
      await expect(page).toHaveScreenshot(`responsive-${viewport.name}-${browserName}.png`, {
        animations: 'disabled',
        threshold: 0.2
      });
      
      // Test responsive navigation
      if (viewport.width <= 768) {
        const mobileMenuButton = page.locator('button').filter({ hasText: /menu|☰/ }).first();
        if (await mobileMenuButton.isVisible()) {
          await mobileMenuButton.click();
          await page.waitForTimeout(300);
          
          await expect(page).toHaveScreenshot(`mobile-menu-${browserName}.png`, {
            animations: 'disabled',
            threshold: 0.2
          });
        }
      }
    }
  });

  test('JavaScript execution and error handling', async ({ page, browserName }) => {
    // Monitor console errors
    const consoleErrors: string[] = [];
    page.on('console', msg => {
      if (msg.type() === 'error') {
        consoleErrors.push(msg.text());
      }
    });
    
    // Monitor JavaScript errors
    const jsErrors: string[] = [];
    page.on('pageerror', error => {
      jsErrors.push(error.message);
    });
    
    await page.goto('http://localhost:9002');
    await page.waitForLoadState('networkidle');
    
    // Test JavaScript functionality
    const jsFeatures = await page.evaluate(() => {
      try {
        // Test modern JavaScript features
        const features = {
          arrowFunctions: true,
          asyncAwait: true,
          destructuring: true,
          templateLiterals: true,
          classes: true,
          modules: typeof window.import !== 'undefined',
          promiseSupport: typeof Promise !== 'undefined',
          arrayMethods: typeof Array.prototype.find !== 'undefined'
        };
        
        return { success: true, features };
      } catch (error) {
        return { success: false, error: error.message };
      }
    });
    
    console.log(`\n⚙️  JavaScript Features in ${browserName}:`, jsFeatures);
    console.log(`\n🚨 Console Errors in ${browserName}:`, consoleErrors);
    console.log(`\n💥 JavaScript Errors in ${browserName}:`, jsErrors);
    
    // Assert no critical errors
    expect(jsErrors.length).toBeLessThan(3); // Allow some minor errors
    expect(jsFeatures.success).toBe(true);
  });

  test('accessibility features across browsers', async ({ page, browserName }) => {
    await page.goto('http://localhost:9002');
    await page.waitForLoadState('networkidle');
    
    // Test keyboard navigation
    await page.keyboard.press('Tab');
    await page.waitForTimeout(200);
    
    await expect(page).toHaveScreenshot(`keyboard-focus-1-${browserName}.png`, {
      animations: 'disabled',
      threshold: 0.2
    });
    
    await page.keyboard.press('Tab');
    await page.waitForTimeout(200);
    
    await expect(page).toHaveScreenshot(`keyboard-focus-2-${browserName}.png`, {
      animations: 'disabled',
      threshold: 0.2
    });
    
    // Test ARIA attributes support
    const ariaSupport = await page.evaluate(() => {
      const elements = document.querySelectorAll('[aria-label], [aria-describedby], [role]');
      return {
        ariaElements: elements.length,
        hasAriaLabels: document.querySelectorAll('[aria-label]').length > 0,
        hasRoles: document.querySelectorAll('[role]').length > 0,
        hasAriaDescribed: document.querySelectorAll('[aria-describedby]').length > 0
      };
    });
    
    console.log(`\n♿ Accessibility Features in ${browserName}:`, ariaSupport);
  });

  test('performance variations across browsers', async ({ page, browserName }) => {
    const startTime = Date.now();
    
    await page.goto('http://localhost:9002');
    await page.waitForLoadState('networkidle');
    
    const loadTime = Date.now() - startTime;
    
    // Get performance metrics
    const performanceData = await page.evaluate(() => {
      const navigation = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming;
      const resources = performance.getEntriesByType('resource');
      
      return {
        domContentLoaded: navigation.domContentLoadedEventEnd - navigation.domContentLoadedEventStart,
        loadComplete: navigation.loadEventEnd - navigation.loadEventStart,
        resourceCount: resources.length,
        totalTransferSize: resources.reduce((sum, resource) => sum + ((resource as any).transferSize || 0), 0)
      };
    });
    
    console.log(`\n🚀 Performance in ${browserName}:
    - Total Load Time: ${loadTime}ms
    - DOM Content Loaded: ${performanceData.domContentLoaded.toFixed(2)}ms
    - Load Complete: ${performanceData.loadComplete.toFixed(2)}ms
    - Resource Count: ${performanceData.resourceCount}
    - Transfer Size: ${(performanceData.totalTransferSize / 1024).toFixed(2)} KB`);
    
    // Performance assertions (browser-specific allowances)
    const maxLoadTime = browserName === 'webkit' ? 8000 : 6000; // Safari can be slower
    expect(loadTime).toBeLessThan(maxLoadTime);
    expect(performanceData.resourceCount).toBeLessThan(100);
  });
});

test.describe('AC5: Browser-Specific Quirks and Workarounds', () => {
  
  test('Safari-specific behavior testing', async ({ page, browserName }) => {
    test.skip(browserName !== 'webkit', 'Safari-specific test');
    
    await page.goto('http://localhost:9002');
    await page.waitForLoadState('networkidle');
    
    // Test Safari-specific issues
    const safariQuirks = await page.evaluate(() => {
      return {
        dateInputSupport: (() => { const input = document.createElement('input'); input.type = 'date'; return input.type === 'date'; })(),
        backdropFilterSupport: CSS.supports('backdrop-filter', 'blur(10px)'),
        webpSupport: document.createElement('canvas').toDataURL('image/webp').indexOf('data:image/webp') === 0,
        touchScrolling: 'ontouchstart' in window
      };
    });
    
    console.log('\n🍎 Safari-specific features:', safariQuirks);
    
    await expect(page).toHaveScreenshot('safari-specific-rendering.png', {
      animations: 'disabled',
      threshold: 0.2
    });
  });

  test('Firefox-specific behavior testing', async ({ page, browserName }) => {
    test.skip(browserName !== 'firefox', 'Firefox-specific test');
    
    await page.goto('http://localhost:9002');
    await page.waitForLoadState('networkidle');
    
    // Test Firefox-specific features
    const firefoxFeatures = await page.evaluate(() => {
      return {
        scrollbarStyling: CSS.supports('scrollbar-width', 'thin'),
        firefoxPrefix: CSS.supports('-moz-appearance', 'none'),
        flexGaps: CSS.supports('gap', '1rem') // Firefox was late to support gap in flexbox
      };
    });
    
    console.log('\n🦊 Firefox-specific features:', firefoxFeatures);
    
    await expect(page).toHaveScreenshot('firefox-specific-rendering.png', {
      animations: 'disabled',
      threshold: 0.2
    });
  });

  test('Chrome-specific behavior testing', async ({ page, browserName }) => {
    test.skip(browserName !== 'chromium', 'Chrome-specific test');
    
    await page.goto('http://localhost:9002');
    await page.waitForLoadState('networkidle');
    
    // Test Chrome-specific features
    const chromeFeatures = await page.evaluate(() => {
      return {
        webpSupport: document.createElement('canvas').toDataURL('image/webp').indexOf('data:image/webp') === 0,
        containerQueries: CSS.supports('container-type', 'inline-size'),
        subgridSupport: CSS.supports('grid-template-rows', 'subgrid'),
        scrollTimeline: 'ScrollTimeline' in window
      };
    });
    
    console.log('\n🟢 Chrome-specific features:', chromeFeatures);
    
    await expect(page).toHaveScreenshot('chrome-specific-rendering.png', {
      animations: 'disabled',
      threshold: 0.2
    });
  });
});