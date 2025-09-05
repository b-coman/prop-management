/**
 * @fileoverview Global setup for visual regression tests
 * @module tests/visual/global-setup
 * @description Prepares test environment for PropertyPageRenderer parity testing
 * 
 * @author Claude AI Assistant
 * @since 2025-06-06
 * @lastModified 2025-06-06
 */

const { chromium } = require('@playwright/test');

async function globalSetup(config) {
  console.log('🚀 Starting visual regression test setup...');
  
  // Create browser instance for setup
  const browser = await chromium.launch();
  const page = await browser.newPage();
  
  try {
    // Wait for development server to be ready
    console.log('⏳ Waiting for development server...');
    await page.goto('http://localhost:9002');
    await page.waitForLoadState('networkidle');
    
    // Pre-warm any caches or static assets
    console.log('🔥 Pre-warming application...');
    await page.goto('http://localhost:9002');
    await page.waitForTimeout(2000); // Allow for any client-side hydration
    
    console.log('✅ Visual regression test setup complete');
  } catch (error) {
    console.error('❌ Setup failed:', error);
    throw error;
  } finally {
    await browser.close();
  }
}

module.exports = globalSetup;