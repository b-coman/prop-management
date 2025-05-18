import fs from 'fs';
import path from 'path';
import { gzipSync } from 'zlib';

interface AnalysisResult {
  file: string;
  originalSize: number;
  gzippedSize: number;
  translationKeys: number;
  duplicateContent: number;
}

function analyzeTranslationFiles(): AnalysisResult[] {
  const results: AnalysisResult[] = [];
  const localesDir = path.join(process.cwd(), 'locales');
  
  // Analyze translation JSON files
  const files = fs.readdirSync(localesDir).filter(f => f.endsWith('.json'));
  
  files.forEach(file => {
    const filePath = path.join(localesDir, file);
    const content = fs.readFileSync(filePath, 'utf8');
    const data = JSON.parse(content);
    
    // Count translation keys
    let keyCount = 0;
    let duplicates = 0;
    const values = new Set<string>();
    
    function countKeys(obj: any, prefix = '') {
      Object.entries(obj).forEach(([key, value]) => {
        if (typeof value === 'object' && value !== null) {
          countKeys(value, `${prefix}${key}.`);
        } else {
          keyCount++;
          const stringValue = String(value);
          if (values.has(stringValue) && stringValue.length > 10) {
            duplicates++;
          }
          values.add(stringValue);
        }
      });
    }
    
    countKeys(data);
    
    // Calculate sizes
    const originalSize = Buffer.byteLength(content, 'utf8');
    const gzippedSize = gzipSync(content).length;
    
    results.push({
      file,
      originalSize,
      gzippedSize,
      translationKeys: keyCount,
      duplicateContent: duplicates
    });
  });
  
  return results;
}

function analyzeComponentUsage(): { optimizationSuggestions: string[] } {
  const suggestions: string[] = [];
  const componentsDir = path.join(process.cwd(), 'src/components');
  
  // Check for unnecessary re-renders
  const files = findFiles(componentsDir, '.tsx');
  let unnecessaryHooks = 0;
  let missingMemo = 0;
  
  files.forEach(file => {
    const content = fs.readFileSync(file, 'utf8');
    
    // Check for useLanguage in static components
    if (content.includes('useLanguage') && !content.includes('React.memo')) {
      missingMemo++;
    }
    
    // Check for unnecessary language hooks
    if (content.includes('useLanguage') && !content.includes('t(') && !content.includes('tc(')) {
      unnecessaryHooks++;
    }
  });
  
  if (missingMemo > 0) {
    suggestions.push(`Consider adding React.memo to ${missingMemo} components using useLanguage`);
  }
  
  if (unnecessaryHooks > 0) {
    suggestions.push(`Found ${unnecessaryHooks} components importing useLanguage but not using translations`);
  }
  
  return { optimizationSuggestions: suggestions };
}

function findFiles(dir: string, ext: string): string[] {
  const files: string[] = [];
  
  function walk(currentDir: string) {
    const items = fs.readdirSync(currentDir);
    items.forEach(item => {
      const fullPath = path.join(currentDir, item);
      const stat = fs.statSync(fullPath);
      
      if (stat.isDirectory() && !item.startsWith('.') && item !== 'node_modules') {
        walk(fullPath);
      } else if (stat.isFile() && item.endsWith(ext)) {
        files.push(fullPath);
      }
    });
  }
  
  walk(dir);
  return files;
}

function analyzeBundleImpact(): { estimate: string } {
  // Estimate bundle size impact
  const translationFiles = analyzeTranslationFiles();
  const totalTranslationSize = translationFiles.reduce((sum, file) => sum + file.gzippedSize, 0);
  
  // Language switching logic adds roughly 2KB gzipped
  const languageLogicSize = 2048;
  
  const totalImpact = totalTranslationSize + languageLogicSize;
  
  return {
    estimate: `Multilingual system adds approximately ${(totalImpact / 1024).toFixed(1)}KB to bundle (gzipped)`
  };
}

function generateReport() {
  console.log('=== Multilingual Performance Analysis ===\n');
  
  // Translation files analysis
  const translationAnalysis = analyzeTranslationFiles();
  console.log('Translation Files:');
  translationAnalysis.forEach(result => {
    console.log(`- ${result.file}:`);
    console.log(`  Size: ${(result.originalSize / 1024).toFixed(1)}KB (${(result.gzippedSize / 1024).toFixed(1)}KB gzipped)`);
    console.log(`  Keys: ${result.translationKeys}`);
    console.log(`  Duplicates: ${result.duplicateContent}`);
  });
  
  console.log('');
  
  // Component usage analysis
  const componentAnalysis = analyzeComponentUsage();
  console.log('Component Optimization Suggestions:');
  componentAnalysis.optimizationSuggestions.forEach(suggestion => {
    console.log(`- ${suggestion}`);
  });
  
  console.log('');
  
  // Bundle impact
  const bundleAnalysis = analyzeBundleImpact();
  console.log('Bundle Impact:');
  console.log(`- ${bundleAnalysis.estimate}`);
  
  console.log('\n=== Optimization Recommendations ===');
  console.log('1. Use dynamic imports for language files to enable code splitting');
  console.log('2. Implement React.memo for components that only use translations');
  console.log('3. Consider lazy loading translations for rarely used pages');
  console.log('4. Remove duplicate translation values to reduce file size');
  console.log('5. Use translation keys consistently to enable better caching');
}

// Run the analysis
generateReport();