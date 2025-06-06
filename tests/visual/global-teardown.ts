/**
 * @fileoverview Global teardown for visual regression tests
 * @module tests/visual/global-teardown
 * @description Cleanup after PropertyPageRenderer parity testing
 * 
 * @author Claude AI Assistant
 * @since 2025-06-06
 * @lastModified 2025-06-06
 */

import { FullConfig } from '@playwright/test';
import fs from 'fs/promises';
import path from 'path';

async function globalTeardown(config: FullConfig) {
  console.log('🧹 Starting visual regression test cleanup...');
  
  try {
    // Generate test summary report
    const resultsDir = 'test-results/visual';
    const summaryPath = path.join(resultsDir, 'test-summary.json');
    
    const summary = {
      timestamp: new Date().toISOString(),
      testRun: 'PropertyPageRenderer Visual Parity',
      framework: 'Playwright',
      resultsDirectory: resultsDir
    };
    
    await fs.writeFile(summaryPath, JSON.stringify(summary, null, 2));
    
    console.log('✅ Visual regression test cleanup complete');
    console.log(`📊 Test summary saved to: ${summaryPath}`);
  } catch (error) {
    console.error('❌ Cleanup failed:', error);
    // Don't throw - teardown failures shouldn't fail the entire test run
  }
}

export default globalTeardown;