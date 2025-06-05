/**
 * @fileoverview Dual-Check Mode Manual Validation Script
 * @module language-migration/scripts/test-dual-check-mode
 * 
 * @description
 * Manual validation script for Phase 3 dual-check mode.
 * Tests the unified language system in dual-check mode against legacy behavior.
 * 
 * @author Claude AI Assistant
 * @version 1.0.0
 * @since 2025-06-05
 */

import type { 
  LanguageDetectionConfig, 
  LanguageDetectionResult, 
  SupportedLanguage,
  PageType 
} from '../../src/lib/language-system/language-types';
import { detectLanguage, createDetectionConfig } from '../../src/lib/language-system/language-detection';

// ===== Mock Data for Testing =====

const testScenarios = [
  {
    name: 'Property page with Romanian language',
    pathname: '/properties/prahova-mountain-chalet/ro',
    searchParams: null,
    pageType: 'property' as PageType,
    expectedLang: 'ro'
  },
  {
    name: 'Property page with English language',
    pathname: '/properties/prahova-mountain-chalet/en',
    searchParams: null,
    pageType: 'property' as PageType,
    expectedLang: 'en'
  },
  {
    name: 'Query parameter language override',
    pathname: '/booking',
    searchParams: new URLSearchParams('?lang=ro'),
    pageType: 'booking' as PageType,
    expectedLang: 'ro'
  },
  {
    name: 'Default fallback scenario',
    pathname: '/admin',
    searchParams: null,
    pageType: 'admin' as PageType,
    expectedLang: 'en'
  }
];

// ===== Legacy Detection Simulation =====

function simulateLegacyDetection(
  pathname: string, 
  searchParams: URLSearchParams | null,
  pageType: PageType
): LanguageDetectionResult {
  const segments = pathname.split('/').filter(Boolean);
  
  // Legacy property page detection
  if (pageType === 'property' || pathname.includes('/properties/')) {
    const propertyIndex = segments.indexOf('properties');
    if (propertyIndex >= 0 && segments[propertyIndex + 2]) {
      const possibleLang = segments[propertyIndex + 2];
      if (['en', 'ro'].includes(possibleLang)) {
        return {
          language: possibleLang as SupportedLanguage,
          source: 'url-path',
          confidence: 0.9,
          metadata: { legacy: true, pattern: 'property-page' }
        };
      }
    }
  }

  // Legacy query parameter detection
  if (searchParams) {
    const langParam = searchParams.get('language') || searchParams.get('lang');
    if (langParam && ['en', 'ro'].includes(langParam)) {
      return {
        language: langParam as SupportedLanguage,
        source: 'url-query',
        confidence: 0.8,
        metadata: { legacy: true, pattern: 'query-param' }
      };
    }
  }

  // Legacy default fallback
  return {
    language: 'en',
    source: 'default',
    confidence: 0.1,
    metadata: { legacy: true, pattern: 'default-fallback' }
  };
}

// ===== Comparison Logic =====

function compareDetectionResults(
  unified: LanguageDetectionResult, 
  legacy: LanguageDetectionResult
) {
  const matches = unified.language === legacy.language;
  const discrepancies = [];

  if (!matches) {
    discrepancies.push({
      property: 'language',
      unified: unified.language,
      legacy: legacy.language
    });
  }

  if (unified.source !== legacy.source) {
    discrepancies.push({
      property: 'source',
      unified: unified.source,
      legacy: legacy.source
    });
  }

  return {
    matches,
    discrepancies,
    confidenceDiff: Math.abs(unified.confidence - legacy.confidence)
  };
}

// ===== Main Test Function =====

async function runDualCheckValidation() {
  console.log('🔄 Starting Dual-Check Mode Validation...\n');

  const results = {
    totalTests: testScenarios.length,
    passed: 0,
    failed: 0,
    discrepancies: [] as any[]
  };

  for (const scenario of testScenarios) {
    console.log(`\n📋 Testing: ${scenario.name}`);
    console.log(`   Path: ${scenario.pathname}`);
    console.log(`   Page Type: ${scenario.pageType}`);
    
    try {
      // Create detection config
      const config = createDetectionConfig({
        pathname: scenario.pathname,
        searchParams: scenario.searchParams || undefined,
        pageType: scenario.pageType
      });

      // Run unified detection
      const unifiedResult = await detectLanguage(config);

      // Run legacy simulation
      const legacyResult = simulateLegacyDetection(
        scenario.pathname,
        scenario.searchParams,
        scenario.pageType
      );

      // Compare results
      const comparison = compareDetectionResults(unifiedResult, legacyResult);

      console.log(`   Unified: ${unifiedResult.language} (${unifiedResult.source}, confidence: ${unifiedResult.confidence})`);
      console.log(`   Legacy:  ${legacyResult.language} (${legacyResult.source}, confidence: ${legacyResult.confidence})`);
      console.log(`   Match:   ${comparison.matches ? '✅' : '❌'}`);

      if (comparison.matches) {
        results.passed++;
        console.log(`   Status:  ✅ PASSED`);
      } else {
        results.failed++;
        console.log(`   Status:  ❌ FAILED`);
        console.log(`   Issues:  ${JSON.stringify(comparison.discrepancies, null, 2)}`);
        
        results.discrepancies.push({
          scenario: scenario.name,
          unified: unifiedResult,
          legacy: legacyResult,
          comparison
        });
      }

    } catch (error) {
      results.failed++;
      console.log(`   Status:  ❌ ERROR - ${error}`);
    }
  }

  // ===== Performance Testing =====

  console.log('\n\n🚀 Performance Testing...');

  const performanceTests = 100;
  const unifiedTimes = [];
  const legacyTimes = [];

  for (let i = 0; i < performanceTests; i++) {
    const scenario = testScenarios[i % testScenarios.length];
    
    // Unified timing
    const unifiedStart = performance.now();
    const config = createDetectionConfig({
      pathname: scenario.pathname,
      searchParams: scenario.searchParams || undefined,
      pageType: scenario.pageType
    });
    await detectLanguage(config);
    const unifiedEnd = performance.now();
    unifiedTimes.push(unifiedEnd - unifiedStart);

    // Legacy timing
    const legacyStart = performance.now();
    simulateLegacyDetection(scenario.pathname, scenario.searchParams, scenario.pageType);
    const legacyEnd = performance.now();
    legacyTimes.push(legacyEnd - legacyStart);
  }

  const avgUnified = unifiedTimes.reduce((a, b) => a + b, 0) / unifiedTimes.length;
  const avgLegacy = legacyTimes.reduce((a, b) => a + b, 0) / legacyTimes.length;
  const overhead = ((avgUnified - avgLegacy) / avgLegacy) * 100;

  // ===== Final Report =====

  console.log('\n\n📊 DUAL-CHECK VALIDATION REPORT');
  console.log('=====================================');
  console.log(`Total Tests:        ${results.totalTests}`);
  console.log(`Passed:            ${results.passed}`);
  console.log(`Failed:            ${results.failed}`);
  console.log(`Success Rate:      ${((results.passed / results.totalTests) * 100).toFixed(1)}%`);
  console.log(`Target:            >99% (${results.passed / results.totalTests >= 0.99 ? '✅' : '❌'})`);
  
  console.log('\n🚀 Performance Analysis:');
  console.log(`Unified Avg:       ${avgUnified.toFixed(3)}ms`);
  console.log(`Legacy Avg:        ${avgLegacy.toFixed(3)}ms`);
  console.log(`Overhead:          ${overhead.toFixed(1)}%`);
  console.log(`Target:            <20% (${overhead < 20 ? '✅' : '❌'})`);

  if (results.discrepancies.length > 0) {
    console.log('\n❌ Discrepancies Found:');
    results.discrepancies.forEach((disc, i) => {
      console.log(`\n${i + 1}. ${disc.scenario}`);
      console.log(`   Unified: ${disc.unified.language} (${disc.unified.source})`);
      console.log(`   Legacy:  ${disc.legacy.language} (${disc.legacy.source})`);
    });
  }

  // ===== Migration Readiness =====

  const migrationReady = results.passed / results.totalTests >= 0.99 && overhead < 20;
  
  console.log('\n🎯 Migration Readiness:');
  console.log(`Ready for Phase 4: ${migrationReady ? '✅ YES' : '❌ NO'}`);
  
  if (migrationReady) {
    console.log('\n✅ Phase 3 validation successful! Ready to proceed to Phase 4 migration.');
  } else {
    console.log('\n❌ Phase 3 validation failed. Address issues before proceeding to Phase 4.');
  }

  return {
    success: migrationReady,
    metrics: {
      testResults: results,
      performance: {
        unifiedAvg: avgUnified,
        legacyAvg: avgLegacy,
        overhead: overhead
      }
    }
  };
}

// ===== Execute if run directly =====

if (require.main === module) {
  runDualCheckValidation()
    .then((result) => {
      process.exit(result.success ? 0 : 1);
    })
    .catch((error) => {
      console.error('❌ Validation failed:', error);
      process.exit(1);
    });
}

export { runDualCheckValidation, simulateLegacyDetection, compareDetectionResults };