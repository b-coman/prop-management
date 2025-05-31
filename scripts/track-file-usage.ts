#!/usr/bin/env node

/**
 * @fileoverview Tracks which files import deprecated modules and manages file lifecycle
 * @module scripts/track-file-usage
 * 
 * @description
 * Analyzes import statements across the codebase to find usage of deprecated files.
 * Helps safely archive or delete old files by ensuring they're no longer referenced.
 * Also identifies duplicate files and suggests consolidation opportunities.
 * 
 * @architecture
 * Location: Development tooling
 * Layer: Build/Development tools
 * Pattern: Static analysis tool
 * 
 * @example
 * ```bash
 * # Check all deprecated files
 * npm run track-usage
 * 
 * # Check specific file
 * npm run track-usage -- src/contexts/BookingContext.tsx
 * 
 * # Find duplicate files
 * npm run track-usage -- --find-duplicates
 * ```
 */

import * as ts from 'typescript';
import * as fs from 'fs';
import * as path from 'path';
import * as glob from 'glob';
import chalk from 'chalk';
import { createHash } from 'crypto';

interface FileStatus {
  path: string;
  status: 'ACTIVE' | 'DEPRECATED' | 'ARCHIVED';
  replacedBy?: string;
  deprecationDate?: string;
  removalDate?: string;
  importers: string[];
  exports: string[];
}

interface DuplicateGroup {
  hash: string;
  files: string[];
  sample: string;
}

class FileUsageTracker {
  private fileStatusCache = new Map<string, FileStatus>();
  private importGraph = new Map<string, Set<string>>();

  async analyzeCodebase(): Promise<void> {
    console.log(chalk.blue('Analyzing codebase...\n'));
    
    // Get all TypeScript/JavaScript files
    const files = glob.sync('src/**/*.{ts,tsx,js,jsx}', {
      ignore: ['**/node_modules/**', '**/dist/**', '**/*.test.*', '**/*.spec.*']
    });

    // First pass: Extract file status and exports
    for (const file of files) {
      this.analyzeFile(file);
    }

    // Second pass: Build import graph
    for (const file of files) {
      this.findImports(file);
    }

    // Report findings
    this.reportDeprecatedFiles();
    this.reportUnusedFiles();
    this.reportVersionedFiles();
  }

  private analyzeFile(filePath: string): void {
    const content = fs.readFileSync(filePath, 'utf-8');
    const status: FileStatus = {
      path: filePath,
      status: 'ACTIVE',
      importers: [],
      exports: []
    };

    // Extract file status from header
    const statusMatch = content.match(/@file-status:\s*(ACTIVE|DEPRECATED|ARCHIVED)/);
    if (statusMatch) {
      status.status = statusMatch[1] as FileStatus['status'];
    }

    const replacedByMatch = content.match(/@replaced-by:\s*(.+)/);
    if (replacedByMatch) {
      status.replacedBy = replacedByMatch[1].trim();
    }

    const deprecationMatch = content.match(/@deprecation-date:\s*(.+)/);
    if (deprecationMatch) {
      status.deprecationDate = deprecationMatch[1].trim();
    }

    const removalMatch = content.match(/@removal-date:\s*(.+)/);
    if (removalMatch) {
      status.removalDate = removalMatch[1].trim();
    }

    // Find exports
    const exportMatches = content.matchAll(/export\s+(?:const|function|class|interface|type|enum)\s+(\w+)/g);
    for (const match of exportMatches) {
      status.exports.push(match[1]);
    }

    this.fileStatusCache.set(filePath, status);
  }

  private findImports(filePath: string): void {
    const content = fs.readFileSync(filePath, 'utf-8');
    const sourceFile = ts.createSourceFile(
      filePath,
      content,
      ts.ScriptTarget.Latest,
      true
    );

    const imports = new Set<string>();

    const visit = (node: ts.Node): void => {
      if (ts.isImportDeclaration(node)) {
        const moduleSpecifier = node.moduleSpecifier;
        if (ts.isStringLiteral(moduleSpecifier)) {
          const importPath = this.resolveImportPath(filePath, moduleSpecifier.text);
          if (importPath) {
            imports.add(importPath);
            
            // Update importers list
            const targetStatus = this.fileStatusCache.get(importPath);
            if (targetStatus) {
              targetStatus.importers.push(filePath);
            }
          }
        }
      }
      ts.forEachChild(node, visit);
    };

    visit(sourceFile);
    this.importGraph.set(filePath, imports);
  }

  private resolveImportPath(fromFile: string, importPath: string): string | null {
    // Handle relative imports
    if (importPath.startsWith('.')) {
      const dir = path.dirname(fromFile);
      const resolved = path.resolve(dir, importPath);
      
      // Try with different extensions
      const extensions = ['.ts', '.tsx', '.js', '.jsx', '/index.ts', '/index.tsx'];
      for (const ext of extensions) {
        const fullPath = resolved.endsWith(ext) ? resolved : resolved + ext;
        if (fs.existsSync(fullPath)) {
          return path.relative(process.cwd(), fullPath);
        }
      }
    }
    
    // Handle alias imports (@/)
    if (importPath.startsWith('@/')) {
      const resolved = importPath.replace('@/', 'src/');
      const extensions = ['.ts', '.tsx', '.js', '.jsx', '/index.ts', '/index.tsx'];
      for (const ext of extensions) {
        const fullPath = resolved + ext;
        if (fs.existsSync(fullPath)) {
          return fullPath;
        }
      }
    }

    return null;
  }

  private reportDeprecatedFiles(): void {
    const deprecated = Array.from(this.fileStatusCache.values())
      .filter(f => f.status === 'DEPRECATED');

    if (deprecated.length === 0) {
      console.log(chalk.green('✅ No deprecated files found\n'));
      return;
    }

    console.log(chalk.yellow(`\n⚠️  Found ${deprecated.length} deprecated files:\n`));

    for (const file of deprecated) {
      console.log(chalk.yellow(`📁 ${file.path}`));
      
      if (file.replacedBy) {
        console.log(`   Replaced by: ${chalk.blue(file.replacedBy)}`);
      }
      
      if (file.deprecationDate) {
        console.log(`   Deprecated: ${file.deprecationDate}`);
      }
      
      if (file.removalDate) {
        const removalDate = new Date(file.removalDate);
        const now = new Date();
        if (removalDate < now) {
          console.log(chalk.red(`   ⏰ OVERDUE for removal (${file.removalDate})`));
        } else {
          console.log(`   Remove after: ${file.removalDate}`);
        }
      }

      if (file.importers.length === 0) {
        console.log(chalk.green('   ✅ Safe to archive (no imports)'));
      } else {
        console.log(chalk.red(`   ❌ Still imported by ${file.importers.length} files:`));
        file.importers.slice(0, 5).forEach(imp => {
          console.log(`      - ${imp}`);
        });
        if (file.importers.length > 5) {
          console.log(`      ... and ${file.importers.length - 5} more`);
        }
      }
      console.log();
    }
  }

  private reportUnusedFiles(): void {
    const unused = Array.from(this.fileStatusCache.values())
      .filter(f => 
        f.status === 'ACTIVE' && 
        f.importers.length === 0 &&
        !f.path.endsWith('index.ts') &&
        !f.path.endsWith('index.tsx') &&
        !f.path.includes('/pages/') &&
        !f.path.includes('/app/')
      );

    if (unused.length === 0) return;

    console.log(chalk.blue(`\n🔍 Potentially unused files (${unused.length}):\n`));
    
    for (const file of unused.slice(0, 10)) {
      console.log(`  - ${file.path}`);
    }
    
    if (unused.length > 10) {
      console.log(`  ... and ${unused.length - 10} more`);
    }
  }

  private reportVersionedFiles(): void {
    const versionPattern = /\.(old|backup|v\d+|new|copy|temp|bak|orig)\.(tsx?|jsx?)$/;
    const versionedFiles = Array.from(this.fileStatusCache.keys())
      .filter(f => versionPattern.test(f));

    if (versionedFiles.length === 0) return;

    console.log(chalk.red(`\n❌ Files with version suffixes (${versionedFiles.length}):\n`));
    
    for (const file of versionedFiles) {
      console.log(`  - ${file}`);
      const baseName = file.replace(versionPattern, '.$2');
      if (fs.existsSync(baseName)) {
        console.log(chalk.gray(`    → Active version exists: ${baseName}`));
      }
    }

    console.log(chalk.yellow('\n💡 Recommendation: Use @file-status headers instead of version suffixes'));
  }

  async findDuplicates(): Promise<void> {
    console.log(chalk.blue('Searching for duplicate files...\n'));
    
    const files = glob.sync('src/**/*.{ts,tsx,js,jsx}', {
      ignore: ['**/node_modules/**', '**/dist/**', '**/*.test.*', '**/*.spec.*']
    });

    const fileHashes = new Map<string, string[]>();

    // Calculate hash for each file
    for (const file of files) {
      const content = fs.readFileSync(file, 'utf-8');
      
      // Normalize content (remove comments and whitespace for comparison)
      const normalized = content
        .replace(/\/\*[\s\S]*?\*\//g, '') // Remove block comments
        .replace(/\/\/.*/g, '')           // Remove line comments
        .replace(/\s+/g, ' ')             // Normalize whitespace
        .trim();

      const hash = createHash('md5').update(normalized).digest('hex');
      
      if (!fileHashes.has(hash)) {
        fileHashes.set(hash, []);
      }
      fileHashes.get(hash)!.push(file);
    }

    // Find groups with duplicates
    const duplicateGroups = Array.from(fileHashes.entries())
      .filter(([, files]) => files.length > 1)
      .map(([hash, files]) => ({ hash, files, sample: files[0] }));

    if (duplicateGroups.length === 0) {
      console.log(chalk.green('✅ No duplicate files found\n'));
      return;
    }

    console.log(chalk.yellow(`⚠️  Found ${duplicateGroups.length} groups of duplicate files:\n`));

    for (const group of duplicateGroups) {
      console.log(chalk.yellow(`Duplicate group (${group.files.length} files):`));
      for (const file of group.files) {
        const status = this.fileStatusCache.get(file);
        const statusLabel = status?.status === 'DEPRECATED' ? ' [DEPRECATED]' : '';
        console.log(`  - ${file}${chalk.red(statusLabel)}`);
      }
      console.log();
    }
  }

  async checkSpecificFile(filePath: string): Promise<void> {
    if (!fs.existsSync(filePath)) {
      console.error(chalk.red(`File not found: ${filePath}`));
      return;
    }

    // Analyze just this file
    this.analyzeFile(filePath);
    
    // Find all files and check imports
    const files = glob.sync('src/**/*.{ts,tsx,js,jsx}', {
      ignore: ['**/node_modules/**', '**/dist/**']
    });

    const importers: string[] = [];
    
    for (const file of files) {
      const content = fs.readFileSync(file, 'utf-8');
      if (content.includes(path.basename(filePath, path.extname(filePath)))) {
        // More thorough check
        this.findImports(file);
        const imports = this.importGraph.get(file);
        if (imports?.has(filePath)) {
          importers.push(file);
        }
      }
    }

    const status = this.fileStatusCache.get(filePath)!;
    
    console.log(chalk.blue(`\nFile Analysis: ${filePath}\n`));
    console.log(`Status: ${status.status}`);
    
    if (status.replacedBy) {
      console.log(`Replaced by: ${status.replacedBy}`);
    }
    
    if (status.exports.length > 0) {
      console.log(`Exports: ${status.exports.join(', ')}`);
    }

    console.log(`\nImported by ${importers.length} files:`);
    
    if (importers.length === 0) {
      console.log(chalk.green('  ✅ Not imported anywhere - safe to remove'));
    } else {
      importers.forEach(imp => {
        console.log(`  - ${imp}`);
      });
    }
  }
}

// Main execution
async function main() {
  const tracker = new FileUsageTracker();
  const args = process.argv.slice(2);

  if (args.includes('--find-duplicates')) {
    await tracker.findDuplicates();
  } else if (args.length > 0 && !args[0].startsWith('--')) {
    // Check specific file
    await tracker.checkSpecificFile(args[0]);
  } else {
    // Analyze entire codebase
    await tracker.analyzeCodebase();
  }
}

main().catch(error => {
  console.error(chalk.red('Error:'), error);
  process.exit(1);
});