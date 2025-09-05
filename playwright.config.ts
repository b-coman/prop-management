/**
 * @fileoverview Playwright configuration for visual regression testing
 * @module playwright.config
 * @description Configuration for PropertyPageRenderer parity testing framework
 * 
 * @author Claude AI Assistant
 * @since 2025-06-06
 * @lastModified 2025-06-06
 * 
 * @architecture
 * Visual Regression Testing Setup:
 * - PropertyPageRenderer homepage validation
 * - Cross-browser compatibility testing  
 * - Mobile and desktop viewport testing
 * - Screenshot comparison with pixel-level accuracy
 */

import { defineConfig, devices } from '@playwright/test';

/**
 * Playwright configuration for comprehensive renderer testing
 */
export default defineConfig({
  // Test directory
  testDir: './tests/visual',
  
  // Run tests in files in parallel
  fullyParallel: true,
  
  // Fail the build on CI if you accidentally left test.only in the source code
  forbidOnly: !!process.env.CI,
  
  // Retry on CI only
  retries: process.env.CI ? 2 : 0,
  
  // Opt out of parallel tests on CI
  workers: process.env.CI ? 1 : undefined,
  
  // Reporter to use
  reporter: [
    ['html'],
    ['json', { outputFile: 'test-results/visual-regression-results.json' }],
    ['list']
  ],
  
  // Shared settings for all the projects below
  use: {
    // Base URL for testing
    baseURL: 'http://localhost:9002',
    
    // Collect trace when retrying the failed test
    trace: 'on-first-retry',
    
    // Take screenshot on failure
    screenshot: 'only-on-failure',
    
    // Record video on failure
    video: 'retain-on-failure',
  },

  // Configure projects for major browsers
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },

    {
      name: 'firefox',
      use: { ...devices['Desktop Firefox'] },
    },

    {
      name: 'webkit',
      use: { ...devices['Desktop Safari'] },
    },

    // Test against mobile viewports
    {
      name: 'Mobile Chrome',
      use: { ...devices['Pixel 5'] },
    },
    {
      name: 'Mobile Safari',
      use: { ...devices['iPhone 12'] },
    },

    // Test against branded browsers
    {
      name: 'Microsoft Edge',
      use: { ...devices['Desktop Edge'], channel: 'msedge' },
    },
    {
      name: 'Google Chrome',
      use: { ...devices['Desktop Chrome'], channel: 'chrome' },
    },
  ],

  // Run your local dev server before starting the tests
  webServer: {
    command: 'npm run dev',
    url: 'http://localhost:9002',
    reuseExistingServer: !process.env.CI,
    timeout: 120 * 1000, // 2 minutes for server startup
  },

  // Global setup and teardown
  globalSetup: require.resolve('./tests/visual/global-setup'),
  globalTeardown: require.resolve('./tests/visual/global-teardown'),

  // Test configuration
  timeout: 60 * 1000, // 60 seconds per test
  expect: {
    // Screenshot comparison settings
    toMatchSnapshot: {
      threshold: 0.1,
      maxDiffPixels: 1000, // Allow up to 1000 different pixels
    },
    toHaveScreenshot: {
      threshold: 0.1,
      maxDiffPixels: 1000,
    },
  },

  // Output directory for test artifacts
  outputDir: 'test-results/visual',
});