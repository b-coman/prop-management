/**
 * @fileoverview Integration Validation Script
 * @module language-migration/scripts/validate-integration
 * 
 * @description
 * Validates that all integration points are correctly set up for dual-check mode.
 * Checks files, imports, exports, and configuration without needing browser.
 * 
 * @author Claude AI Assistant
 * @version 1.0.0
 * @since 2025-06-05
 */

import fs from 'fs';
import path from 'path';

// Validation results interface
interface ValidationResult {
  component: string;
  status: 'PASS' | 'FAIL' | 'WARNING';
  message: string;
  details?: string;
}

const results: ValidationResult[] = [];

function addResult(component: string, status: 'PASS' | 'FAIL' | 'WARNING', message: string, details?: string) {
  results.push({ component, status, message, details });
}

// Validation functions
function validateFileExists(filePath: string, component: string): boolean {
  const fullPath = path.join(process.cwd(), filePath);
  if (fs.existsSync(fullPath)) {
    addResult(component, 'PASS', `File exists: ${filePath}`);
    return true;
  } else {
    addResult(component, 'FAIL', `File missing: ${filePath}`);
    return false;
  }
}

function validateFileContains(filePath: string, searchText: string, component: string, description: string): boolean {
  const fullPath = path.join(process.cwd(), filePath);
  try {
    const content = fs.readFileSync(fullPath, 'utf8');
    if (content.includes(searchText)) {
      addResult(component, 'PASS', `${description}: Found in ${filePath}`);
      return true;
    } else {
      addResult(component, 'FAIL', `${description}: Not found in ${filePath}`, `Expected: ${searchText}`);
      return false;
    }
  } catch (error) {
    addResult(component, 'FAIL', `Cannot read ${filePath}`, error.message);
    return false;
  }
}

function validateEnvironmentVariable(varName: string, expectedValue: string): boolean {
  // Check .env.local file
  const envPath = path.join(process.cwd(), '.env.local');
  try {
    const envContent = fs.readFileSync(envPath, 'utf8');
    const line = `${varName}=${expectedValue}`;
    if (envContent.includes(line)) {
      addResult('Environment', 'PASS', `${varName} set to ${expectedValue}`);
      return true;
    } else {
      addResult('Environment', 'FAIL', `${varName} not set to ${expectedValue}`, `Check .env.local file`);
      return false;
    }
  } catch (error) {
    addResult('Environment', 'FAIL', `Cannot read .env.local`, error.message);
    return false;
  }
}

// Main validation function
function runIntegrationValidation() {
  console.log('🔍 Running Integration Validation...\n');
  
  // 1. Check core files exist
  console.log('📁 Validating File Structure...');
  validateFileExists('src/app/layout.tsx', 'Layout');
  validateFileExists('src/lib/language-system/LanguageProvider.tsx', 'UnifiedSystem');
  validateFileExists('src/lib/language-system/dual-check-bridge.ts', 'DualCheckBridge');
  validateFileExists('src/lib/language-system/dual-check-logger.ts', 'DualCheckLogger');
  validateFileExists('src/hooks/useLanguage.ts', 'LegacyHook');
  validateFileExists('src/app/test-dual-check/page.tsx', 'TestPage');
  
  // 2. Check integration points
  console.log('\n🔗 Validating Integration Points...');
  validateFileContains(
    'src/app/layout.tsx',
    'LanguageProvider',
    'Layout',
    'LanguageProvider imported and used'
  );
  
  validateFileContains(
    'src/app/layout.tsx',
    'migrationMode="dual_check"',
    'Layout',
    'Dual-check mode configured in LanguageProvider'
  );
  
  validateFileContains(
    'src/hooks/useLanguage.ts',
    'useDualCheckValidator',
    'LegacyHook',
    'Dual-check bridge imported in legacy hook'
  );
  
  validateFileContains(
    'src/hooks/useLanguage.ts',
    'validateLanguageState',
    'LegacyHook',
    'Language state validation integrated'
  );
  
  validateFileContains(
    'src/hooks/useLanguage.ts',
    'validateTranslationResult',
    'LegacyHook',
    'Translation validation integrated'
  );
  
  // 3. Check environment configuration
  console.log('\n🌍 Validating Environment Configuration...');
  validateEnvironmentVariable('NEXT_PUBLIC_LANGUAGE_SYSTEM_MODE', 'dual_check');
  
  // 4. Check dual-check bridge implementation
  console.log('\n🌉 Validating Dual-Check Bridge...');
  validateFileContains(
    'src/lib/language-system/dual-check-bridge.ts',
    'dualCheckLogger',
    'DualCheckBridge',
    'SSR-safe logger imported'
  );
  
  validateFileContains(
    'src/lib/language-system/dual-check-bridge.ts',
    'getCurrentSearchParams',
    'DualCheckBridge',
    'Safe search params extraction implemented'
  );
  
  validateFileContains(
    'src/lib/language-system/dual-check-bridge.ts',
    'Language discrepancy detected',
    'DualCheckBridge',
    'Language comparison logging implemented'
  );
  
  // 5. Check logger implementation
  console.log('\n📝 Validating SSR-Safe Logger...');
  validateFileContains(
    'src/lib/language-system/dual-check-logger.ts',
    'typeof window !== \'undefined\'',
    'DualCheckLogger',
    'SSR safety check implemented'
  );
  
  validateFileContains(
    'src/lib/language-system/dual-check-logger.ts',
    'formatMessage',
    'DualCheckLogger',
    'Message formatting implemented'
  );
  
  // 6. Validate test infrastructure
  console.log('\n🧪 Validating Test Infrastructure...');
  validateFileExists('tests/phase-3-validation.test.ts', 'CoreTests');
  validateFileExists('language-migration/scripts/test-dual-check-simple.ts', 'SimpleTest');
  
  // Summary
  console.log('\n📊 VALIDATION SUMMARY');
  console.log('===================');
  
  const passCount = results.filter(r => r.status === 'PASS').length;
  const failCount = results.filter(r => r.status === 'FAIL').length;
  const warningCount = results.filter(r => r.status === 'WARNING').length;
  
  console.log(`✅ PASSED: ${passCount}`);
  console.log(`❌ FAILED: ${failCount}`);
  console.log(`⚠️  WARNINGS: ${warningCount}`);
  console.log(`📊 TOTAL: ${results.length}\n`);
  
  // Show failures
  const failures = results.filter(r => r.status === 'FAIL');
  if (failures.length > 0) {
    console.log('❌ FAILURES:');
    failures.forEach(f => {
      console.log(`  - ${f.component}: ${f.message}`);
      if (f.details) console.log(`    Details: ${f.details}`);
    });
    console.log('');
  }
  
  // Show warnings
  const warnings = results.filter(r => r.status === 'WARNING');
  if (warnings.length > 0) {
    console.log('⚠️  WARNINGS:');
    warnings.forEach(w => {
      console.log(`  - ${w.component}: ${w.message}`);
      if (w.details) console.log(`    Details: ${w.details}`);
    });
    console.log('');
  }
  
  // Integration readiness assessment
  const integrationReady = failCount === 0;
  console.log('🎯 INTEGRATION READINESS');
  console.log(`Status: ${integrationReady ? '✅ READY' : '❌ NOT READY'}`);
  
  if (integrationReady) {
    console.log('✅ All integration points validated successfully!');
    console.log('✅ Ready for development server testing.');
    console.log('\n🚀 Next Steps:');
    console.log('1. Run: npm run dev');
    console.log('2. Visit: http://localhost:9002/test-dual-check');
    console.log('3. Open browser console');
    console.log('4. Test language switching');
    console.log('5. Look for dual-check logs');
  } else {
    console.log('❌ Integration issues found. Fix failures before testing.');
  }
  
  return {
    ready: integrationReady,
    results,
    summary: { pass: passCount, fail: failCount, warning: warningCount }
  };
}

// Execute validation
if (require.main === module) {
  const result = runIntegrationValidation();
  process.exit(result.ready ? 0 : 1);
}

export { runIntegrationValidation };