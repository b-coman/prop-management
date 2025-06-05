#!/usr/bin/env tsx
/**
 * @fileoverview Language System Import Tracking Script
 * @module language-migration/scripts/track-language-usage
 * 
 * @description
 * Tracks which files import deprecated language modules to ensure safe migration.
 * Validates that deprecated files can be safely archived by checking for active imports.
 * Follows file versioning and cleanup strategy from project documentation.
 * 
 * @architecture
 * Location: Migration infrastructure
 * Layer: Analysis and validation tooling
 * Pattern: Standalone Node.js script with import analysis
 * 
 * @dependencies
 * - Internal: @/lib/logger (centralized logging)
 * - External: fs/promises, path, glob
 * 
 * @relationships
 * - Provides: Import usage validation for safe file archival
 * - Consumes: Source code files and their import statements
 * - Children: Usage validation reports
 * - Parent: Language migration cleanup phase
 * 
 * @performance
 * - Optimizations: Efficient import parsing with regex patterns
 * - Concerns: Large codebases may require multiple passes
 * 
 * @example
 * ```bash
 * # Check all deprecated files
 * npm run language:track-usage
 * 
 * # Check specific file
 * npm run language:track-usage -- src/hooks/useLanguage.ts
 * 
 * # Check if safe to archive
 * npm run language:check-safe-archive
 * ```
 * 
 * @migration-notes
 * Part of Phase 5 language system migration cleanup. Ensures no files are archived
 * while still being imported elsewhere in the codebase.
 * 
 * @since v1.0.0
 * @author RentalSpot Team
 */

import { promises as fs } from 'fs';
import path from 'path';
import { loggers } from '@/lib/logger';

const logger = loggers.languageSystem;

interface ImportUsage {
  file: string;
  status: 'ACTIVE' | 'DEPRECATED' | 'ARCHIVED';
  importers: string[];
  usageCount: number;
  safeToArchive: boolean;
  deprecationDate?: string;
  removalDate?: string;
}

interface UsageAnalysis {
  timestamp: string;
  totalFiles: number;
  deprecatedFiles: ImportUsage[];
  activeFiles: ImportUsage[];
  safeToArchive: string[];
  blockedFromArchival: string[];
  recommendations: string[];
}

async function findAllSourceFiles(dir: string): Promise<string[]> {
  const files: string[] = [];
  const extensions = ['.ts', '.tsx', '.js', '.jsx'];
  
  try {
    const entries = await fs.readdir(dir, { withFileTypes: true });
    
    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);
      
      if (entry.isDirectory()) {
        if (!['node_modules', '.git', '.next', 'dist', 'build', '_archive'].includes(entry.name)) {
          files.push(...await findAllSourceFiles(fullPath));
        }
      } else if (extensions.some(ext => entry.name.endsWith(ext))) {
        files.push(fullPath);
      }
    }
  } catch (error) {
    logger.warn('Could not read directory', { dir, error });
  }
  
  return files;
}

async function getFileStatus(filePath: string): Promise<{ status: string; deprecationDate?: string; removalDate?: string }> {
  try {
    const content = await fs.readFile(filePath, 'utf-8');
    
    // Look for @file-status header
    const statusMatch = content.match(/@file-status:\s*(ACTIVE|DEPRECATED|ARCHIVED)/);
    const status = statusMatch ? statusMatch[1] : 'ACTIVE';
    
    // Look for deprecation date
    const deprecationMatch = content.match(/@deprecation-date:\s*([0-9-]+)/);
    const deprecationDate = deprecationMatch ? deprecationMatch[1] : undefined;
    
    // Look for removal date
    const removalMatch = content.match(/@removal-date:\s*([0-9-]+)/);
    const removalDate = removalMatch ? removalMatch[1] : undefined;
    
    return { status, deprecationDate, removalDate };
  } catch (error) {
    logger.warn('Could not read file for status', { filePath, error });
    return { status: 'ACTIVE' };
  }
}

async function findImporters(targetFile: string, allFiles: string[]): Promise<string[]> {
  const targetBasename = path.basename(targetFile, path.extname(targetFile));
  const targetDir = path.dirname(targetFile);
  const importers: string[] = [];
  
  for (const file of allFiles) {
    try {
      const content = await fs.readFile(file, 'utf-8');
      
      // Check for various import patterns
      const importPatterns = [
        // Direct imports
        new RegExp(`import.*from\\s+['"\`]${escapeRegex(targetFile)}['"\`]`, 'g'),
        new RegExp(`import.*from\\s+['"\`].*${escapeRegex(targetBasename)}['"\`]`, 'g'),
        // Relative imports
        new RegExp(`import.*from\\s+['"\`]\\./.*${escapeRegex(targetBasename)}['"\`]`, 'g'),
        new RegExp(`import.*from\\s+['"\`]\\.\\..*${escapeRegex(targetBasename)}['"\`]`, 'g'),
        // Absolute imports with alias
        new RegExp(`import.*from\\s+['"\`]@/.*${escapeRegex(targetBasename)}['"\`]`, 'g'),
      ];
      
      const hasImport = importPatterns.some(pattern => pattern.test(content));
      
      if (hasImport) {
        const relativePath = path.relative(process.cwd(), file);
        importers.push(relativePath);
      }
    } catch (error) {
      logger.warn('Could not check imports in file', { file, error });
    }
  }
  
  return importers;
}

function escapeRegex(string: string): string {
  return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

async function analyzeLanguageFileUsage(specificFile?: string): Promise<UsageAnalysis> {
  logger.info('Starting language file usage analysis', { specificFile });
  
  const projectRoot = process.cwd();
  const allFiles = await findAllSourceFiles(path.join(projectRoot, 'src'));
  
  // Language-related files to track
  const languageFiles = allFiles.filter(file => {
    const content = fs.readFile(file, 'utf-8').catch(() => '');
    return file.includes('Language') || 
           file.includes('language') || 
           file.includes('useLanguage') ||
           file.includes('LanguageContext');
  });
  
  const targetFiles = specificFile ? [specificFile] : languageFiles;
  const analysis: UsageAnalysis = {
    timestamp: new Date().toISOString(),
    totalFiles: targetFiles.length,
    deprecatedFiles: [],
    activeFiles: [],
    safeToArchive: [],
    blockedFromArchival: [],
    recommendations: []
  };
  
  for (const file of targetFiles) {
    const relativePath = path.relative(projectRoot, file);
    const { status, deprecationDate, removalDate } = await getFileStatus(file);
    const importers = await findImporters(file, allFiles);
    const usageCount = importers.length;
    const safeToArchive = status === 'DEPRECATED' && usageCount === 0;
    
    const usage: ImportUsage = {
      file: relativePath,
      status: status as 'ACTIVE' | 'DEPRECATED' | 'ARCHIVED',
      importers,
      usageCount,
      safeToArchive,
      deprecationDate,
      removalDate
    };
    
    if (status === 'DEPRECATED') {
      analysis.deprecatedFiles.push(usage);
      if (safeToArchive) {
        analysis.safeToArchive.push(relativePath);
      } else {
        analysis.blockedFromArchival.push(relativePath);
      }
    } else {
      analysis.activeFiles.push(usage);
    }
  }
  
  // Generate recommendations
  analysis.recommendations = generateUsageRecommendations(analysis);
  
  logger.info('Usage analysis completed', {
    totalFiles: analysis.totalFiles,
    deprecated: analysis.deprecatedFiles.length,
    safeToArchive: analysis.safeToArchive.length,
    blocked: analysis.blockedFromArchival.length
  });
  
  return analysis;
}

function generateUsageRecommendations(analysis: UsageAnalysis): string[] {
  const recommendations: string[] = [];
  
  if (analysis.safeToArchive.length > 0) {
    recommendations.push(`SAFE: ${analysis.safeToArchive.length} files ready for archival`);
  }
  
  if (analysis.blockedFromArchival.length > 0) {
    recommendations.push(`BLOCKED: ${analysis.blockedFromArchival.length} files still have imports - update required`);
  }
  
  // Check for overdue removals
  const today = new Date();
  const overdueRemovals = analysis.deprecatedFiles.filter(file => {
    if (!file.removalDate) return false;
    const removalDate = new Date(file.removalDate);
    return today > removalDate;
  });
  
  if (overdueRemovals.length > 0) {
    recommendations.push(`OVERDUE: ${overdueRemovals.length} files past removal date`);
  }
  
  return recommendations;
}

async function saveUsageAnalysis(analysis: UsageAnalysis): Promise<void> {
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const logsDir = path.join(process.cwd(), 'language-migration', 'logs');
  
  await fs.mkdir(logsDir, { recursive: true });
  
  // Save detailed JSON
  const jsonPath = path.join(logsDir, `language-usage-${timestamp}.json`);
  await fs.writeFile(jsonPath, JSON.stringify(analysis, null, 2));
  
  // Save human-readable report
  const reportPath = path.join(logsDir, `language-usage-report-${timestamp}.txt`);
  const report = generateUsageReport(analysis);
  await fs.writeFile(reportPath, report);
  
  logger.info('Usage analysis saved', { jsonPath, reportPath });
  console.log(`📊 Usage analysis saved to:`);
  console.log(`   📄 ${jsonPath}`);
  console.log(`   📝 ${reportPath}`);
}

function generateUsageReport(analysis: UsageAnalysis): string {
  return `# Language File Usage Analysis Report
Generated: ${analysis.timestamp}

## Summary
- Total files analyzed: ${analysis.totalFiles}
- Deprecated files: ${analysis.deprecatedFiles.length}
- Active files: ${analysis.activeFiles.length}
- Safe to archive: ${analysis.safeToArchive.length}
- Blocked from archival: ${analysis.blockedFromArchival.length}

## Safe to Archive (No Imports)
${analysis.safeToArchive.map(file => `✅ ${file}`).join('\n') || 'None'}

## Blocked from Archival (Still Imported)
${analysis.blockedFromArchival.map(file => {
  const usage = analysis.deprecatedFiles.find(f => f.file === file);
  const importers = usage?.importers.map(imp => `    - ${imp}`).join('\n') || '';
  return `⚠️  ${file} (${usage?.usageCount} imports)\n${importers}`;
}).join('\n\n') || 'None'}

## Recommendations
${analysis.recommendations.map(rec => `- ${rec}`).join('\n')}

## Detailed Usage by File
${analysis.deprecatedFiles.map(file => `
### ${file.file}
- Status: ${file.status}
- Usage Count: ${file.usageCount}
- Safe to Archive: ${file.safeToArchive ? 'Yes' : 'No'}
- Deprecation Date: ${file.deprecationDate || 'Not set'}
- Removal Date: ${file.removalDate || 'Not set'}
- Importers:
${file.importers.map(imp => `  - ${imp}`).join('\n') || '  None'}
`).join('\n')}

---
This report helps ensure safe file archival during language migration cleanup.
`;
}

// Main execution
async function main() {
  try {
    const specificFile = process.argv[2];
    
    logger.info('Language usage tracking started', { specificFile });
    
    const analysis = await analyzeLanguageFileUsage(specificFile);
    await saveUsageAnalysis(analysis);
    
    // Console output
    console.log('🔍 Language File Usage Analysis');
    console.log('===============================\n');
    
    if (analysis.safeToArchive.length > 0) {
      console.log('✅ Safe to Archive:');
      analysis.safeToArchive.forEach(file => console.log(`   - ${file}`));
      console.log('');
    }
    
    if (analysis.blockedFromArchival.length > 0) {
      console.log('⚠️  Blocked from Archival:');
      analysis.blockedFromArchival.forEach(file => {
        const usage = analysis.deprecatedFiles.find(f => f.file === file);
        console.log(`   - ${file} (${usage?.usageCount} imports)`);
        usage?.importers.slice(0, 3).forEach(imp => console.log(`     └─ ${imp}`));
        if ((usage?.importers.length || 0) > 3) {
          console.log(`     └─ ... and ${(usage?.importers.length || 0) - 3} more`);
        }
      });
      console.log('');
    }
    
    if (analysis.recommendations.length > 0) {
      console.log('💡 Recommendations:');
      analysis.recommendations.forEach(rec => console.log(`   - ${rec}`));
    }
    
  } catch (error) {
    logger.error('Usage analysis failed', error);
    console.error('❌ Usage analysis failed:', error);
    process.exit(1);
  }
}

if (require.main === module) {
  main();
}

export { analyzeLanguageFileUsage, type UsageAnalysis, type ImportUsage };