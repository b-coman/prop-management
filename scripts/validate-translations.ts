import fs from 'fs';
import path from 'path';
import { diff } from 'jest-diff';

interface ValidationResult {
  missingKeys: string[];
  extraKeys: string[];
  emptyValues: string[];
  untranslated: string[];
  typeMismatches: string[];
}

function loadTranslationFile(lang: string): any {
  const filePath = path.join(process.cwd(), 'locales', `${lang}.json`);
  const content = fs.readFileSync(filePath, 'utf8');
  return JSON.parse(content);
}

function getKeys(obj: any, prefix = ''): Set<string> {
  const keys = new Set<string>();
  
  Object.entries(obj).forEach(([key, value]) => {
    const fullKey = prefix ? `${prefix}.${key}` : key;
    
    if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
      // Recurse into nested objects
      const nestedKeys = getKeys(value, fullKey);
      nestedKeys.forEach(k => keys.add(k));
    } else {
      keys.add(fullKey);
    }
  });
  
  return keys;
}

function getValue(obj: any, key: string): any {
  const keys = key.split('.');
  let value = obj;
  
  for (const k of keys) {
    if (value && typeof value === 'object' && k in value) {
      value = value[k];
    } else {
      return undefined;
    }
  }
  
  return value;
}

function validateTranslations(sourceLang: string, targetLang: string): ValidationResult {
  const source = loadTranslationFile(sourceLang);
  const target = loadTranslationFile(targetLang);
  
  const sourceKeys = getKeys(source);
  const targetKeys = getKeys(target);
  
  const result: ValidationResult = {
    missingKeys: [],
    extraKeys: [],
    emptyValues: [],
    untranslated: [],
    typeMismatches: []
  };
  
  // Find missing keys in target
  sourceKeys.forEach(key => {
    if (!targetKeys.has(key)) {
      result.missingKeys.push(key);
    }
  });
  
  // Find extra keys in target
  targetKeys.forEach(key => {
    if (!sourceKeys.has(key)) {
      result.extraKeys.push(key);
    }
  });
  
  // Check for empty values and untranslated content
  targetKeys.forEach(key => {
    const value = getValue(target, key);
    const sourceValue = getValue(source, key);
    
    // Check for empty values
    if (value === '' || value === null || value === undefined) {
      result.emptyValues.push(key);
    }
    
    // Check for untranslated content (same as source)
    if (value && sourceValue && value === sourceValue && targetLang !== sourceLang) {
      result.untranslated.push(key);
    }
    
    // Check for type mismatches
    if (sourceValue !== undefined && value !== undefined && typeof sourceValue !== typeof value) {
      result.typeMismatches.push(`${key}: ${typeof sourceValue} in source, ${typeof value} in target`);
    }
  });
  
  return result;
}

function checkForInconsistencies(): { issues: string[] } {
  const issues: string[] = [];
  const en = loadTranslationFile('en');
  const ro = loadTranslationFile('ro');
  
  // Check for placeholder mismatches
  const checkPlaceholders = (obj: any, prefix = '', lang: string) => {
    Object.entries(obj).forEach(([key, value]) => {
      const fullKey = prefix ? `${prefix}.${key}` : key;
      
      if (typeof value === 'string') {
        // Find placeholders like {name}, {{count}}, %s, etc.
        const placeholders = value.match(/{\w+}|{{\w+}}|%\w/g) || [];
        
        if (placeholders.length > 0) {
          // Compare with other language
          const otherLang = lang === 'en' ? ro : en;
          const otherValue = getValue(otherLang, fullKey);
          
          if (typeof otherValue === 'string') {
            const otherPlaceholders = otherValue.match(/{\w+}|{{\w+}}|%\w/g) || [];
            
            if (placeholders.length !== otherPlaceholders.length) {
              issues.push(`Placeholder count mismatch in ${fullKey}: ${lang} has ${placeholders.length}, other has ${otherPlaceholders.length}`);
            }
          }
        }
      } else if (typeof value === 'object' && value !== null) {
        checkPlaceholders(value, fullKey, lang);
      }
    });
  };
  
  checkPlaceholders(en, '', 'en');
  
  return { issues };
}

function validateMarkupTags(): { issues: string[] } {
  const issues: string[] = [];
  const files = ['en', 'ro'];
  
  files.forEach(lang => {
    const translations = loadTranslationFile(lang);
    
    const checkTags = (obj: any, prefix = '') => {
      Object.entries(obj).forEach(([key, value]) => {
        const fullKey = prefix ? `${prefix}.${key}` : key;
        
        if (typeof value === 'string') {
          // Check for HTML tags
          const tags = value.match(/<[^>]+>/g) || [];
          
          tags.forEach(tag => {
            // Check if tag is properly closed
            const tagName = tag.match(/<\/?(\w+)/);
            if (tagName && !tag.endsWith('/>')) {
              const closingTag = `</${tagName[1]}>`;
              if (!value.includes(closingTag) && !tag.startsWith('</')) {
                issues.push(`Unclosed HTML tag in ${lang}.${fullKey}: ${tag}`);
              }
            }
          });
          
          // Check for unescaped special characters
          if (value.includes('&') && !value.includes('&amp;') && !value.includes('&#')) {
            issues.push(`Unescaped ampersand in ${lang}.${fullKey}`);
          }
        } else if (typeof value === 'object' && value !== null) {
          checkTags(value, fullKey);
        }
      });
    };
    
    checkTags(translations);
  });
  
  return { issues };
}

function generateValidationReport() {
  console.log('=== Translation Validation Report ===\n');
  
  // Validate Romanian against English
  console.log('Validating Romanian translations...');
  const roValidation = validateTranslations('en', 'ro');
  
  console.log(`\nMissing keys in Romanian: ${roValidation.missingKeys.length}`);
  if (roValidation.missingKeys.length > 0) {
    roValidation.missingKeys.slice(0, 5).forEach(key => console.log(`  - ${key}`));
    if (roValidation.missingKeys.length > 5) {
      console.log(`  ... and ${roValidation.missingKeys.length - 5} more`);
    }
  }
  
  console.log(`\nExtra keys in Romanian: ${roValidation.extraKeys.length}`);
  if (roValidation.extraKeys.length > 0) {
    roValidation.extraKeys.forEach(key => console.log(`  - ${key}`));
  }
  
  console.log(`\nEmpty values in Romanian: ${roValidation.emptyValues.length}`);
  if (roValidation.emptyValues.length > 0) {
    roValidation.emptyValues.forEach(key => console.log(`  - ${key}`));
  }
  
  console.log(`\nUntranslated content in Romanian: ${roValidation.untranslated.length}`);
  if (roValidation.untranslated.length > 0) {
    console.log('  (These keys have the same value as English and may need translation)');
    roValidation.untranslated.slice(0, 10).forEach(key => console.log(`  - ${key}`));
    if (roValidation.untranslated.length > 10) {
      console.log(`  ... and ${roValidation.untranslated.length - 10} more`);
    }
  }
  
  // Check for inconsistencies
  console.log('\nChecking for inconsistencies...');
  const inconsistencies = checkForInconsistencies();
  if (inconsistencies.issues.length > 0) {
    inconsistencies.issues.forEach(issue => console.log(`  - ${issue}`));
  } else {
    console.log('  No inconsistencies found');
  }
  
  // Validate markup
  console.log('\nValidating markup in translations...');
  const markupIssues = validateMarkupTags();
  if (markupIssues.issues.length > 0) {
    markupIssues.issues.forEach(issue => console.log(`  - ${issue}`));
  } else {
    console.log('  No markup issues found');
  }
  
  // Summary
  console.log('\n=== Summary ===');
  const totalIssues = roValidation.missingKeys.length + 
                     roValidation.extraKeys.length + 
                     roValidation.emptyValues.length + 
                     inconsistencies.issues.length + 
                     markupIssues.issues.length;
  
  if (totalIssues === 0) {
    console.log('✅ All translations are valid!');
  } else {
    console.log(`⚠️  Found ${totalIssues} issues that need attention`);
    console.log('\nPriority fixes:');
    console.log('1. Add missing keys to maintain feature parity');
    console.log('2. Fix empty values that will show as blank');
    console.log('3. Review untranslated content');
    console.log('4. Fix any markup or placeholder issues');
  }
  
  // Export report
  const report = {
    validation: roValidation,
    inconsistencies: inconsistencies.issues,
    markupIssues: markupIssues.issues,
    timestamp: new Date().toISOString()
  };
  
  fs.writeFileSync(
    path.join(process.cwd(), 'translation-validation-report.json'),
    JSON.stringify(report, null, 2)
  );
  
  console.log('\n📄 Full report saved to translation-validation-report.json');
}

// Run validation
generateValidationReport();