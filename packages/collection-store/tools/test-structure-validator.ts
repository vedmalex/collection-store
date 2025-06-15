#!/usr/bin/env bun

/**
 * Test Structure Validator
 *
 * C8: Test Structure Organizer
 * Validates and enforces module > category > specific_test hierarchy
 */

import { readdir, readFile } from 'fs/promises';
import { join, relative, basename } from 'path';
import * as ts from 'typescript';

// ============================================================================
// INTERFACES AND TYPES
// ============================================================================

interface TestStructureIssue {
  file: string;
  line: number;
  issue: string;
  severity: 'ERROR' | 'WARNING' | 'INFO';
  suggestion: string;
}

interface TestHierarchy {
  module?: string;
  category?: string;
  specificTest?: string;
  depth: number;
  isValid: boolean;
}

interface StructureValidationReport {
  totalFiles: number;
  validFiles: number;
  invalidFiles: number;
  issues: TestStructureIssue[];
  processingTime: number;
}

// ============================================================================
// C8: TEST STRUCTURE ORGANIZER
// ============================================================================

class TestStructureOrganizer {
  private readonly requiredHierarchy = ['module', 'category', 'specific_test'];

  async validateProject(rootPath: string): Promise<StructureValidationReport> {
    console.log('🔍 Validating test structure hierarchy...');
    const startTime = performance.now();

    const testFiles = await this.findTestFiles(rootPath);
    const issues: TestStructureIssue[] = [];
    let validFiles = 0;

    for (const filePath of testFiles) {
      const fileIssues = await this.validateFile(filePath, rootPath);
      issues.push(...fileIssues);

      if (fileIssues.filter(i => i.severity === 'ERROR').length === 0) {
        validFiles++;
      }
    }

    const endTime = performance.now();

    return {
      totalFiles: testFiles.length,
      validFiles,
      invalidFiles: testFiles.length - validFiles,
      issues,
      processingTime: endTime - startTime
    };
  }

  private async findTestFiles(rootPath: string): Promise<string[]> {
    const testFiles: string[] = [];

    const scanDirectory = async (currentPath: string): Promise<void> => {
      try {
        const entries = await readdir(currentPath, { withFileTypes: true });

        for (const entry of entries) {
          const fullPath = join(currentPath, entry.name);

          if (entry.isDirectory()) {
            if (!this.shouldSkipDirectory(entry.name)) {
              await scanDirectory(fullPath);
            }
          } else if (entry.isFile() && this.isTestFile(entry.name)) {
            testFiles.push(fullPath);
          }
        }
      } catch (error) {
        console.warn(`⚠️ Warning: Could not scan directory ${currentPath}: ${error}`);
      }
    };

    await scanDirectory(rootPath);
    return testFiles;
  }

  private shouldSkipDirectory(dirName: string): boolean {
    const skipDirs = ['node_modules', '.git', 'dist', 'build', 'coverage'];
    return skipDirs.includes(dirName);
  }

  private isTestFile(fileName: string): boolean {
    const testPatterns = [
      /\.test\.(ts|tsx|js|jsx)$/,
      /\.spec\.(ts|tsx|js|jsx)$/
    ];
    return testPatterns.some(pattern => pattern.test(fileName));
  }

  private async validateFile(filePath: string, rootPath: string): Promise<TestStructureIssue[]> {
    const issues: TestStructureIssue[] = [];
    const relativePath = relative(rootPath, filePath);

    try {
      const content = await readFile(filePath, 'utf-8');
      const sourceFile = ts.createSourceFile(
        filePath,
        content,
        ts.ScriptTarget.Latest,
        true
      );

      const hierarchy = this.extractTestHierarchy(sourceFile);
      const structureIssues = this.validateHierarchy(hierarchy, relativePath);
      issues.push(...structureIssues);

    } catch (error) {
      issues.push({
        file: relativePath,
        line: 1,
        issue: `Could not parse file: ${error}`,
        severity: 'ERROR',
        suggestion: 'Fix syntax errors in the test file'
      });
    }

    return issues;
  }

  private extractTestHierarchy(sourceFile: ts.SourceFile): TestHierarchy[] {
    const hierarchies: TestHierarchy[] = [];

    const visitNode = (node: ts.Node, depth: number = 0, parentNames: string[] = []): void => {
      if (ts.isCallExpression(node)) {
        const expression = node.expression;

        if (ts.isIdentifier(expression) && expression.text === 'describe') {
          if (node.arguments.length > 0 && ts.isStringLiteral(node.arguments[0])) {
            const describeName = node.arguments[0].text;
            const currentNames = [...parentNames, describeName];

            const hierarchy: TestHierarchy = {
              depth,
              isValid: false
            };

            // Map hierarchy levels
            if (depth === 0) {
              hierarchy.module = describeName;
            } else if (depth === 1) {
              hierarchy.module = currentNames[0];
              hierarchy.category = describeName;
            } else if (depth === 2) {
              hierarchy.module = currentNames[0];
              hierarchy.category = currentNames[1];
              hierarchy.specificTest = describeName;
            }

            // Validate hierarchy
            hierarchy.isValid = this.isValidHierarchy(hierarchy);
            hierarchies.push(hierarchy);

            // Continue with children at increased depth
            node.forEachChild(child => visitNode(child, depth + 1, currentNames));
            return; // Don't visit children again
          }
        }
      }

      // Continue visiting child nodes at same depth
      node.forEachChild(child => visitNode(child, depth, parentNames));
    };

    visitNode(sourceFile);
    return hierarchies;
  }

  private isValidHierarchy(hierarchy: TestHierarchy): boolean {
    // Valid patterns:
    // 1. module only (depth 0)
    // 2. module > category (depth 1)
    // 3. module > category > specific_test (depth 2)

    if (hierarchy.depth === 0) {
      return !!hierarchy.module;
    } else if (hierarchy.depth === 1) {
      return !!(hierarchy.module && hierarchy.category);
    } else if (hierarchy.depth === 2) {
      return !!(hierarchy.module && hierarchy.category && hierarchy.specificTest);
    }

    return false; // Depth > 2 is not allowed
  }

  private validateHierarchy(hierarchies: TestHierarchy[], filePath: string): TestStructureIssue[] {
    const issues: TestStructureIssue[] = [];

    if (hierarchies.length === 0) {
      issues.push({
        file: filePath,
        line: 1,
        issue: 'No describe blocks found',
        severity: 'ERROR',
        suggestion: 'Add describe blocks following module > category > specific_test pattern'
      });
      return issues;
    }

    // Check for proper 3-level hierarchy
    const hasProperHierarchy = hierarchies.some(h =>
      h.depth === 2 && h.module && h.category && h.specificTest
    );

    if (!hasProperHierarchy) {
      issues.push({
        file: filePath,
        line: 1,
        issue: 'Missing required 3-level hierarchy: module > category > specific_test',
        severity: 'ERROR',
        suggestion: 'Organize tests with: describe("module") > describe("category") > it("specific test")'
      });
    }

    // Check for excessive nesting
    const tooDeep = hierarchies.filter(h => h.depth > 2);
    if (tooDeep.length > 0) {
      issues.push({
        file: filePath,
        line: 1,
        issue: `Found ${tooDeep.length} describe blocks with excessive nesting (depth > 2)`,
        severity: 'WARNING',
        suggestion: 'Limit nesting to 3 levels: module > category > specific_test'
      });
    }

    // Check for missing categories
    const moduleOnly = hierarchies.filter(h => h.depth === 0);
    if (moduleOnly.length > 0) {
      issues.push({
        file: filePath,
        line: 1,
        issue: 'Found module-level describe blocks without categories',
        severity: 'WARNING',
        suggestion: 'Add category level: describe("module") > describe("category")'
      });
    }

    // Validate naming conventions
    for (const hierarchy of hierarchies) {
      if (hierarchy.module && !this.isValidModuleName(hierarchy.module)) {
        issues.push({
          file: filePath,
          line: 1,
          issue: `Invalid module name: "${hierarchy.module}"`,
          severity: 'WARNING',
          suggestion: 'Use descriptive module names (e.g., "core", "query", "storage")'
        });
      }

      if (hierarchy.category && !this.isValidCategoryName(hierarchy.category)) {
        issues.push({
          file: filePath,
          line: 1,
          issue: `Invalid category name: "${hierarchy.category}"`,
          severity: 'WARNING',
          suggestion: 'Use descriptive category names (e.g., "performance", "validation", "integration")'
        });
      }
    }

    return issues;
  }

  private isValidModuleName(name: string): boolean {
    // Module names should be descriptive and not too generic
    const invalidNames = ['test', 'tests', 'spec', 'specs'];
    return !invalidNames.includes(name.toLowerCase()) && name.length > 2;
  }

  private isValidCategoryName(name: string): boolean {
    // Category names should describe the type of tests
    const validCategories = [
      'performance', 'validation', 'integration', 'unit', 'api',
      'database', 'storage', 'query', 'transaction', 'security',
      'error-handling', 'edge-cases', 'compatibility', 'regression'
    ];

    // Allow valid categories or descriptive names
    return validCategories.includes(name.toLowerCase()) ||
           (name.length > 3 && !name.toLowerCase().includes('test'));
  }

  generateStructureReport(report: StructureValidationReport): string {
    const lines = [];

    lines.push('# 🏗️ TEST STRUCTURE VALIDATION REPORT');
    lines.push('');
    lines.push(`**Generated:** ${new Date().toISOString()}`);
    lines.push(`**Processing Time:** ${Math.round(report.processingTime)}ms`);
    lines.push('');

    // Summary
    lines.push('## 📊 SUMMARY');
    lines.push('');
    lines.push(`- **Total Files:** ${report.totalFiles}`);
    lines.push(`- **Valid Files:** ${report.validFiles} (${Math.round(report.validFiles / report.totalFiles * 100)}%)`);
    lines.push(`- **Invalid Files:** ${report.invalidFiles} (${Math.round(report.invalidFiles / report.totalFiles * 100)}%)`);
    lines.push(`- **Total Issues:** ${report.issues.length}`);
    lines.push('');

    // Issue breakdown
    const errorCount = report.issues.filter(i => i.severity === 'ERROR').length;
    const warningCount = report.issues.filter(i => i.severity === 'WARNING').length;
    const infoCount = report.issues.filter(i => i.severity === 'INFO').length;

    lines.push('## 🚨 ISSUE BREAKDOWN');
    lines.push('');
    lines.push(`- **Errors:** ${errorCount}`);
    lines.push(`- **Warnings:** ${warningCount}`);
    lines.push(`- **Info:** ${infoCount}`);
    lines.push('');

    // Required structure example
    lines.push('## 📋 REQUIRED STRUCTURE');
    lines.push('');
    lines.push('Tests must follow this 3-level hierarchy:');
    lines.push('');
    lines.push('```typescript');
    lines.push('describe("module", () => {');
    lines.push('  describe("category", () => {');
    lines.push('    it("should perform specific test", () => {');
    lines.push('      // Test implementation');
    lines.push('    });');
    lines.push('  });');
    lines.push('});');
    lines.push('```');
    lines.push('');

    // Examples
    lines.push('### ✅ Good Examples');
    lines.push('');
    lines.push('```typescript');
    lines.push('describe("core", () => {');
    lines.push('  describe("performance", () => {');
    lines.push('    it("should process 1000 files under 5 minutes", () => {});');
    lines.push('  });');
    lines.push('  describe("validation", () => {');
    lines.push('    it("should validate input parameters", () => {});');
    lines.push('  });');
    lines.push('});');
    lines.push('```');
    lines.push('');

    // Detailed issues
    if (report.issues.length > 0) {
      lines.push('## 🔍 DETAILED ISSUES');
      lines.push('');

      // Group issues by file
      const issuesByFile = new Map<string, TestStructureIssue[]>();
      for (const issue of report.issues) {
        if (!issuesByFile.has(issue.file)) {
          issuesByFile.set(issue.file, []);
        }
        issuesByFile.get(issue.file)!.push(issue);
      }

      for (const [file, fileIssues] of issuesByFile) {
        lines.push(`### \`${file}\``);
        lines.push('');

        for (const issue of fileIssues) {
          const icon = issue.severity === 'ERROR' ? '❌' :
                      issue.severity === 'WARNING' ? '⚠️' : 'ℹ️';
          lines.push(`${icon} **${issue.severity}:** ${issue.issue}`);
          lines.push(`   💡 *Suggestion:* ${issue.suggestion}`);
          lines.push('');
        }
      }
    }

    return lines.join('\n');
  }
}

// ============================================================================
// MAIN EXECUTION
// ============================================================================

async function main() {
  console.log('🏗️ Starting Test Structure Validation');
  console.log('📋 Enforcing module > category > specific_test hierarchy');
  console.log('');

  try {
    const organizer = new TestStructureOrganizer();
    const projectRoot = process.cwd();

    const report = await organizer.validateProject(projectRoot);

    // Display results
    console.log('📊 VALIDATION RESULTS');
    console.log('=====================');
    console.log(`Total files: ${report.totalFiles}`);
    console.log(`Valid files: ${report.validFiles} (${Math.round(report.validFiles / report.totalFiles * 100)}%)`);
    console.log(`Invalid files: ${report.invalidFiles} (${Math.round(report.invalidFiles / report.totalFiles * 100)}%)`);
    console.log(`Total issues: ${report.issues.length}`);
    console.log(`Processing time: ${Math.round(report.processingTime)}ms`);
    console.log('');

    // Issue summary
    const errorCount = report.issues.filter(i => i.severity === 'ERROR').length;
    const warningCount = report.issues.filter(i => i.severity === 'WARNING').length;

    if (errorCount > 0) {
      console.log(`❌ ${errorCount} errors found`);
    }
    if (warningCount > 0) {
      console.log(`⚠️ ${warningCount} warnings found`);
    }
    if (errorCount === 0 && warningCount === 0) {
      console.log('✅ All test files follow proper structure!');
    }

    // Generate and save report
    const reportContent = organizer.generateStructureReport(report);
    await Bun.write('test-structure-validation-report.md', reportContent);
    console.log('📄 Detailed report saved: test-structure-validation-report.md');

  } catch (error) {
    console.error('❌ Structure validation error:', error);
    process.exit(1);
  }
}

// Run if called directly
if (import.meta.main) {
  main();
}

export {
  TestStructureOrganizer,
  type TestStructureIssue,
  type StructureValidationReport
};