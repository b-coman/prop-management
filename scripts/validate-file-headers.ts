#!/usr/bin/env node

/**
 * @fileoverview Validates that file headers match actual code structure
 * @module scripts/validate-file-headers
 * 
 * @description
 * Analyzes project files to ensure headers accurately reflect the code.
 * Checks dependencies, exports, patterns, and relationships. Can be run
 * manually or as part of pre-commit hooks and CI/CD pipeline. Supports
 * both project-wide validation and specific path filtering.
 * 
 * @architecture
 * Location: Development tooling
 * Layer: Build/Development tools
 * Pattern: Static analysis script
 * 
 * @dependencies
 * - Internal: None
 * - External: TypeScript compiler API, glob, chalk
 * 
 * @example
 * ```bash
 * # Validate all project files
 * npm run validate-headers
 * 
 * # Validate specific directory
 * npm run validate-headers -- --path="src/components/booking-v2/**"
 * 
 * # Validate specific file
 * npm run validate-headers -- src/components/booking/BookingForm.tsx
 * ```
 */

import * as ts from 'typescript';
import * as fs from 'fs';
import * as path from 'path';
import * as glob from 'glob';
import chalk from 'chalk';

interface ExtractedHeader {
  fileoverview?: string;
  module?: string;
  description?: string;
  dependencies?: {
    internal?: string[];
    external?: string[];
  };
  relationships?: {
    provides?: string[];
    consumes?: string[];
    usedBy?: string[];
  };
  stateManagement?: boolean;
  pattern?: string;
}

interface CodeAnalysis {
  imports: string[];
  exports: Array<{ name: string; isDefault: boolean }>;
  hasUseState: boolean;
  hasContext: boolean;
  usesHooks: string[];
  pattern: 'Component' | 'Hook' | 'Service' | 'Context' | 'Utility' | 'Unknown';
}

interface ValidationResult {
  file: string;
  errors: string[];
  warnings: string[];
  suggestions: string[];
}

// Extract header information from file content
function extractHeader(content: string): ExtractedHeader {
  const header: ExtractedHeader = {};
  
  // Match the entire header comment
  const headerMatch = content.match(/^\/\*\*([\s\S]*?)\*\//);
  if (!headerMatch) return header;
  
  const headerContent = headerMatch[1];
  
  // Extract specific sections
  const sections = {
    fileoverview: /@fileoverview\s+(.+)/,
    module: /@module\s+(.+)/,
    description: /@description\s+([\s\S]+?)(?=@\w+|$)/,
    pattern: /Pattern:\s*(\w+)/,
  };
  
  for (const [key, regex] of Object.entries(sections)) {
    const match = headerContent.match(regex);
    if (match) {
      header[key as keyof ExtractedHeader] = match[1].trim();
    }
  }
  
  // Extract dependencies
  const depsMatch = headerContent.match(/@dependencies\s+([\s\S]+?)(?=@\w+|$)/);
  if (depsMatch) {
    header.dependencies = {};
    const internalMatch = depsMatch[1].match(/Internal:\s*(.+)/);
    const externalMatch = depsMatch[1].match(/External:\s*(.+)/);
    
    if (internalMatch) {
      header.dependencies.internal = internalMatch[1].split(',').map(d => d.trim());
    }
    if (externalMatch) {
      header.dependencies.external = externalMatch[1].split(',').map(d => d.trim());
    }
  }
  
  // Check for state management section
  header.stateManagement = headerContent.includes('@state-management');
  
  return header;
}

// Analyze TypeScript/React code
function analyzeCode(filePath: string, content: string): CodeAnalysis {
  const analysis: CodeAnalysis = {
    imports: [],
    exports: [],
    hasUseState: false,
    hasContext: false,
    usesHooks: [],
    pattern: 'Unknown'
  };
  
  // Create source file
  const sourceFile = ts.createSourceFile(
    filePath,
    content,
    ts.ScriptTarget.Latest,
    true
  );
  
  // Visit nodes
  ts.forEachChild(sourceFile, visit);
  
  function visit(node: ts.Node) {
    // Check imports
    if (ts.isImportDeclaration(node)) {
      const moduleSpecifier = node.moduleSpecifier as ts.StringLiteral;
      analysis.imports.push(moduleSpecifier.text);
    }
    
    // Check exports
    if (ts.isExportDeclaration(node) || ts.isExportAssignment(node)) {
      analysis.exports.push({ name: 'export', isDefault: false });
    }
    
    if (node.modifiers?.some(m => m.kind === ts.SyntaxKind.ExportKeyword)) {
      if (ts.isFunctionDeclaration(node) || ts.isClassDeclaration(node)) {
        const name = node.name?.getText() || 'unnamed';
        const isDefault = node.modifiers.some(m => m.kind === ts.SyntaxKind.DefaultKeyword);
        analysis.exports.push({ name, isDefault });
      }
    }
    
    // Check for hooks usage
    if (ts.isCallExpression(node)) {
      const expression = node.expression.getText();
      if (expression === 'useState') analysis.hasUseState = true;
      if (expression === 'useContext') analysis.hasContext = true;
      if (expression.startsWith('use')) {
        analysis.usesHooks.push(expression);
      }
    }
    
    ts.forEachChild(node, visit);
  }
  
  // Determine pattern
  const fileName = path.basename(filePath);
  if (fileName.includes('Context')) analysis.pattern = 'Context';
  else if (fileName.startsWith('use')) analysis.pattern = 'Hook';
  else if (fileName.includes('Service')) analysis.pattern = 'Service';
  else if (analysis.exports.some(e => e.name.match(/^[A-Z]/))) analysis.pattern = 'Component';
  else analysis.pattern = 'Utility';
  
  return analysis;
}

// Validate a single file
function validateFile(filePath: string): ValidationResult {
  const result: ValidationResult = {
    file: filePath,
    errors: [],
    warnings: [],
    suggestions: []
  };
  
  const content = fs.readFileSync(filePath, 'utf-8');
  const header = extractHeader(content);
  const analysis = analyzeCode(filePath, content);
  
  // Check if header exists
  if (!header.fileoverview) {
    result.errors.push('Missing @fileoverview in header');
  }
  
  if (!header.module) {
    result.errors.push('Missing @module in header');
  } else {
    // Check if module path matches file path
    const expectedModule = filePath
      .replace(/.*\/src\//, '')
      .replace(/\.(ts|tsx)$/, '')
      .replace(/\\/g, '/');
    
    if (!expectedModule.includes(header.module) && !header.module.includes(path.basename(filePath, path.extname(filePath)))) {
      result.warnings.push(`Module path mismatch: "${header.module}" vs actual path`);
    }
  }
  
  // Check dependencies
  if (header.dependencies?.external) {
    const externalImports = analysis.imports.filter(imp => 
      !imp.startsWith('.') && !imp.startsWith('@/')
    );
    
    const missingDeps = externalImports.filter(imp => 
      !header.dependencies!.external!.some(dep => imp.includes(dep))
    );
    
    if (missingDeps.length > 0) {
      result.suggestions.push(`Add to external dependencies: ${missingDeps.join(', ')}`);
    }
  }
  
  // Check pattern
  if (header.pattern && header.pattern !== analysis.pattern && analysis.pattern !== 'Unknown') {
    result.suggestions.push(`Pattern might be "${analysis.pattern}" instead of "${header.pattern}"`);
  }
  
  // Check state management
  if (analysis.hasUseState && !header.stateManagement) {
    result.suggestions.push('Add @state-management section - component uses useState');
  }
  
  if (analysis.hasContext && !header.relationships?.consumes?.includes('Context')) {
    result.suggestions.push('Add Context consumption to @relationships');
  }
  
  // Check for React hooks
  const customHooks = analysis.usesHooks.filter(h => 
    !['useState', 'useEffect', 'useContext', 'useReducer', 'useCallback', 'useMemo'].includes(h)
  );
  
  if (customHooks.length > 0 && header.dependencies?.internal) {
    const missingHooks = customHooks.filter(hook =>
      !header.dependencies!.internal!.some(dep => dep.includes(hook))
    );
    
    if (missingHooks.length > 0) {
      result.suggestions.push(`Add custom hooks to dependencies: ${missingHooks.join(', ')}`);
    }
  }
  
  return result;
}

// Main validation function
async function validateHeaders(): Promise<void> {
  const args = process.argv.slice(2);
  let files: string[];
  let pattern = 'src/**/*.{ts,tsx}';
  
  // Check for path flag
  const pathArg = args.find(arg => arg.startsWith('--path='));
  if (pathArg) {
    pattern = pathArg.replace('--path=', '');
    args.splice(args.indexOf(pathArg), 1);
  }
  
  if (args.length > 0) {
    // Validate specific files
    files = args;
  } else {
    // Validate based on pattern
    files = glob.sync(pattern, {
      cwd: process.cwd(),
      absolute: false,
      ignore: [
        '**/node_modules/**',
        '**/dist/**',
        '**/build/**',
        '**/*.test.{ts,tsx}',
        '**/*.spec.{ts,tsx}',
        '**/scripts/**',
        '**/archive/**'
      ]
    });
  }
  
  console.log(chalk.blue(`\nValidating ${files.length} file(s)...\n`));
  
  let hasErrors = false;
  let totalErrors = 0;
  let totalWarnings = 0;
  let totalSuggestions = 0;
  
  for (const file of files) {
    const result = validateFile(file);
    
    if (result.errors.length > 0 || result.warnings.length > 0 || result.suggestions.length > 0) {
      console.log(chalk.bold(`\n${file}:`));
      
      result.errors.forEach(error => {
        console.log(chalk.red(`  ❌ ERROR: ${error}`));
        hasErrors = true;
        totalErrors++;
      });
      
      result.warnings.forEach(warning => {
        console.log(chalk.yellow(`  ⚠️  WARN: ${warning}`));
        totalWarnings++;
      });
      
      result.suggestions.forEach(suggestion => {
        console.log(chalk.cyan(`  💡 SUGGEST: ${suggestion}`));
        totalSuggestions++;
      });
    }
  }
  
  // Summary
  console.log(chalk.bold('\n📊 Summary:'));
  console.log(`  Files checked: ${files.length}`);
  console.log(`  Errors: ${totalErrors}`);
  console.log(`  Warnings: ${totalWarnings}`);
  console.log(`  Suggestions: ${totalSuggestions}`);
  
  if (hasErrors) {
    console.log(chalk.red('\n❌ Validation failed! Fix errors before committing.\n'));
    process.exit(1);
  } else if (totalWarnings > 0) {
    console.log(chalk.yellow('\n⚠️  Validation passed with warnings.\n'));
  } else {
    console.log(chalk.green('\n✅ All headers are valid!\n'));
  }
}

// Run validation
validateHeaders().catch(error => {
  console.error(chalk.red('Validation script error:'), error);
  process.exit(1);
});