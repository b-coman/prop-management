/**
 * Clean up legacy availability code after successful migration to SINGLE_SOURCE
 * This removes unused code paths and simplifies the architecture
 */

import { readFileSync, writeFileSync } from 'fs';
import { join } from 'path';

interface CleanupTask {
  file: string;
  description: string;
  changes: Array<{
    type: 'remove_function' | 'remove_imports' | 'simplify_logic' | 'update_types';
    target: string;
    replacement?: string;
  }>;
}

const CLEANUP_TASKS: CleanupTask[] = [
  {
    file: 'src/lib/availability-service.ts',
    description: 'Remove DUAL_CHECK and LEGACY modes, keep only SINGLE_SOURCE',
    changes: [
      {
        type: 'remove_function',
        target: 'checkAvailabilityFromPriceCalendars',
      },
      {
        type: 'remove_function', 
        target: 'checkAvailabilityDual',
      },
      {
        type: 'simplify_logic',
        target: 'checkAvailabilityWithFlags',
        replacement: 'Always use single source mode'
      }
    ]
  },
  {
    file: 'src/config/features.ts',
    description: 'Remove legacy feature flags, keep only what\'s needed',
    changes: [
      {
        type: 'remove_imports',
        target: 'AVAILABILITY_DUAL_CHECK, AVAILABILITY_LEGACY_FALLBACK'
      }
    ]
  },
  {
    file: '.env.local',
    description: 'Remove legacy environment variables',
    changes: [
      {
        type: 'remove_imports',
        target: 'AVAILABILITY_DUAL_CHECK, AVAILABILITY_LEGACY_FALLBACK'
      }
    ]
  }
];

async function cleanupLegacyCode() {
  console.log('🧹 Cleaning up legacy availability code');
  console.log('=====================================');
  
  console.log('\n📋 Cleanup Plan:');
  console.log('1. Remove DUAL_CHECK and LEGACY mode functions');
  console.log('2. Simplify availability service to single mode only');
  console.log('3. Remove unused feature flags');
  console.log('4. Update types and interfaces');
  console.log('5. Clean up monitoring references');
  
  console.log('\n⚠️  Note: This is a development environment cleanup');
  console.log('   All legacy modes will be permanently removed');
  
  return true;
}

// Detailed analysis of what to clean up
async function analyzeCleanupTargets() {
  console.log('\n🔍 DETAILED CLEANUP ANALYSIS');
  console.log('============================');
  
  const filesToAnalyze = [
    'src/lib/availability-service.ts',
    'src/config/features.ts', 
    'src/app/api/monitoring/availability/route.ts',
    '.env.local'
  ];
  
  console.log('\n📊 Current State Analysis:');
  
  filesToAnalyze.forEach(file => {
    console.log(`\n📄 ${file}:`);
    try {
      const content = readFileSync(file, 'utf8');
      
      // Count legacy references
      const dualCheckRefs = (content.match(/DUAL_CHECK/g) || []).length;
      const legacyRefs = (content.match(/LEGACY_FALLBACK/g) || []).length;
      const priceCalendarRefs = (content.match(/checkAvailabilityFromPriceCalendars/g) || []).length;
      
      console.log(`   - DUAL_CHECK references: ${dualCheckRefs}`);
      console.log(`   - LEGACY_FALLBACK references: ${legacyRefs}`);
      console.log(`   - priceCalendars availability functions: ${priceCalendarRefs}`);
      
      if (dualCheckRefs === 0 && legacyRefs === 0 && priceCalendarRefs === 0) {
        console.log(`   ✅ File is clean`);
      } else {
        console.log(`   🔧 File needs cleanup`);
      }
      
    } catch (error) {
      console.log(`   ❌ Error reading file: ${error}`);
    }
  });
}

// Generate specific cleanup recommendations
async function generateCleanupRecommendations() {
  console.log('\n💡 CLEANUP RECOMMENDATIONS');
  console.log('==========================');
  
  console.log('\n🎯 **Priority 1: Core Availability Service**');
  console.log('   File: src/lib/availability-service.ts');
  console.log('   Actions:');
  console.log('   - Remove checkAvailabilityFromPriceCalendars function (~50 lines)');
  console.log('   - Remove checkAvailabilityDual function (~80 lines)');
  console.log('   - Simplify checkAvailabilityWithFlags to always use single source');
  console.log('   - Remove AvailabilityResult type complexity');
  console.log('   - Remove feature flag logic (~30 lines)');
  
  console.log('\n🎯 **Priority 2: Feature Flags**');
  console.log('   File: src/config/features.ts');
  console.log('   Actions:');
  console.log('   - Remove AVAILABILITY_DUAL_CHECK flag');
  console.log('   - Remove AVAILABILITY_LEGACY_FALLBACK flag');
  console.log('   - Keep only AVAILABILITY_SINGLE_SOURCE (or remove entirely)');
  
  console.log('\n🎯 **Priority 3: Environment Variables**');
  console.log('   File: .env.local');
  console.log('   Actions:');
  console.log('   - Remove AVAILABILITY_DUAL_CHECK=false');
  console.log('   - Remove AVAILABILITY_LEGACY_FALLBACK=true');
  console.log('   - Keep or remove AVAILABILITY_SINGLE_SOURCE=true');
  
  console.log('\n🎯 **Priority 4: Monitoring**');
  console.log('   File: src/app/api/monitoring/availability/route.ts');
  console.log('   Actions:');
  console.log('   - Remove dual check monitoring logic');
  console.log('   - Simplify feature flag reporting');
  console.log('   - Update health check to focus on single source');
  
  console.log('\n🎯 **Priority 5: Types & Interfaces**');
  console.log('   Actions:');
  console.log('   - Simplify AvailabilityResult type');
  console.log('   - Remove mode-specific type definitions');
  console.log('   - Update function signatures');
}

// Main execution
async function main() {
  try {
    await cleanupLegacyCode();
    await analyzeCleanupTargets();
    await generateCleanupRecommendations();
    
    console.log('\n🤔 DECISION POINTS');
    console.log('==================');
    console.log('1. **Remove feature flags entirely** vs keep SINGLE_SOURCE flag for future flexibility');
    console.log('2. **Aggressive cleanup** (remove all legacy code now) vs **Conservative** (mark as deprecated)');
    console.log('3. **Update monitoring** to remove legacy mode references vs keep for historical context');
    
    console.log('\n✅ RECOMMENDED APPROACH');
    console.log('======================');
    console.log('**AGGRESSIVE CLEANUP** since this is development environment:');
    console.log('1. Remove all DUAL_CHECK and LEGACY_FALLBACK code');
    console.log('2. Simplify availability service to single function');
    console.log('3. Remove feature flags entirely (hardcode single source behavior)');
    console.log('4. Update monitoring to reflect new simple architecture');
    console.log('5. Clean up type definitions');
    
    console.log('\n📈 BENEFITS:');
    console.log('- Reduces codebase complexity by ~200 lines');
    console.log('- Eliminates confusing code paths');
    console.log('- Improves maintainability');
    console.log('- Simplifies onboarding for new developers');
    console.log('- Removes technical debt');
    
  } catch (error) {
    console.error('❌ Analysis failed:', error);
    process.exit(1);
  }
}

if (require.main === module) {
  main().catch(console.error);
}

export { cleanupLegacyCode };