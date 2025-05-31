#!/usr/bin/env node

/**
 * @fileoverview Analyzes codebase to identify and classify legacy code
 * @module scripts/analyze-legacy-code
 * 
 * @description
 * Scans the codebase to identify legacy patterns, missing headers, technical debt,
 * and code health issues. Generates reports and tracks progress over time.
 * Helps prioritize modernization efforts and prevent legacy code from spreading.
 * 
 * @architecture
 * Location: Development tooling
 * Layer: Build/Development tools
 * Pattern: Static analysis tool
 * 
 * @example
 * ```bash
 * # Analyze entire codebase
 * npm run analyze-legacy
 * 
 * # Analyze specific directory
 * npm run analyze-legacy -- --path="src/components"
 * 
 * # Generate detailed report
 * npm run analyze-legacy -- --detailed
 * ```
 */

import * as ts from 'typescript';
import * as fs from 'fs';
import * as path from 'path';
import * as glob from 'glob';
import chalk from 'chalk';

type HealthStatus = 'HEALTHY' | 'STABLE' | 'OUTDATED' | 'PROBLEMATIC' | 'CRITICAL';
type IssueSeverity = 'low' | 'medium' | 'high' | 'critical';

interface CodeIssue {
  type: string;
  severity: IssueSeverity;
  message: string;
  line?: number;
}

interface FileAnalysis {
  file: string;
  health: HealthStatus;
  issues: CodeIssue[];
  hasHeader: boolean;
  hasTests: boolean;
  isTypeScript: boolean;
  lastModified: Date;
  linesOfCode: number;
  complexity: number;
  dependencies: string[];
  legacyMarkers: string[];
}

interface LegacyReport {
  timestamp: Date;
  totalFiles: number;
  analyzedFiles: number;
  healthDistribution: Record<HealthStatus, number>;
  commonIssues: Record<string, number>;
  criticalFiles: FileAnalysis[];
  recentImprovements: FileAnalysis[];
  recommendations: string[];
}

class LegacyAnalyzer {
  private readonly issueWeights: Record<string, IssueSeverity> = {
    'no-header': 'medium',
    'console-log': 'low',
    'no-typescript': 'medium',
    'circular-dependency': 'critical',
    'no-tests': 'high',
    'complex-function': 'high',
    'hardcoded-values': 'medium',
    'deprecated-pattern': 'high',
    'no-error-handling': 'high',
    'memory-leak-risk': 'critical',
    'direct-dom': 'high',
    'class-component': 'low',
    'callback-hell': 'high',
    'no-types': 'medium',
    'todo-hack-fixme': 'low'
  };

  analyzeFile(filePath: string): FileAnalysis {
    const content = fs.readFileSync(filePath, 'utf-8');
    const stats = fs.statSync(filePath);
    
    const analysis: FileAnalysis = {
      file: filePath,
      health: 'HEALTHY',
      issues: [],
      hasHeader: false,
      hasTests: false,
      isTypeScript: filePath.endsWith('.ts') || filePath.endsWith('.tsx'),
      lastModified: stats.mtime,
      linesOfCode: content.split('\n').length,
      complexity: 0,
      dependencies: [],
      legacyMarkers: []
    };

    // Check for header
    analysis.hasHeader = this.checkHeader(content);
    if (!analysis.hasHeader) {
      analysis.issues.push({
        type: 'no-header',
        severity: 'medium',
        message: 'Missing file header documentation'
      });
    }

    // Check for legacy markers in header
    const legacyStatus = content.match(/@legacy-status:\s*(\w+)/);
    if (legacyStatus) {
      analysis.legacyMarkers.push(legacyStatus[1]);
    }

    // Analyze code patterns
    this.analyzePatterns(content, analysis);
    
    // Analyze TypeScript/JavaScript specifics
    if (analysis.isTypeScript) {
      this.analyzeTypeScript(filePath, content, analysis);
    } else {
      analysis.issues.push({
        type: 'no-typescript',
        severity: 'medium',
        message: 'File is not TypeScript'
      });
    }

    // Calculate health status
    analysis.health = this.calculateHealth(analysis);

    return analysis;
  }

  private checkHeader(content: string): boolean {
    return content.includes('@fileoverview') && content.includes('@module');
  }

  private analyzePatterns(content: string, analysis: FileAnalysis): void {
    // Check for console.log
    const consoleLogCount = (content.match(/console\.(log|error|warn|info)/g) || []).length;
    if (consoleLogCount > 0) {
      analysis.issues.push({
        type: 'console-log',
        severity: 'low',
        message: `Found ${consoleLogCount} console statements`
      });
    }

    // Check for hardcoded values
    const hardcodedUrls = (content.match(/['"]https?:\/\/(?!localhost|127\.0\.0\.1)/g) || []).length;
    const hardcodedApiKeys = (content.match(/['"][A-Za-z0-9]{20,}['"]/g) || []).length;
    if (hardcodedUrls > 0 || hardcodedApiKeys > 0) {
      analysis.issues.push({
        type: 'hardcoded-values',
        severity: 'medium',
        message: 'Possible hardcoded values detected'
      });
    }

    // Check for TODO/HACK/FIXME
    const todoCount = (content.match(/\/\/\s*(TODO|HACK|FIXME|XXX)/gi) || []).length;
    if (todoCount > 0) {
      analysis.issues.push({
        type: 'todo-hack-fixme',
        severity: 'low',
        message: `Found ${todoCount} TODO/HACK/FIXME comments`
      });
    }

    // Check for callback hell
    const callbackNesting = this.detectCallbackHell(content);
    if (callbackNesting > 3) {
      analysis.issues.push({
        type: 'callback-hell',
        severity: 'high',
        message: `Deeply nested callbacks detected (depth: ${callbackNesting})`
      });
    }

    // Check for error handling
    const tryCount = (content.match(/\btry\s*{/g) || []).length;
    const catchCount = (content.match(/\bcatch\s*\(/g) || []).length;
    const throwCount = (content.match(/\bthrow\s/g) || []).length;
    const promiseCatchCount = (content.match(/\.catch\(/g) || []).length;
    
    if (tryCount === 0 && catchCount === 0 && promiseCatchCount === 0 && content.includes('async')) {
      analysis.issues.push({
        type: 'no-error-handling',
        severity: 'high',
        message: 'Async code without error handling'
      });
    }

    // Check for React class components
    if (content.includes('extends Component') || content.includes('extends React.Component')) {
      analysis.issues.push({
        type: 'class-component',
        severity: 'low',
        message: 'Uses class components instead of functional'
      });
    }

    // Check for direct DOM manipulation
    const domManipulation = (content.match(/document\.(getElementById|querySelector|getElementsBy)/g) || []).length;
    if (domManipulation > 0) {
      analysis.issues.push({
        type: 'direct-dom',
        severity: 'high',
        message: 'Direct DOM manipulation detected'
      });
    }
  }

  private analyzeTypeScript(filePath: string, content: string, analysis: FileAnalysis): void {
    try {
      const sourceFile = ts.createSourceFile(
        filePath,
        content,
        ts.ScriptTarget.Latest,
        true
      );

      let functionCount = 0;
      let maxComplexity = 0;
      let hasAnyType = false;

      const visit = (node: ts.Node): void => {
        // Count functions and analyze complexity
        if (ts.isFunctionDeclaration(node) || ts.isFunctionExpression(node) || ts.isArrowFunction(node)) {
          functionCount++;
          const complexity = this.calculateCyclomaticComplexity(node);
          maxComplexity = Math.max(maxComplexity, complexity);
          
          if (complexity > 10) {
            analysis.issues.push({
              type: 'complex-function',
              severity: 'high',
              message: `Function with high complexity (${complexity})`
            });
          }
        }

        // Check for 'any' type
        if (ts.isAnyKeyword(node)) {
          hasAnyType = true;
        }

        // Extract imports (dependencies)
        if (ts.isImportDeclaration(node)) {
          const moduleSpecifier = node.moduleSpecifier;
          if (ts.isStringLiteral(moduleSpecifier)) {
            analysis.dependencies.push(moduleSpecifier.text);
          }
        }

        ts.forEachChild(node, visit);
      };

      visit(sourceFile);

      analysis.complexity = maxComplexity;

      if (hasAnyType) {
        analysis.issues.push({
          type: 'no-types',
          severity: 'medium',
          message: 'Uses "any" type'
        });
      }

      // Check for circular dependencies (simplified)
      if (this.hasCircularDependency(filePath, analysis.dependencies)) {
        analysis.issues.push({
          type: 'circular-dependency',
          severity: 'critical',
          message: 'Possible circular dependency detected'
        });
      }

    } catch (error) {
      console.error(`Error analyzing TypeScript file ${filePath}:`, error);
    }
  }

  private calculateCyclomaticComplexity(node: ts.Node): number {
    let complexity = 1;

    const visit = (n: ts.Node): void => {
      switch (n.kind) {
        case ts.SyntaxKind.IfStatement:
        case ts.SyntaxKind.ConditionalExpression:
        case ts.SyntaxKind.CaseClause:
        case ts.SyntaxKind.CatchClause:
        case ts.SyntaxKind.ConditionalType:
        case ts.SyntaxKind.WhileStatement:
        case ts.SyntaxKind.DoStatement:
        case ts.SyntaxKind.ForStatement:
        case ts.SyntaxKind.ForInStatement:
        case ts.SyntaxKind.ForOfStatement:
          complexity++;
          break;
        case ts.SyntaxKind.BinaryExpression:
          const op = (n as ts.BinaryExpression).operatorToken.kind;
          if (op === ts.SyntaxKind.AmpersandAmpersandToken || op === ts.SyntaxKind.BarBarToken) {
            complexity++;
          }
          break;
      }
      ts.forEachChild(n, visit);
    };

    visit(node);
    return complexity;
  }

  private detectCallbackHell(content: string): number {
    const lines = content.split('\n');
    let maxNesting = 0;
    let currentNesting = 0;

    for (const line of lines) {
      const openCallbacks = (line.match(/function\s*\(|=>\s*{|\(\s*\w*\s*\)\s*=>/g) || []).length;
      const closeCallbacks = (line.match(/}\s*\)/g) || []).length;
      
      currentNesting += openCallbacks - closeCallbacks;
      maxNesting = Math.max(maxNesting, currentNesting);
    }

    return maxNesting;
  }

  private hasCircularDependency(filePath: string, dependencies: string[]): boolean {
    // Simplified check - in real implementation, would need full dependency graph
    const fileName = path.basename(filePath, path.extname(filePath));
    return dependencies.some(dep => dep.includes(fileName));
  }

  private calculateHealth(analysis: FileAnalysis): HealthStatus {
    const severityScore = {
      'low': 1,
      'medium': 2,
      'high': 5,
      'critical': 10
    };

    let totalScore = 0;
    for (const issue of analysis.issues) {
      totalScore += severityScore[issue.severity];
    }

    // Factor in age of file
    const fileAgeMonths = (Date.now() - analysis.lastModified.getTime()) / (1000 * 60 * 60 * 24 * 30);
    if (fileAgeMonths > 12 && !analysis.hasHeader) {
      totalScore += 5;
    }

    // Determine health status
    if (totalScore === 0) return 'HEALTHY';
    if (totalScore <= 3) return 'STABLE';
    if (totalScore <= 10) return 'OUTDATED';
    if (totalScore <= 20) return 'PROBLEMATIC';
    return 'CRITICAL';
  }

  async generateReport(files: string[], detailed: boolean = false): Promise<LegacyReport> {
    const analyses: FileAnalysis[] = [];
    const healthDistribution: Record<HealthStatus, number> = {
      'HEALTHY': 0,
      'STABLE': 0,
      'OUTDATED': 0,
      'PROBLEMATIC': 0,
      'CRITICAL': 0
    };
    const issueCount: Record<string, number> = {};

    console.log(chalk.blue(`\nAnalyzing ${files.length} files...\n`));

    for (const file of files) {
      const analysis = this.analyzeFile(file);
      analyses.push(analysis);
      healthDistribution[analysis.health]++;

      for (const issue of analysis.issues) {
        issueCount[issue.type] = (issueCount[issue.type] || 0) + 1;
      }
    }

    // Sort by health status (worst first)
    const criticalFiles = analyses
      .filter(a => a.health === 'CRITICAL' || a.health === 'PROBLEMATIC')
      .sort((a, b) => b.issues.length - a.issues.length)
      .slice(0, 10);

    // Find recent improvements (files with headers modified recently)
    const recentImprovements = analyses
      .filter(a => a.hasHeader && 
        (Date.now() - a.lastModified.getTime()) < 30 * 24 * 60 * 60 * 1000)
      .slice(0, 5);

    const report: LegacyReport = {
      timestamp: new Date(),
      totalFiles: files.length,
      analyzedFiles: analyses.length,
      healthDistribution,
      commonIssues: issueCount,
      criticalFiles,
      recentImprovements,
      recommendations: this.generateRecommendations(analyses, issueCount)
    };

    this.printReport(report, detailed);
    this.saveReport(report);

    return report;
  }

  private generateRecommendations(analyses: FileAnalysis[], issueCount: Record<string, number>): string[] {
    const recommendations: string[] = [];
    
    const noHeaderCount = analyses.filter(a => !a.hasHeader).length;
    if (noHeaderCount > 10) {
      recommendations.push(`Add headers to ${noHeaderCount} files to improve documentation`);
    }

    if (issueCount['console-log'] > 20) {
      recommendations.push(`Replace ${issueCount['console-log']} console statements with proper logging`);
    }

    if (issueCount['no-typescript'] > 5) {
      recommendations.push(`Convert ${issueCount['no-typescript']} JavaScript files to TypeScript`);
    }

    if (issueCount['circular-dependency'] > 0) {
      recommendations.push(`🚨 Fix ${issueCount['circular-dependency']} circular dependencies immediately`);
    }

    const criticalCount = analyses.filter(a => a.health === 'CRITICAL').length;
    if (criticalCount > 0) {
      recommendations.push(`Prioritize refactoring ${criticalCount} critical files`);
    }

    return recommendations;
  }

  private printReport(report: LegacyReport, detailed: boolean): void {
    console.log(chalk.bold('\n📊 Legacy Code Analysis Report\n'));
    
    console.log(chalk.blue('Health Distribution:'));
    console.log(`  🟢 Healthy: ${report.healthDistribution.HEALTHY}`);
    console.log(`  🟡 Stable: ${report.healthDistribution.STABLE}`);
    console.log(`  🟠 Outdated: ${report.healthDistribution.OUTDATED}`);
    console.log(`  🔴 Problematic: ${report.healthDistribution.PROBLEMATIC}`);
    console.log(`  ⚫ Critical: ${report.healthDistribution.CRITICAL}`);

    console.log(chalk.blue('\nMost Common Issues:'));
    const sortedIssues = Object.entries(report.commonIssues)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 5);
    
    for (const [issue, count] of sortedIssues) {
      console.log(`  - ${issue}: ${count} occurrences`);
    }

    if (report.criticalFiles.length > 0) {
      console.log(chalk.red('\n🚨 Critical Files Requiring Attention:'));
      for (const file of report.criticalFiles.slice(0, 5)) {
        console.log(`  ${file.file}`);
        if (detailed) {
          for (const issue of file.issues.slice(0, 3)) {
            console.log(`    - ${issue.message}`);
          }
        }
      }
    }

    if (report.recentImprovements.length > 0) {
      console.log(chalk.green('\n✅ Recent Improvements:'));
      for (const file of report.recentImprovements) {
        console.log(`  ${file.file} - Now ${file.health}`);
      }
    }

    console.log(chalk.yellow('\n💡 Recommendations:'));
    for (const rec of report.recommendations) {
      console.log(`  - ${rec}`);
    }

    console.log(chalk.gray(`\nFull report saved to: legacy-report.json`));
  }

  private saveReport(report: LegacyReport): void {
    fs.writeFileSync(
      'legacy-report.json',
      JSON.stringify(report, null, 2)
    );

    // Also update the legacy tracker
    const trackerPath = '.legacy-tracker.json';
    let tracker: any = {};
    
    if (fs.existsSync(trackerPath)) {
      tracker = JSON.parse(fs.readFileSync(trackerPath, 'utf-8'));
    }

    tracker.lastAnalysis = report.timestamp;
    tracker.stats = {
      total: report.totalFiles,
      ...report.healthDistribution
    };

    fs.writeFileSync(trackerPath, JSON.stringify(tracker, null, 2));
  }
}

// Main execution
async function main() {
  const analyzer = new LegacyAnalyzer();
  const args = process.argv.slice(2);
  
  let pattern = 'src/**/*.{ts,tsx,js,jsx}';
  let detailed = false;

  // Parse arguments
  const pathArg = args.find(arg => arg.startsWith('--path='));
  if (pathArg) {
    pattern = pathArg.replace('--path=', '') + '/**/*.{ts,tsx,js,jsx}';
  }

  if (args.includes('--detailed')) {
    detailed = true;
  }

  // Get files
  const files = glob.sync(pattern, {
    ignore: [
      '**/node_modules/**',
      '**/dist/**',
      '**/build/**',
      '**/*.test.*',
      '**/*.spec.*',
      '**/scripts/**',
      '**/archive/**'
    ]
  });

  await analyzer.generateReport(files, detailed);
}

main().catch(error => {
  console.error(chalk.red('Error running legacy analysis:'), error);
  process.exit(1);
});