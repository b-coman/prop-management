#!/usr/bin/env node

/**
 * @fileoverview Analyzes v2 imports and tracks all dependencies
 * @module scripts/track-v2-dependencies
 * 
 * @description
 * Recursively analyzes all booking-v2 files to find their dependencies.
 * Marks shared files with @v2-dependency headers and generates reports
 * showing what's used by v2 vs what's legacy code.
 * 
 * @architecture
 * Location: Development tooling
 * Layer: Build/Development tools
 * Pattern: Static analysis tool
 * 
 * @example
 * ```bash
 * # Track all v2 dependencies
 * npm run track-v2-deps
 * 
 * # Update headers automatically
 * npm run track-v2-deps -- --update-headers
 * 
 * # Check specific file
 * npm run track-v2-deps -- --check src/services/availabilityService.ts
 * ```
 */

import * as ts from 'typescript';
import * as fs from 'fs';
import * as path from 'path';
import * as glob from 'glob';
import chalk from 'chalk';

interface V2Dependency {
  path: string;
  usage: string[];
  importedBy: string[];
  isCore: boolean;
  hasV2Header: boolean;
}

interface V2Report {
  timestamp: Date;
  core: string[];
  shared: V2Dependency[];
  notUsedByV2: string[];
  statistics: {
    totalFiles: number;
    v2CoreFiles: number;
    sharedFiles: number;
    legacyFiles: number;
  };
}

class V2DependencyTracker {
  private dependencies = new Map<string, V2Dependency>();
  private allProjectFiles = new Set<string>();
  private v2CoreFiles = new Set<string>();
  private processedImports = new Set<string>();

  async analyze(updateHeaders: boolean = false): Promise<V2Report> {
    console.log(chalk.blue('🔍 Analyzing v2 dependencies...\n'));

    // Get all project files
    this.findAllProjectFiles();

    // Find all v2 core files
    this.findV2CoreFiles();

    // Analyze dependencies recursively
    for (const coreFile of this.v2CoreFiles) {
      await this.analyzeDependencies(coreFile, []);
    }

    // Generate report
    const report = this.generateReport();

    // Update headers if requested
    if (updateHeaders) {
      await this.updateHeaders();
    }

    // Print report
    this.printReport(report);

    // Save report
    this.saveReport(report);

    return report;
  }

  private findAllProjectFiles(): void {
    const files = glob.sync('src/**/*.{ts,tsx,js,jsx}', {
      ignore: [
        '**/node_modules/**',
        '**/dist/**',
        '**/build/**',
        '**/*.test.*',
        '**/*.spec.*'
      ]
    });

    files.forEach(file => this.allProjectFiles.add(file));
  }

  private findV2CoreFiles(): void {
    const v2Files = glob.sync('src/components/booking-v2/**/*.{ts,tsx}', {
      ignore: ['**/*.test.*', '**/*.spec.*']
    });

    v2Files.forEach(file => {
      this.v2CoreFiles.add(file);
      this.dependencies.set(file, {
        path: file,
        usage: ['CORE v2 component'],
        importedBy: [],
        isCore: true,
        hasV2Header: true
      });
    });

    console.log(chalk.green(`Found ${v2Files.length} v2 core files\n`));
  }

  private async analyzeDependencies(
    filePath: string,
    importChain: string[]
  ): Promise<void> {
    // Prevent circular dependencies
    if (this.processedImports.has(filePath)) {
      return;
    }
    this.processedImports.add(filePath);

    const content = fs.readFileSync(filePath, 'utf-8');
    const imports = this.extractImports(filePath, content);

    for (const importPath of imports) {
      if (!this.allProjectFiles.has(importPath)) {
        continue; // Skip external dependencies
      }

      // Update dependency info
      if (!this.dependencies.has(importPath)) {
        this.dependencies.set(importPath, {
          path: importPath,
          usage: [],
          importedBy: [],
          isCore: false,
          hasV2Header: this.checkV2Header(importPath)
        });
      }

      const dep = this.dependencies.get(importPath)!;
      dep.importedBy.push(filePath);

      // Determine usage type
      const usage = this.determineUsage(importPath, filePath);
      if (!dep.usage.includes(usage)) {
        dep.usage.push(usage);
      }

      // Recursively analyze
      await this.analyzeDependencies(importPath, [...importChain, filePath]);
    }
  }

  private extractImports(filePath: string, content: string): string[] {
    const imports: string[] = [];
    const sourceFile = ts.createSourceFile(
      filePath,
      content,
      ts.ScriptTarget.Latest,
      true
    );

    const visit = (node: ts.Node): void => {
      if (ts.isImportDeclaration(node)) {
        const moduleSpecifier = node.moduleSpecifier;
        if (ts.isStringLiteral(moduleSpecifier)) {
          const resolvedPath = this.resolveImportPath(filePath, moduleSpecifier.text);
          if (resolvedPath) {
            imports.push(resolvedPath);
          }
        }
      }
      ts.forEachChild(node, visit);
    };

    visit(sourceFile);
    return imports;
  }

  private resolveImportPath(fromFile: string, importPath: string): string | null {
    // Handle relative imports
    if (importPath.startsWith('.')) {
      const dir = path.dirname(fromFile);
      const resolved = path.resolve(dir, importPath);
      
      const extensions = ['.ts', '.tsx', '.js', '.jsx', '/index.ts', '/index.tsx'];
      for (const ext of extensions) {
        const fullPath = resolved.endsWith('.ts') || resolved.endsWith('.tsx') || resolved.endsWith('.js') || resolved.endsWith('.jsx') 
          ? resolved 
          : resolved + ext;
        if (fs.existsSync(fullPath)) {
          return path.relative(process.cwd(), fullPath);
        }
      }
    }
    
    // Handle alias imports
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

  private checkV2Header(filePath: string): boolean {
    const content = fs.readFileSync(filePath, 'utf-8');
    return content.includes('@v2-dependency:') || content.includes('@v2-role:');
  }

  private determineUsage(importPath: string, importedBy: string): string {
    const fileName = path.basename(importPath);
    const dir = path.dirname(importPath);

    if (dir.includes('services')) return 'Service/API layer';
    if (dir.includes('components/ui')) return 'UI component';
    if (dir.includes('hooks')) return 'Custom hook';
    if (dir.includes('lib')) return 'Utility/Library';
    if (dir.includes('contexts')) return 'Context/State';
    if (dir.includes('types')) return 'Type definitions';
    if (fileName.includes('utils')) return 'Utility functions';
    
    return 'General dependency';
  }

  private generateReport(): V2Report {
    const core = Array.from(this.v2CoreFiles);
    const shared = Array.from(this.dependencies.values())
      .filter(dep => !dep.isCore && dep.importedBy.length > 0);
    
    const usedByV2 = new Set([...core, ...shared.map(s => s.path)]);
    const notUsedByV2 = Array.from(this.allProjectFiles)
      .filter(file => !usedByV2.has(file) && file.includes('booking'));

    return {
      timestamp: new Date(),
      core,
      shared,
      notUsedByV2,
      statistics: {
        totalFiles: this.allProjectFiles.size,
        v2CoreFiles: core.length,
        sharedFiles: shared.length,
        legacyFiles: notUsedByV2.length
      }
    };
  }

  private async updateHeaders(): Promise<void> {
    console.log(chalk.blue('\n📝 Updating headers...\n'));

    for (const [filePath, dep] of this.dependencies) {
      if (dep.isCore || dep.hasV2Header) {
        continue; // Skip core files and files already marked
      }

      const content = fs.readFileSync(filePath, 'utf-8');
      
      // Check if file has a header
      const headerMatch = content.match(/^\/\*\*([\s\S]*?)\*\//);
      
      if (headerMatch) {
        // Add v2 dependency info to existing header
        const header = headerMatch[0];
        const updatedHeader = header.replace(
          ' */',
          ` * \n * @v2-dependency: ACTIVE\n * @v2-usage: ${dep.usage.join(', ')}\n * @v2-first-used: ${new Date().toISOString().split('T')[0]}\n */`
        );
        
        const updatedContent = content.replace(header, updatedHeader);
        fs.writeFileSync(filePath, updatedContent);
        console.log(chalk.green(`✅ Updated: ${filePath}`));
      } else {
        console.log(chalk.yellow(`⚠️  No header found: ${filePath}`));
      }
    }
  }

  private printReport(report: V2Report): void {
    console.log(chalk.bold('\n📊 V2 Dependency Report\n'));

    console.log(chalk.blue('Statistics:'));
    console.log(`  Total project files: ${report.statistics.totalFiles}`);
    console.log(`  V2 core files: ${report.statistics.v2CoreFiles}`);
    console.log(`  Shared dependencies: ${report.statistics.sharedFiles}`);
    console.log(`  Legacy files (booking-related): ${report.statistics.legacyFiles}`);

    console.log(chalk.green('\n✅ V2 Core Files:'));
    report.core.slice(0, 5).forEach(file => {
      console.log(`  ${file}`);
    });
    if (report.core.length > 5) {
      console.log(`  ... and ${report.core.length - 5} more`);
    }

    console.log(chalk.yellow('\n🔗 Shared Dependencies (used by v2):'));
    const byCategory = new Map<string, V2Dependency[]>();
    
    report.shared.forEach(dep => {
      const category = dep.usage[0] || 'Other';
      if (!byCategory.has(category)) {
        byCategory.set(category, []);
      }
      byCategory.get(category)!.push(dep);
    });

    for (const [category, deps] of byCategory) {
      console.log(`\n  ${chalk.bold(category)}:`);
      deps.slice(0, 3).forEach(dep => {
        console.log(`    ${dep.path}`);
        console.log(chalk.gray(`      Used by: ${dep.importedBy.length} v2 files`));
      });
      if (deps.length > 3) {
        console.log(`    ... and ${deps.length - 3} more`);
      }
    }

    console.log(chalk.red('\n❌ Legacy Files (not used by v2):'));
    report.notUsedByV2.slice(0, 10).forEach(file => {
      console.log(`  ${file}`);
    });
    if (report.notUsedByV2.length > 10) {
      console.log(`  ... and ${report.notUsedByV2.length - 10} more`);
    }

    console.log(chalk.gray('\n💾 Full report saved to: v2-dependency-report.json\n'));
  }

  private saveReport(report: V2Report): void {
    // Save detailed report
    fs.writeFileSync(
      'v2-dependency-report.json',
      JSON.stringify(report, null, 2)
    );

    // Save simple list for easy checking
    const v2FilesList = [
      ...report.core,
      ...report.shared.map(s => s.path)
    ].sort();

    fs.writeFileSync(
      '.v2-files.json',
      JSON.stringify(v2FilesList, null, 2)
    );
  }

  async checkFile(filePath: string): Promise<void> {
    if (!fs.existsSync(filePath)) {
      console.error(chalk.red(`File not found: ${filePath}`));
      return;
    }

    // Run analysis first
    await this.analyze(false);

    // Check if file is used by v2
    const dep = this.dependencies.get(filePath);
    
    console.log(chalk.blue(`\n📄 File: ${filePath}\n`));

    if (dep) {
      console.log(chalk.green('✅ Used by v2'));
      console.log(`Usage: ${dep.usage.join(', ')}`);
      console.log(`Imported by ${dep.importedBy.length} v2 files:`);
      dep.importedBy.slice(0, 5).forEach(imp => {
        console.log(`  - ${imp}`);
      });
      if (dep.importedBy.length > 5) {
        console.log(`  ... and ${dep.importedBy.length - 5} more`);
      }
    } else {
      console.log(chalk.red('❌ Not used by v2'));
      console.log('This file can be safely removed after v2 migration');
    }
  }
}

// Main execution
async function main() {
  const tracker = new V2DependencyTracker();
  const args = process.argv.slice(2);

  if (args.includes('--update-headers')) {
    await tracker.analyze(true);
  } else if (args.includes('--check') && args.length > 1) {
    const fileIndex = args.indexOf('--check') + 1;
    await tracker.checkFile(args[fileIndex]);
  } else {
    await tracker.analyze(false);
  }
}

main().catch(error => {
  console.error(chalk.red('Error:'), error);
  process.exit(1);
});