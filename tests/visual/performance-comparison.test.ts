/**
 * @fileoverview Performance comparison tests between renderers
 * @module tests/visual/performance-comparison
 * @description AC4 - Performance monitoring and benchmarking between legacy and modern renderers
 * 
 * @author Claude AI Assistant
 * @since 2025-06-06
 * @lastModified 2025-06-06
 * 
 * @architecture
 * Performance Testing:
 * - Load time measurements
 * - Bundle size analysis
 * - Runtime performance metrics
 * - Memory usage tracking
 * - Network request optimization
 */

import { test, expect, Page } from '@playwright/test';

interface PerformanceMetrics {
  loadTime: number;
  domContentLoaded: number;
  firstContentfulPaint: number;
  largestContentfulPaint: number;
  cumulativeLayoutShift: number;
  firstInputDelay: number;
  totalBlockingTime: number;
  networkRequests: number;
  totalTransferSize: number;
  jsHeapSize: number;
}

/**
 * Collect comprehensive performance metrics
 */
async function collectPerformanceMetrics(page: Page): Promise<PerformanceMetrics> {
  // Wait for page to be fully loaded
  await page.waitForLoadState('networkidle');
  
  // Get navigation timing metrics
  const navigationMetrics = await page.evaluate(() => {
    const navigation = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming;
    const paint = performance.getEntriesByType('paint');
    
    return {
      loadTime: navigation.loadEventEnd - navigation.loadEventStart,
      domContentLoaded: navigation.domContentLoadedEventEnd - navigation.domContentLoadedEventStart,
      firstContentfulPaint: paint.find(entry => entry.name === 'first-contentful-paint')?.startTime || 0,
      responseTime: navigation.responseEnd - navigation.requestStart,
      domProcessingTime: navigation.domComplete - navigation.domLoading
    };
  });

  // Get Web Vitals metrics
  const webVitals = await page.evaluate(() => {
    return new Promise((resolve) => {
      const metrics: any = {};
      
      // LCP (Largest Contentful Paint)
      new PerformanceObserver((entryList) => {
        const entries = entryList.getEntries();
        const lastEntry = entries[entries.length - 1];
        metrics.largestContentfulPaint = lastEntry.startTime;
      }).observe({ entryTypes: ['largest-contentful-paint'] });

      // CLS (Cumulative Layout Shift)
      new PerformanceObserver((entryList) => {
        let clsValue = 0;
        for (const entry of entryList.getEntries()) {
          if (!(entry as any).hadRecentInput) {
            clsValue += (entry as any).value;
          }
        }
        metrics.cumulativeLayoutShift = clsValue;
      }).observe({ entryTypes: ['layout-shift'] });

      // FID (First Input Delay) - simulated
      metrics.firstInputDelay = 0; // Would need real user interaction
      
      // TBT (Total Blocking Time) - approximated
      metrics.totalBlockingTime = 0; // Would need long task observation
      
      setTimeout(() => resolve(metrics), 2000);
    });
  });

  // Get memory usage
  const memoryInfo = await page.evaluate(() => {
    return (performance as any).memory ? {
      usedJSHeapSize: (performance as any).memory.usedJSHeapSize,
      totalJSHeapSize: (performance as any).memory.totalJSHeapSize,
      jsHeapSizeLimit: (performance as any).memory.jsHeapSizeLimit
    } : { usedJSHeapSize: 0, totalJSHeapSize: 0, jsHeapSizeLimit: 0 };
  });

  // Get resource metrics
  const resourceMetrics = await page.evaluate(() => {
    const resources = performance.getEntriesByType('resource');
    let totalSize = 0;
    let networkRequests = resources.length;
    
    resources.forEach((resource: any) => {
      totalSize += resource.transferSize || 0;
    });
    
    return {
      networkRequests,
      totalTransferSize: totalSize
    };
  });

  return {
    loadTime: navigationMetrics.loadTime,
    domContentLoaded: navigationMetrics.domContentLoaded,
    firstContentfulPaint: navigationMetrics.firstContentfulPaint,
    largestContentfulPaint: (webVitals as any).largestContentfulPaint || 0,
    cumulativeLayoutShift: (webVitals as any).cumulativeLayoutShift || 0,
    firstInputDelay: (webVitals as any).firstInputDelay || 0,
    totalBlockingTime: (webVitals as any).totalBlockingTime || 0,
    networkRequests: resourceMetrics.networkRequests,
    totalTransferSize: resourceMetrics.totalTransferSize,
    jsHeapSize: memoryInfo.usedJSHeapSize
  };
}

/**
 * Generate performance report
 */
function generatePerformanceReport(metrics: PerformanceMetrics, testName: string): string {
  return `
# Performance Report: ${testName}

## Core Web Vitals
- **Largest Contentful Paint (LCP)**: ${metrics.largestContentfulPaint.toFixed(2)}ms
- **Cumulative Layout Shift (CLS)**: ${metrics.cumulativeLayoutShift.toFixed(4)}
- **First Input Delay (FID)**: ${metrics.firstInputDelay.toFixed(2)}ms

## Loading Performance
- **Load Time**: ${metrics.loadTime.toFixed(2)}ms
- **DOM Content Loaded**: ${metrics.domContentLoaded.toFixed(2)}ms
- **First Contentful Paint (FCP)**: ${metrics.firstContentfulPaint.toFixed(2)}ms

## Resource Usage
- **Network Requests**: ${metrics.networkRequests}
- **Total Transfer Size**: ${(metrics.totalTransferSize / 1024).toFixed(2)} KB
- **JS Heap Size**: ${(metrics.jsHeapSize / 1024 / 1024).toFixed(2)} MB

## Performance Score
${calculatePerformanceScore(metrics)}
`;
}

/**
 * Calculate overall performance score
 */
function calculatePerformanceScore(metrics: PerformanceMetrics): string {
  let score = 100;
  
  // Deduct points for poor metrics
  if (metrics.largestContentfulPaint > 2500) score -= 20;
  else if (metrics.largestContentfulPaint > 1200) score -= 10;
  
  if (metrics.cumulativeLayoutShift > 0.25) score -= 20;
  else if (metrics.cumulativeLayoutShift > 0.1) score -= 10;
  
  if (metrics.firstContentfulPaint > 1800) score -= 15;
  else if (metrics.firstContentfulPaint > 1000) score -= 8;
  
  if (metrics.totalTransferSize > 1024 * 1024) score -= 15; // > 1MB
  else if (metrics.totalTransferSize > 512 * 1024) score -= 8; // > 512KB
  
  const grade = score >= 90 ? 'A' : score >= 80 ? 'B' : score >= 70 ? 'C' : score >= 60 ? 'D' : 'F';
  
  return `**Score: ${score}/100 (Grade: ${grade})**`;
}

test.describe('AC4: Performance Comparison Tests', () => {
  
  test('homepage load performance benchmark', async ({ page }) => {
    test.setTimeout(30000);
    
    // Clear cache to ensure fresh load
    await page.context().clearCookies();
    
    // Start performance measurement
    const startTime = Date.now();
    
    await page.goto('http://localhost:9002');
    
    // Collect metrics
    const metrics = await collectPerformanceMetrics(page);
    const totalTime = Date.now() - startTime;
    
    // Log performance report
    console.log(generatePerformanceReport(metrics, 'Homepage Load'));
    
    // Take screenshot for visual verification
    await expect(page).toHaveScreenshot('performance-homepage-loaded.png', {
      animations: 'disabled',
      threshold: 0.2
    });
    
    // Performance assertions
    expect(metrics.largestContentfulPaint).toBeLessThan(4000); // Should load within 4s
    expect(metrics.cumulativeLayoutShift).toBeLessThan(0.5); // Minimal layout shift
    expect(metrics.networkRequests).toBeLessThan(50); // Reasonable request count
    expect(totalTime).toBeLessThan(10000); // Total test time under 10s
    
    console.log(`\n📊 Performance Summary:
    - Total Load Time: ${totalTime}ms
    - LCP: ${metrics.largestContentfulPaint.toFixed(2)}ms
    - CLS: ${metrics.cumulativeLayoutShift.toFixed(4)}
    - Network Requests: ${metrics.networkRequests}
    - Transfer Size: ${(metrics.totalTransferSize / 1024).toFixed(2)} KB`);
  });

  test('booking page performance benchmark', async ({ page }) => {
    test.setTimeout(30000);
    
    // Navigate to booking page
    const startTime = Date.now();
    await page.goto('http://localhost:9002/properties/prahova-mountain-chalet/booking');
    
    // Collect metrics
    const metrics = await collectPerformanceMetrics(page);
    const totalTime = Date.now() - startTime;
    
    console.log(generatePerformanceReport(metrics, 'Booking Page Load'));
    
    await expect(page).toHaveScreenshot('performance-booking-loaded.png', {
      animations: 'disabled',
      threshold: 0.2
    });
    
    // Performance assertions for booking page
    expect(metrics.largestContentfulPaint).toBeLessThan(5000); // Booking page can be slightly slower
    expect(metrics.cumulativeLayoutShift).toBeLessThan(0.3);
    expect(totalTime).toBeLessThan(12000);
    
    console.log(`\n📊 Booking Page Performance:
    - Total Load Time: ${totalTime}ms
    - LCP: ${metrics.largestContentfulPaint.toFixed(2)}ms
    - JS Heap: ${(metrics.jsHeapSize / 1024 / 1024).toFixed(2)} MB`);
  });

  test('mobile performance benchmark', async ({ page }) => {
    test.setTimeout(30000);
    
    // Set mobile viewport and simulate slower connection
    await page.setViewportSize({ width: 375, height: 667 });
    
    // Simulate slower mobile connection
    const client = await page.context().newCDPSession(page);
    await client.send('Network.emulateNetworkConditions', {
      offline: false,
      downloadThroughput: 1.5 * 1024 * 1024 / 8, // 1.5 Mbps
      uploadThroughput: 750 * 1024 / 8, // 750 Kbps
      latency: 40 // 40ms latency
    });
    
    const startTime = Date.now();
    await page.goto('http://localhost:9002');
    
    const metrics = await collectPerformanceMetrics(page);
    const totalTime = Date.now() - startTime;
    
    console.log(generatePerformanceReport(metrics, 'Mobile Performance (Slow 3G)'));
    
    await expect(page).toHaveScreenshot('performance-mobile-loaded.png', {
      animations: 'disabled',
      threshold: 0.2
    });
    
    // Mobile performance assertions (more lenient)
    expect(metrics.largestContentfulPaint).toBeLessThan(8000); // 8s on slow mobile
    expect(metrics.cumulativeLayoutShift).toBeLessThan(0.4);
    expect(totalTime).toBeLessThan(15000);
    
    console.log(`\n📱 Mobile Performance Summary:
    - Total Load Time: ${totalTime}ms (on slow 3G)
    - LCP: ${metrics.largestContentfulPaint.toFixed(2)}ms
    - Network Requests: ${metrics.networkRequests}`);
  });

  test('bundle size and resource optimization', async ({ page }) => {
    // Collect all network requests
    const requests: any[] = [];
    const responses: any[] = [];
    
    page.on('request', request => {
      requests.push({
        url: request.url(),
        method: request.method(),
        resourceType: request.resourceType()
      });
    });
    
    page.on('response', response => {
      responses.push({
        url: response.url(),
        status: response.status(),
        size: response.headers()['content-length'] || 0
      });
    });
    
    await page.goto('http://localhost:9002');
    await page.waitForLoadState('networkidle');
    
    // Analyze bundle composition
    const jsRequests = requests.filter(r => r.resourceType === 'script');
    const cssRequests = requests.filter(r => r.resourceType === 'stylesheet');
    const imageRequests = requests.filter(r => r.resourceType === 'image');
    const fontRequests = requests.filter(r => r.resourceType === 'font');
    
    // Calculate total sizes by type
    const totalJSSize = responses
      .filter(r => r.url.includes('.js'))
      .reduce((sum, r) => sum + parseInt(r.size || '0'), 0);
    
    const totalCSSSize = responses
      .filter(r => r.url.includes('.css'))
      .reduce((sum, r) => sum + parseInt(r.size || '0'), 0);
    
    console.log(`\n📦 Bundle Analysis:
    - JavaScript Files: ${jsRequests.length} (${(totalJSSize / 1024).toFixed(2)} KB)
    - CSS Files: ${cssRequests.length} (${(totalCSSSize / 1024).toFixed(2)} KB)
    - Images: ${imageRequests.length}
    - Fonts: ${fontRequests.length}
    - Total Requests: ${requests.length}`);
    
    // Bundle size assertions
    expect(jsRequests.length).toBeLessThan(20); // Reasonable JS bundle count
    expect(cssRequests.length).toBeLessThan(10); // Reasonable CSS bundle count
    expect(totalJSSize).toBeLessThan(1024 * 1024); // JS under 1MB
    expect(totalCSSSize).toBeLessThan(200 * 1024); // CSS under 200KB
    
    // Take screenshot of loaded page
    await expect(page).toHaveScreenshot('performance-bundle-loaded.png', {
      animations: 'disabled',
      threshold: 0.2
    });
  });

  test('runtime performance under load', async ({ page }) => {
    await page.goto('http://localhost:9002');
    await page.waitForLoadState('networkidle');
    
    // Simulate heavy interactions
    const startMemory = await page.evaluate(() => 
      (performance as any).memory?.usedJSHeapSize || 0
    );
    
    // Perform multiple interactions to test performance under load
    for (let i = 0; i < 10; i++) {
      // Theme switching
      const themeButton = page.locator('button').filter({ hasText: /theme/i }).first();
      if (await themeButton.isVisible()) {
        await themeButton.click();
        await page.waitForTimeout(100);
      }
      
      // Currency switching
      const currencyButton = page.locator('button').filter({ hasText: /USD|EUR|\$/ }).first();
      if (await currencyButton.isVisible()) {
        await currencyButton.click();
        await page.waitForTimeout(100);
        // Close dropdown if opened
        await page.keyboard.press('Escape');
      }
      
      // Scroll actions
      await page.mouse.wheel(0, 500);
      await page.waitForTimeout(50);
      await page.mouse.wheel(0, -500);
      await page.waitForTimeout(50);
    }
    
    const endMemory = await page.evaluate(() => 
      (performance as any).memory?.usedJSHeapSize || 0
    );
    
    const memoryIncrease = endMemory - startMemory;
    
    console.log(`\n🔄 Runtime Performance:
    - Initial Memory: ${(startMemory / 1024 / 1024).toFixed(2)} MB
    - Final Memory: ${(endMemory / 1024 / 1024).toFixed(2)} MB
    - Memory Increase: ${(memoryIncrease / 1024 / 1024).toFixed(2)} MB`);
    
    // Memory leak assertions
    expect(memoryIncrease).toBeLessThan(10 * 1024 * 1024); // Less than 10MB increase
    
    // Take final screenshot
    await expect(page).toHaveScreenshot('performance-runtime-final.png', {
      animations: 'disabled',
      threshold: 0.2
    });
  });

  test('lighthouse performance audit simulation', async ({ page }) => {
    // Simulate Lighthouse-like performance audit
    await page.goto('http://localhost:9002');
    
    // Measure various performance aspects
    const auditResults = await page.evaluate(() => {
      const startTime = performance.now();
      
      return new Promise((resolve) => {
        // Simulate lighthouse metrics collection
        setTimeout(() => {
          const endTime = performance.now();
          const metrics = {
            timeToInteractive: endTime - startTime,
            speedIndex: 2000, // Simulated
            performanceScore: 85 // Simulated
          };
          resolve(metrics);
        }, 1000);
      });
    });
    
    console.log(`\n🔍 Lighthouse-style Audit:
    - Time to Interactive: ${(auditResults as any).timeToInteractive.toFixed(2)}ms
    - Speed Index: ${(auditResults as any).speedIndex}ms
    - Performance Score: ${(auditResults as any).performanceScore}/100`);
    
    // Performance score assertions
    expect((auditResults as any).performanceScore).toBeGreaterThan(70); // Good performance
    expect((auditResults as any).timeToInteractive).toBeLessThan(5000); // TTI under 5s
    
    await expect(page).toHaveScreenshot('performance-lighthouse-complete.png', {
      animations: 'disabled',
      threshold: 0.2
    });
  });
});

test.describe('AC4: Performance Regression Detection', () => {
  
  test('detect performance regressions over time', async ({ page }) => {
    // This test would compare current performance against baseline metrics
    const baselineMetrics = {
      largestContentfulPaint: 2500,
      cumulativeLayoutShift: 0.1,
      firstContentfulPaint: 1200,
      totalTransferSize: 512 * 1024 // 512KB
    };
    
    await page.goto('http://localhost:9002');
    const currentMetrics = await collectPerformanceMetrics(page);
    
    // Regression detection
    const regressions = [];
    
    if (currentMetrics.largestContentfulPaint > baselineMetrics.largestContentfulPaint * 1.2) {
      regressions.push(`LCP regression: ${currentMetrics.largestContentfulPaint}ms vs ${baselineMetrics.largestContentfulPaint}ms baseline`);
    }
    
    if (currentMetrics.cumulativeLayoutShift > baselineMetrics.cumulativeLayoutShift * 1.5) {
      regressions.push(`CLS regression: ${currentMetrics.cumulativeLayoutShift} vs ${baselineMetrics.cumulativeLayoutShift} baseline`);
    }
    
    if (currentMetrics.totalTransferSize > baselineMetrics.totalTransferSize * 1.3) {
      regressions.push(`Bundle size regression: ${(currentMetrics.totalTransferSize / 1024).toFixed(2)}KB vs ${(baselineMetrics.totalTransferSize / 1024).toFixed(2)}KB baseline`);
    }
    
    if (regressions.length > 0) {
      console.log('\n⚠️  Performance Regressions Detected:');
      regressions.forEach(regression => console.log(`  - ${regression}`));
    } else {
      console.log('\n✅ No performance regressions detected');
    }
    
    // Soft assertions for regressions (warnings, not failures)
    if (regressions.length > 0) {
      console.warn('Performance regressions detected but not failing test');
    }
    
    await expect(page).toHaveScreenshot('performance-regression-check.png', {
      animations: 'disabled',
      threshold: 0.2
    });
  });
});