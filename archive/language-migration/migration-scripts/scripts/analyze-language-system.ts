#!/usr/bin/env tsx
/**
 * @fileoverview Language System Analysis Script for Migration Planning
 * @module language-migration/scripts/analyze-language-system
 * 
 * @description
 * Comprehensive analysis tool that scans the codebase to identify all language-related
 * files, detect usage patterns, and uncover potential conflicts. Generates detailed
 * reports for migration planning and risk assessment following availability migration methodology.
 * 
 * @architecture
 * Location: Migration infrastructure
 * Layer: Analysis and tooling
 * Pattern: Standalone Node.js script with structured output
 * 
 * @dependencies
 * - Internal: @/lib/logger (centralized logging)
 * - External: fs/promises, path
 * 
 * @relationships
 * - Provides: Language system analysis data for migration planning
 * - Consumes: Source code files throughout the project
 * - Children: Generated analysis reports and logs
 * - Parent: Language migration Phase 1 process
 * 
 * @performance
 * - Optimizations: Efficient file scanning with pattern matching
 * - Concerns: Large codebases may take 30+ seconds to analyze
 * 
 * @example
 * ```bash
 * # Run analysis
 * npm run language:analyze
 * npx tsx language-migration/scripts/analyze-language-system.ts
 * 
 * # Output files created
 * language-migration/logs/language-analysis-[timestamp].json
 * language-migration/logs/language-summary-[timestamp].txt
 * ```
 * 
 * @migration-notes
 * Part of Phase 1 language system migration. Provides foundation analysis for
 * migrating from fragmented language system to unified architecture.
 * 
 * @since v1.0.0
 * @author RentalSpot Team
 */

import { promises as fs } from 'fs';
import path from 'path';
import { loggers } from '@/lib/logger';

const logger = loggers.languageMigration;

interface LanguageSystemAnalysis {
  timestamp: string;
  files: {
    contexts: string[];
    hooks: string[];
    components: string[];
    utils: string[];
    translations: string[];
  };
  usagePatterns: {
    urlBasedLanguage: string[];
    queryParamLanguage: string[];
    localStorageLanguage: string[];
    browserLanguage: string[];
  };
  conflicts: {
    multipleHooks: string[];
    hydrationRisks: string[];
    performanceIssues: string[];
  };
  dependencies: {
    externalLibraries: string[];
    internalDependencies: string[];
  };
  recommendations: string[];
}

async function findLanguageFiles(dir: string, extensions: string[] = ['.ts', '.tsx', '.js', '.jsx']): Promise<string[]> {
  const files: string[] = [];
  
  try {
    const entries = await fs.readdir(dir, { withFileTypes: true });
    
    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);
      
      if (entry.isDirectory()) {
        // Skip node_modules and other irrelevant directories
        if (!['node_modules', '.git', '.next', 'dist', 'build'].includes(entry.name)) {
          files.push(...await findLanguageFiles(fullPath, extensions));
        }
      } else if (extensions.some(ext => entry.name.endsWith(ext))) {
        // Check if file contains language-related code
        try {
          const content = await fs.readFile(fullPath, 'utf-8');
          if (isLanguageRelated(content)) {
            files.push(fullPath);
          }
        } catch (error) {
          console.warn(`Could not read file ${fullPath}:`, error);
        }
      }
    }
  } catch (error) {
    console.warn(`Could not read directory ${dir}:`, error);
  }
  
  return files;
}

function isLanguageRelated(content: string): boolean {
  const languageKeywords = [
    'useLanguage',
    'LanguageContext',
    'LanguageProvider',
    'useOptimizedLanguage',
    'switchLanguage',
    'currentLang',
    'SUPPORTED_LANGUAGES',
    'DEFAULT_LANGUAGE',
    'language',
    'locale',
    'i18n',
    'translation',
    'preferredLanguage',
    'navigator.language',
    'localStorage.getItem(\'preferredLanguage\')',
    'language=',
    '/locales/',
    '.json'
  ];
  
  return languageKeywords.some(keyword => content.includes(keyword));
}

function categorizeFile(filePath: string, content: string): keyof LanguageSystemAnalysis['files'] {
  if (filePath.includes('/contexts/') && content.includes('createContext')) {
    return 'contexts';
  }
  if (filePath.includes('/hooks/') || content.includes('function use')) {
    return 'hooks';
  }
  if (filePath.includes('/components/') || content.includes('export function') || content.includes('export const')) {
    return 'components';
  }
  if (filePath.includes('/lib/') || filePath.includes('/utils/')) {
    return 'utils';
  }
  if (filePath.includes('/locales/') || filePath.endsWith('.json')) {
    return 'translations';
  }
  return 'components'; // Default fallback
}

function analyzeUsagePatterns(content: string): keyof LanguageSystemAnalysis['usagePatterns'] | null {
  if (content.includes('segments.indexOf(\'properties\')') || content.includes('pathname.split(\'/\')')) {
    return 'urlBasedLanguage';
  }
  if (content.includes('URLSearchParams') || content.includes('?language=') || content.includes('searchParams')) {
    return 'queryParamLanguage';
  }
  if (content.includes('localStorage.getItem') || content.includes('localStorage.setItem')) {
    return 'localStorageLanguage';
  }
  if (content.includes('navigator.language') || content.includes('browserLang')) {
    return 'browserLanguage';
  }
  return null;
}

function detectConflicts(content: string, filePath: string): Array<keyof LanguageSystemAnalysis['conflicts']> {
  const conflicts: Array<keyof LanguageSystemAnalysis['conflicts']> = [];
  
  // Multiple hooks usage
  if (content.includes('useLanguage') && content.includes('useOptimizedLanguage')) {
    conflicts.push('multipleHooks');
  }
  
  // Hydration risks
  if (content.includes('typeof window !== \'undefined\'') && content.includes('useState')) {
    conflicts.push('hydrationRisks');
  }
  
  // Performance issues
  if (content.includes('useEffect') && content.includes('fetch') && content.includes('language')) {
    conflicts.push('performanceIssues');
  }
  
  return conflicts;
}

async function analyzeLanguageSystem(): Promise<LanguageSystemAnalysis> {
  logger.info('Starting language system analysis');
  
  const projectRoot = process.cwd();
  const srcDir = path.join(projectRoot, 'src');
  
  // Find all language-related files
  logger.info('Scanning for language-related files', { srcDir });
  const languageFiles = await findLanguageFiles(srcDir);
  
  logger.info('Language files discovered', { count: languageFiles.length });
  
  const analysis: LanguageSystemAnalysis = {
    timestamp: new Date().toISOString(),
    files: {
      contexts: [],
      hooks: [],
      components: [],
      utils: [],
      translations: []
    },
    usagePatterns: {
      urlBasedLanguage: [],
      queryParamLanguage: [],
      localStorageLanguage: [],
      browserLanguage: []
    },
    conflicts: {
      multipleHooks: [],
      hydrationRisks: [],
      performanceIssues: []
    },
    dependencies: {
      externalLibraries: [],
      internalDependencies: []
    },
    recommendations: []
  };
  
  // Analyze each file
  for (const filePath of languageFiles) {
    try {
      const content = await fs.readFile(filePath, 'utf-8');
      const relativePath = path.relative(projectRoot, filePath);
      
      // Categorize file
      const category = categorizeFile(filePath, content);
      analysis.files[category].push(relativePath);
      
      // Analyze usage patterns
      const pattern = analyzeUsagePatterns(content);
      if (pattern) {
        analysis.usagePatterns[pattern].push(relativePath);
      }
      
      // Detect conflicts
      const conflicts = detectConflicts(content, filePath);
      conflicts.forEach(conflict => {
        if (!analysis.conflicts[conflict].includes(relativePath)) {
          analysis.conflicts[conflict].push(relativePath);
        }
      });
      
    } catch (error) {
      logger.warn('Could not analyze file', { filePath, error });
    }
  }
  
  // Generate recommendations
  analysis.recommendations = generateRecommendations(analysis);
  
  return analysis;
}

function generateRecommendations(analysis: LanguageSystemAnalysis): string[] {
  const recommendations: string[] = [];
  
  // Check for multiple language systems
  if (analysis.files.contexts.length > 1) {
    recommendations.push('CRITICAL: Multiple language contexts detected - consolidation needed');
  }
  
  if (analysis.files.hooks.length > 2) {
    recommendations.push('HIGH: Multiple language hooks found - unify into single hook');
  }
  
  if (analysis.conflicts.hydrationRisks.length > 0) {
    recommendations.push('HIGH: Hydration risks detected - implement SSR-safe language detection');
  }
  
  if (analysis.conflicts.performanceIssues.length > 0) {
    recommendations.push('MEDIUM: Performance issues detected - optimize translation loading');
  }
  
  if (analysis.usagePatterns.urlBasedLanguage.length > 0 && analysis.usagePatterns.queryParamLanguage.length > 0) {
    recommendations.push('MEDIUM: Mixed URL and query param usage - standardize approach');
  }
  
  return recommendations;
}

async function saveAnalysis(analysis: LanguageSystemAnalysis): Promise<void> {
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const logsDir = path.join(process.cwd(), 'language-migration', 'logs');
  
  // Ensure logs directory exists
  await fs.mkdir(logsDir, { recursive: true });
  
  // Save detailed JSON report
  const jsonPath = path.join(logsDir, `language-analysis-${timestamp}.json`);
  await fs.writeFile(jsonPath, JSON.stringify(analysis, null, 2));
  
  // Save human-readable summary
  const summaryPath = path.join(logsDir, `language-summary-${timestamp}.txt`);
  const summary = generateSummaryReport(analysis);
  await fs.writeFile(summaryPath, summary);
  
  console.log(`📊 Analysis saved to:`);
  console.log(`   📄 ${jsonPath}`);
  console.log(`   📝 ${summaryPath}`);
}

function generateSummaryReport(analysis: LanguageSystemAnalysis): string {
  return `# Language System Analysis Report
Generated: ${analysis.timestamp}

## File Distribution
- Contexts: ${analysis.files.contexts.length}
- Hooks: ${analysis.files.hooks.length}
- Components: ${analysis.files.components.length}
- Utils: ${analysis.files.utils.length}
- Translations: ${analysis.files.translations.length}

## Usage Patterns
- URL-based language: ${analysis.usagePatterns.urlBasedLanguage.length} files
- Query param language: ${analysis.usagePatterns.queryParamLanguage.length} files
- localStorage language: ${analysis.usagePatterns.localStorageLanguage.length} files
- Browser language: ${analysis.usagePatterns.browserLanguage.length} files

## Conflicts Detected
- Multiple hooks: ${analysis.conflicts.multipleHooks.length} files
- Hydration risks: ${analysis.conflicts.hydrationRisks.length} files
- Performance issues: ${analysis.conflicts.performanceIssues.length} files

## Recommendations
${analysis.recommendations.map(rec => `- ${rec}`).join('\n')}

## Critical Files for Migration
### Contexts
${analysis.files.contexts.map(file => `- ${file}`).join('\n')}

### Hooks
${analysis.files.hooks.map(file => `- ${file}`).join('\n')}

### High-Risk Files (Hydration)
${analysis.conflicts.hydrationRisks.map(file => `- ${file}`).join('\n')}

---
This analysis provides the foundation for the language system migration plan.
Review recommendations carefully before proceeding with migration phases.
`;
}

// Main execution
async function main() {
  try {
    logger.info('Language System Analysis Starting', { methodology: 'availability migration' });
    
    const analysis = await analyzeLanguageSystem();
    await saveAnalysis(analysis);
    
    const summary = {
      totalFiles: Object.values(analysis.files).flat().length,
      hydrationRisks: analysis.conflicts.hydrationRisks.length,
      recommendations: analysis.recommendations.length,
      topRecommendations: analysis.recommendations.slice(0, 3)
    };
    
    logger.info('Analysis completed successfully', summary);
    
    // Console output for immediate feedback
    console.log('🚀 Language System Analysis Starting...');
    console.log('Following availability migration methodology\n');
    console.log('\n✅ Analysis completed successfully!');
    console.log('\n📋 Summary:');
    console.log(`   📁 ${summary.totalFiles} language-related files found`);
    console.log(`   ⚠️  ${summary.hydrationRisks} hydration risks detected`);
    console.log(`   💡 ${summary.recommendations} recommendations generated`);
    
    if (summary.recommendations > 0) {
      console.log('\n🎯 Top Recommendations:');
      summary.topRecommendations.forEach(rec => console.log(`   - ${rec}`));
    }
    
  } catch (error) {
    logger.error('Analysis failed', error);
    console.error('❌ Analysis failed:', error);
    process.exit(1);
  }
}

if (require.main === module) {
  main();
}

export { analyzeLanguageSystem, type LanguageSystemAnalysis };