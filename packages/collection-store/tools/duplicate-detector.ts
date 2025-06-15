#!/usr/bin/env bun

/**
 * Duplicate Test Detection System
 *
 * Enhanced Parallel Processing Architecture with Test Management
 * Implements 9 specialized components for comprehensive duplicate detection
 */

import { readdir, stat, readFile } from 'fs/promises';
import { join, relative, basename, extname } from 'path';
import { createHash } from 'crypto';
import * as ts from 'typescript';

// ============================================================================
// INTERFACES AND TYPES
// ============================================================================

interface TestFileInfo {
  path: string;
  relativePath: string;
  size: number;
  lastModified: Date;
  hash: string;
  basename: string;
}

interface DescribeBlock {
  name: string;
  line: number;
  children: (DescribeBlock | TestBlock)[];
  parent?: DescribeBlock;
}

interface TestBlock {
  name: string;
  line: number;
  type: 'it' | 'test';
}

interface TestStructure {
  describes: DescribeBlock[];
  imports: string[];
  fileSignature: string;
}

interface DuplicateGroup {
  files: TestFileInfo[];
  type: 'EXACT' | 'STRUCTURAL' | 'PARTIAL';
  confidence: number;
  differences: string[];
  reason: string;
}

interface ContentComparison {
  identicalLines: number;
  totalLines: number;
  differences: string[];
  similarity: number;
}

interface RiskAssessment {
  level: 'LOW' | 'MEDIUM' | 'HIGH';
  factors: string[];
  recommendation: 'REMOVE' | 'MERGE' | 'MANUAL_REVIEW';
  confidence: number;
}

interface DetectionReport {
  totalFiles: number;
  duplicateGroups: DuplicateGroup[];
  exactDuplicates: number;
  structuralDuplicates: number;
  partialDuplicates: number;
  processingTime: number;
  riskAssessments: Map<string, RiskAssessment>;
}

// ============================================================================
// C1: TEST FILE SCANNER
// ============================================================================

class TestFileScanner {
  private readonly testPatterns = [
    '**/*.test.ts',
    '**/*.test.tsx',
    '**/*.spec.ts',
    '**/*.spec.tsx'
  ];

  async scanProject(rootPath: string): Promise<TestFileInfo[]> {
    console.log(`🔍 Scanning for test files in: ${rootPath}`);
    const testFiles: TestFileInfo[] = [];

    await this.scanDirectory(rootPath, rootPath, testFiles);

    console.log(`✅ Found ${testFiles.length} test files`);
    return testFiles;
  }

  private async scanDirectory(
    currentPath: string,
    rootPath: string,
    testFiles: TestFileInfo[]
  ): Promise<void> {
    try {
      const entries = await readdir(currentPath, { withFileTypes: true });

      for (const entry of entries) {
        const fullPath = join(currentPath, entry.name);

        if (entry.isDirectory()) {
          // Skip node_modules and other irrelevant directories
          if (!this.shouldSkipDirectory(entry.name)) {
            await this.scanDirectory(fullPath, rootPath, testFiles);
          }
        } else if (entry.isFile() && this.isTestFile(entry.name)) {
          const fileInfo = await this.createTestFileInfo(fullPath, rootPath);
          testFiles.push(fileInfo);
        }
      }
    } catch (error) {
      console.warn(`⚠️ Warning: Could not scan directory ${currentPath}: ${error}`);
    }
  }

  private shouldSkipDirectory(dirName: string): boolean {
    const skipDirs = [
      'node_modules',
      '.git',
      'dist',
      'build',
      'coverage',
      '.next',
      '.nuxt'
    ];
    return skipDirs.includes(dirName);
  }

  private isTestFile(fileName: string): boolean {
    const testPatterns = [
      /\.test\.(ts|tsx|js|jsx)$/,
      /\.spec\.(ts|tsx|js|jsx)$/
    ];
    return testPatterns.some(pattern => pattern.test(fileName));
  }

  private async createTestFileInfo(filePath: string, rootPath: string): Promise<TestFileInfo> {
    const stats = await stat(filePath);
    const content = await readFile(filePath, 'utf-8');
    const hash = createHash('sha256').update(content).digest('hex');

    return {
      path: filePath,
      relativePath: relative(rootPath, filePath),
      size: stats.size,
      lastModified: stats.mtime,
      hash,
      basename: basename(filePath)
    };
  }
}

// ============================================================================
// C2: AST PARSER & STRUCTURE ANALYZER
// ============================================================================

class StructureAnalyzer {
  async parseTestStructure(filePath: string): Promise<TestStructure> {
    try {
      const content = await readFile(filePath, 'utf-8');
      const sourceFile = ts.createSourceFile(
        filePath,
        content,
        ts.ScriptTarget.Latest,
        true
      );

      const describes: DescribeBlock[] = [];
      const imports: string[] = [];

      this.visitNode(sourceFile, describes, imports);

      const fileSignature = this.generateSignature(describes);

      return {
        describes,
        imports,
        fileSignature
      };
    } catch (error) {
      console.warn(`⚠️ Warning: Could not parse ${filePath}: ${error}`);
      return {
        describes: [],
        imports: [],
        fileSignature: ''
      };
    }
  }

  private visitNode(
    node: ts.Node,
    describes: DescribeBlock[],
    imports: string[],
    parent?: DescribeBlock
  ): void {
    if (ts.isCallExpression(node)) {
      const expression = node.expression;

      if (ts.isIdentifier(expression)) {
        const functionName = expression.text;

        if (functionName === 'describe' && node.arguments.length >= 1) {
          const describeBlock = this.parseDescribeBlock(node, parent);
          if (describeBlock) {
            if (parent) {
              parent.children.push(describeBlock);
            } else {
              describes.push(describeBlock);
            }

            // Recursively visit children with this describe as parent
            node.forEachChild(child => {
              this.visitNode(child, describes, imports, describeBlock);
            });
            return; // Don't visit children again
          }
        } else if ((functionName === 'it' || functionName === 'test') && node.arguments.length >= 1) {
          const testBlock = this.parseTestBlock(node, functionName as 'it' | 'test');
          if (testBlock && parent) {
            parent.children.push(testBlock);
          }
        }
      }
    } else if (ts.isImportDeclaration(node)) {
      const importPath = this.extractImportPath(node);
      if (importPath) {
        imports.push(importPath);
      }
    }

    // Continue visiting child nodes
    node.forEachChild(child => {
      this.visitNode(child, describes, imports, parent);
    });
  }

  private parseDescribeBlock(node: ts.CallExpression, parent?: DescribeBlock): DescribeBlock | null {
    if (node.arguments.length === 0) return null;

    const firstArg = node.arguments[0];
    if (!ts.isStringLiteral(firstArg)) return null;

    const sourceFile = node.getSourceFile();
    const lineNumber = sourceFile.getLineAndCharacterOfPosition(node.getStart()).line + 1;

    return {
      name: firstArg.text,
      line: lineNumber,
      children: [],
      parent
    };
  }

  private parseTestBlock(node: ts.CallExpression, type: 'it' | 'test'): TestBlock | null {
    if (node.arguments.length === 0) return null;

    const firstArg = node.arguments[0];
    if (!ts.isStringLiteral(firstArg)) return null;

    const sourceFile = node.getSourceFile();
    const lineNumber = sourceFile.getLineAndCharacterOfPosition(node.getStart()).line + 1;

    return {
      name: firstArg.text,
      line: lineNumber,
      type
    };
  }

  private extractImportPath(node: ts.ImportDeclaration): string | null {
    const moduleSpecifier = node.moduleSpecifier;
    if (ts.isStringLiteral(moduleSpecifier)) {
      return moduleSpecifier.text;
    }
    return null;
  }

  private generateSignature(describes: DescribeBlock[]): string {
    const hierarchy = this.buildHierarchy(describes);
    return createHash('md5').update(JSON.stringify(hierarchy)).digest('hex');
  }

  private buildHierarchy(describes: DescribeBlock[]): any {
    return describes.map(desc => ({
      name: desc.name,
      children: this.buildChildrenHierarchy(desc.children)
    }));
  }

  private buildChildrenHierarchy(children: (DescribeBlock | TestBlock)[]): any {
    return children.map(child => {
      if ('children' in child) {
        // DescribeBlock
        return {
          type: 'describe',
          name: child.name,
          children: this.buildChildrenHierarchy(child.children)
        };
      } else {
        // TestBlock
        return {
          type: child.type,
          name: child.name
        };
      }
    });
  }

  compareStructures(sig1: string, sig2: string): number {
    return sig1 === sig2 ? 1.0 : 0.0;
  }
}

// ============================================================================
// C3: CONTENT ANALYZER
// ============================================================================

class ContentAnalyzer {
  async generateContentHash(filePath: string): Promise<string> {
    const content = await readFile(filePath, 'utf-8');
    return createHash('sha256').update(content).digest('hex');
  }

  async compareContent(file1: string, file2: string): Promise<ContentComparison> {
    const content1 = await readFile(file1, 'utf-8');
    const content2 = await readFile(file2, 'utf-8');

    const lines1 = content1.split('\n');
    const lines2 = content2.split('\n');

    let identicalLines = 0;
    const differences: string[] = [];
    const maxLines = Math.max(lines1.length, lines2.length);

    for (let i = 0; i < maxLines; i++) {
      const line1 = lines1[i] || '';
      const line2 = lines2[i] || '';

      if (line1 === line2) {
        identicalLines++;
      } else {
        differences.push(`Line ${i + 1}: "${line1}" vs "${line2}"`);
      }
    }

    const similarity = identicalLines / maxLines;

    return {
      identicalLines,
      totalLines: maxLines,
      differences: differences.slice(0, 10), // Limit to first 10 differences
      similarity
    };
  }

  calculateSimilarity(comparison: ContentComparison): number {
    return comparison.similarity;
  }
}

// ============================================================================
// C4: DUPLICATE DETECTION ENGINE
// ============================================================================

class DuplicateDetectionEngine {
  constructor(
    private structureAnalyzer: StructureAnalyzer,
    private contentAnalyzer: ContentAnalyzer
  ) {}

  async findDuplicates(files: TestFileInfo[]): Promise<DuplicateGroup[]> {
    console.log(`🔍 Analyzing ${files.length} files for duplicates...`);

    const duplicateGroups: DuplicateGroup[] = [];

    // Step 1: Find exact duplicates by hash
    const exactDuplicates = this.findExactDuplicates(files);
    duplicateGroups.push(...exactDuplicates);

    // Step 2: Find structural duplicates
    const structuralDuplicates = await this.findStructuralDuplicates(files);
    duplicateGroups.push(...structuralDuplicates);

    // Step 3: Find partial duplicates by content similarity
    const partialDuplicates = await this.findPartialDuplicates(files);
    duplicateGroups.push(...partialDuplicates);

    console.log(`✅ Found ${duplicateGroups.length} duplicate groups`);
    return duplicateGroups;
  }

  private findExactDuplicates(files: TestFileInfo[]): DuplicateGroup[] {
    const hashGroups = new Map<string, TestFileInfo[]>();

    // Group files by hash
    for (const file of files) {
      if (!hashGroups.has(file.hash)) {
        hashGroups.set(file.hash, []);
      }
      hashGroups.get(file.hash)!.push(file);
    }

    // Find groups with more than one file (duplicates)
    const duplicateGroups: DuplicateGroup[] = [];
    for (const [hash, groupFiles] of hashGroups) {
      if (groupFiles.length > 1) {
        duplicateGroups.push({
          files: groupFiles,
          type: 'EXACT',
          confidence: 1.0,
          differences: [],
          reason: `Identical file content (hash: ${hash.substring(0, 8)}...)`
        });
      }
    }

    return duplicateGroups;
  }

  private async findStructuralDuplicates(files: TestFileInfo[]): Promise<DuplicateGroup[]> {
    const structureMap = new Map<string, { files: TestFileInfo[], structure: TestStructure }>();

    // Parse structure for each file
    for (const file of files) {
      try {
        const structure = await this.structureAnalyzer.parseTestStructure(file.path);

        if (!structureMap.has(structure.fileSignature)) {
          structureMap.set(structure.fileSignature, { files: [], structure });
        }
        structureMap.get(structure.fileSignature)!.files.push(file);
      } catch (error) {
        console.warn(`⚠️ Could not analyze structure for ${file.relativePath}: ${error}`);
      }
    }

    // Find structural duplicates
    const duplicateGroups: DuplicateGroup[] = [];
    for (const [signature, { files: groupFiles, structure }] of structureMap) {
      if (groupFiles.length > 1) {
        // Check if these are not already exact duplicates
        const hashes = new Set(groupFiles.map(f => f.hash));
        if (hashes.size > 1) { // Different content but same structure
          duplicateGroups.push({
            files: groupFiles,
            type: 'STRUCTURAL',
            confidence: 0.9,
            differences: [`Different content but identical test structure`],
            reason: `Same test structure (${structure.describes.length} describe blocks)`
          });
        }
      }
    }

    return duplicateGroups;
  }

  private async findPartialDuplicates(files: TestFileInfo[]): Promise<DuplicateGroup[]> {
    const duplicateGroups: DuplicateGroup[] = [];
    const processed = new Set<string>();

    // Group files by basename for comparison
    const basenameGroups = new Map<string, TestFileInfo[]>();
    for (const file of files) {
      if (!basenameGroups.has(file.basename)) {
        basenameGroups.set(file.basename, []);
      }
      basenameGroups.get(file.basename)!.push(file);
    }

    // Compare files with same basename
    for (const [basename, groupFiles] of basenameGroups) {
      if (groupFiles.length > 1) {
        for (let i = 0; i < groupFiles.length; i++) {
          for (let j = i + 1; j < groupFiles.length; j++) {
            const file1 = groupFiles[i];
            const file2 = groupFiles[j];
            const pairKey = `${file1.path}:${file2.path}`;

            if (processed.has(pairKey)) continue;
            processed.add(pairKey);

            // Skip if already found as exact or structural duplicate
            if (file1.hash === file2.hash) continue;

            try {
              const comparison = await this.contentAnalyzer.compareContent(file1.path, file2.path);

              if (comparison.similarity > 0.8) { // 80% similarity threshold
                duplicateGroups.push({
                  files: [file1, file2],
                  type: 'PARTIAL',
                  confidence: comparison.similarity,
                  differences: comparison.differences,
                  reason: `${Math.round(comparison.similarity * 100)}% content similarity`
                });
              }
            } catch (error) {
              console.warn(`⚠️ Could not compare ${file1.relativePath} and ${file2.relativePath}: ${error}`);
            }
          }
        }
      }
    }

    return duplicateGroups;
  }

  classifyDuplicates(groups: DuplicateGroup[]): { exact: number, structural: number, partial: number } {
    return {
      exact: groups.filter(g => g.type === 'EXACT').length,
      structural: groups.filter(g => g.type === 'STRUCTURAL').length,
      partial: groups.filter(g => g.type === 'PARTIAL').length
    };
  }
}

// ============================================================================
// MAIN EXECUTION
// ============================================================================

async function main() {
  console.log('🚀 Starting Duplicate Test Detection System');
  console.log('📋 Enhanced Parallel Processing Architecture with Test Management');
  console.log('');

  const startTime = performance.now();

  try {
    // Initialize components
    const scanner = new TestFileScanner();
    const structureAnalyzer = new StructureAnalyzer();
    const contentAnalyzer = new ContentAnalyzer();
    const duplicateEngine = new DuplicateDetectionEngine(structureAnalyzer, contentAnalyzer);

    // Phase 1: Scan for test files
    const projectRoot = process.cwd();
    const testFiles = await scanner.scanProject(projectRoot);

    if (testFiles.length === 0) {
      console.log('❌ No test files found in project');
      return;
    }

    // Phase 2: Detect duplicates
    const duplicateGroups = await duplicateEngine.findDuplicates(testFiles);

    // Phase 3: Generate report
    const endTime = performance.now();
    const processingTime = endTime - startTime;

    const classification = duplicateEngine.classifyDuplicates(duplicateGroups);

    const report: DetectionReport = {
      totalFiles: testFiles.length,
      duplicateGroups,
      exactDuplicates: classification.exact,
      structuralDuplicates: classification.structural,
      partialDuplicates: classification.partial,
      processingTime,
      riskAssessments: new Map()
    };

    // Display results
    console.log('\n📊 DUPLICATE DETECTION RESULTS');
    console.log('================================');
    console.log(`Total test files analyzed: ${report.totalFiles}`);
    console.log(`Processing time: ${Math.round(processingTime)}ms`);
    console.log(`Exact duplicates: ${report.exactDuplicates}`);
    console.log(`Structural duplicates: ${report.structuralDuplicates}`);
    console.log(`Partial duplicates: ${report.partialDuplicates}`);
    console.log('');

    // Display duplicate groups
    if (duplicateGroups.length > 0) {
      console.log('🔍 DETECTED DUPLICATE GROUPS:');
      console.log('');

      duplicateGroups.forEach((group, index) => {
        console.log(`Group ${index + 1}: ${group.type} (${Math.round(group.confidence * 100)}% confidence)`);
        console.log(`Reason: ${group.reason}`);
        group.files.forEach(file => {
          console.log(`  - ${file.relativePath} (${file.size} bytes)`);
        });
        if (group.differences.length > 0) {
          console.log(`  Differences: ${group.differences.slice(0, 3).join(', ')}${group.differences.length > 3 ? '...' : ''}`);
        }
        console.log('');
      });
    } else {
      console.log('✅ No duplicates found!');
    }

    // Save detailed report
    const reportPath = 'duplicate-detection-report.json';
    await Bun.write(reportPath, JSON.stringify(report, null, 2));
    console.log(`📄 Detailed report saved to: ${reportPath}`);

  } catch (error) {
    console.error('❌ Error during duplicate detection:', error);
    process.exit(1);
  }
}

// Run if called directly
if (import.meta.main) {
  main();
}

export {
  TestFileScanner,
  StructureAnalyzer,
  ContentAnalyzer,
  DuplicateDetectionEngine,
  main,
  type TestFileInfo,
  type DuplicateGroup,
  type DetectionReport
};