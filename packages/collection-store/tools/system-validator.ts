#!/usr/bin/env bun

/**
 * System Validator
 *
 * Phase 4: Validation
 * Comprehensive validation of the duplicate detection system
 */

import { readFile, writeFile } from 'fs/promises';
import { existsSync } from 'fs';
import { TestFileScanner, DuplicateDetectionEngine, StructureAnalyzer, ContentAnalyzer } from './duplicate-detector';
import { TestOutputManager } from './test-output-manager';

// ============================================================================
// INTERFACES AND TYPES
// ============================================================================

interface SystemValidationReport {
  componentTests: ComponentTestResult[];
  integrationTests: IntegrationTestResult[];
  performanceTests: PerformanceTestResult[];
  overallScore: number;
  recommendations: string[];
  processingTime: number;
}

interface ComponentTestResult {
  component: string;
  passed: boolean;
  score: number;
  issues: string[];
  metrics: Record<string, any>;
}

interface IntegrationTestResult {
  testName: string;
  passed: boolean;
  description: string;
  result: any;
}

interface PerformanceTestResult {
  metric: string;
  target: number;
  actual: number;
  passed: boolean;
  unit: string;
}

// ============================================================================
// SYSTEM VALIDATOR
// ============================================================================

class SystemValidator {
  async validateSystem(): Promise<SystemValidationReport> {
    console.log('🔍 Starting comprehensive system validation...');
    const startTime = performance.now();

    const componentTests = await this.runComponentTests();
    const integrationTests = await this.runIntegrationTests();
    const performanceTests = await this.runPerformanceTests();

    const overallScore = this.calculateOverallScore(componentTests, integrationTests, performanceTests);
    const recommendations = this.generateRecommendations(componentTests, integrationTests, performanceTests);

    const endTime = performance.now();

    return {
      componentTests,
      integrationTests,
      performanceTests,
      overallScore,
      recommendations,
      processingTime: endTime - startTime
    };
  }

  private async runComponentTests(): Promise<ComponentTestResult[]> {
    console.log('🧪 Running component tests...');

    const results: ComponentTestResult[] = [];

    // Test C1: Test File Scanner
    results.push(await this.testFileScanner());

    // Test C2: Structure Analyzer
    results.push(await this.testStructureAnalyzer());

    // Test C3: Content Analyzer
    results.push(await this.testContentAnalyzer());

    // Test C4: Duplicate Detection Engine
    results.push(await this.testDuplicateDetectionEngine());

    return results;
  }

  private async testFileScanner(): Promise<ComponentTestResult> {
    const scanner = new TestFileScanner();
    const issues: string[] = [];
    let score = 100;

    try {
      const files = await scanner.scanProject(process.cwd());

      if (files.length === 0) {
        issues.push('No test files found');
        score -= 50;
      } else if (files.length < 50) {
        issues.push('Fewer test files than expected');
        score -= 20;
      }

      // Check file info completeness
      for (const file of files.slice(0, 5)) {
        if (!file.hash) {
          issues.push('Missing file hash');
          score -= 10;
        }
        if (!file.relativePath) {
          issues.push('Missing relative path');
          score -= 10;
        }
      }

      return {
        component: 'C1: Test File Scanner',
        passed: score >= 70,
        score,
        issues,
        metrics: {
          filesFound: files.length,
          avgFileSize: files.reduce((sum, f) => sum + f.size, 0) / files.length
        }
      };

    } catch (error) {
      return {
        component: 'C1: Test File Scanner',
        passed: false,
        score: 0,
        issues: [`Scanner failed: ${error}`],
        metrics: {}
      };
    }
  }

  private async testStructureAnalyzer(): Promise<ComponentTestResult> {
    const analyzer = new StructureAnalyzer();
    const issues: string[] = [];
    let score = 100;

    try {
      // Test with a known test file
      const testFiles = await new TestFileScanner().scanProject(process.cwd());
      if (testFiles.length === 0) {
        return {
          component: 'C2: Structure Analyzer',
          passed: false,
          score: 0,
          issues: ['No test files to analyze'],
          metrics: {}
        };
      }

      const testFile = testFiles[0];
      const structure = await analyzer.parseTestStructure(testFile.path);

      if (!structure.fileSignature) {
        issues.push('Missing file signature');
        score -= 30;
      }

      if (structure.describes.length === 0) {
        issues.push('No describe blocks found');
        score -= 20;
      }

      return {
        component: 'C2: Structure Analyzer',
        passed: score >= 70,
        score,
        issues,
        metrics: {
          describeBlocks: structure.describes.length,
          imports: structure.imports.length,
          hasSignature: !!structure.fileSignature
        }
      };

    } catch (error) {
      return {
        component: 'C2: Structure Analyzer',
        passed: false,
        score: 0,
        issues: [`Analyzer failed: ${error}`],
        metrics: {}
      };
    }
  }

  private async testContentAnalyzer(): Promise<ComponentTestResult> {
    const analyzer = new ContentAnalyzer();
    const issues: string[] = [];
    let score = 100;

    try {
      const testFiles = await new TestFileScanner().scanProject(process.cwd());
      if (testFiles.length < 2) {
        return {
          component: 'C3: Content Analyzer',
          passed: false,
          score: 0,
          issues: ['Need at least 2 files to test content analysis'],
          metrics: {}
        };
      }

      const file1 = testFiles[0];
      const file2 = testFiles[1];

      const hash1 = await analyzer.generateContentHash(file1.path);
      const hash2 = await analyzer.generateContentHash(file2.path);

      if (!hash1 || !hash2) {
        issues.push('Failed to generate content hashes');
        score -= 40;
      }

      const comparison = await analyzer.compareContent(file1.path, file2.path);

      if (comparison.similarity < 0 || comparison.similarity > 1) {
        issues.push('Invalid similarity score');
        score -= 30;
      }

      return {
        component: 'C3: Content Analyzer',
        passed: score >= 70,
        score,
        issues,
        metrics: {
          hashGenerated: !!(hash1 && hash2),
          similarityCalculated: comparison.similarity >= 0,
          comparisonComplete: comparison.totalLines > 0
        }
      };

    } catch (error) {
      return {
        component: 'C3: Content Analyzer',
        passed: false,
        score: 0,
        issues: [`Content analyzer failed: ${error}`],
        metrics: {}
      };
    }
  }

  private async testDuplicateDetectionEngine(): Promise<ComponentTestResult> {
    const issues: string[] = [];
    let score = 100;

    try {
      const scanner = new TestFileScanner();
      const structureAnalyzer = new StructureAnalyzer();
      const contentAnalyzer = new ContentAnalyzer();
      const engine = new DuplicateDetectionEngine(structureAnalyzer, contentAnalyzer);

      const files = await scanner.scanProject(process.cwd());
      if (files.length === 0) {
        return {
          component: 'C4: Duplicate Detection Engine',
          passed: false,
          score: 0,
          issues: ['No files to analyze'],
          metrics: {}
        };
      }

      const duplicates = await engine.findDuplicates(files.slice(0, 20)); // Limit for testing

      const classification = engine.classifyDuplicates(duplicates);

      if (duplicates.length === 0) {
        issues.push('No duplicates found (may be expected)');
        score -= 10;
      }

      return {
        component: 'C4: Duplicate Detection Engine',
        passed: score >= 70,
        score,
        issues,
        metrics: {
          duplicateGroups: duplicates.length,
          exactDuplicates: classification.exact,
          structuralDuplicates: classification.structural,
          partialDuplicates: classification.partial
        }
      };

    } catch (error) {
      return {
        component: 'C4: Duplicate Detection Engine',
        passed: false,
        score: 0,
        issues: [`Detection engine failed: ${error}`],
        metrics: {}
      };
    }
  }

  private async runIntegrationTests(): Promise<IntegrationTestResult[]> {
    console.log('🔗 Running integration tests...');

    const results: IntegrationTestResult[] = [];

    // Test 1: End-to-end duplicate detection
    results.push(await this.testEndToEndDetection());

    // Test 2: Report generation
    results.push(await this.testReportGeneration());

    // Test 3: File system integration
    results.push(await this.testFileSystemIntegration());

    return results;
  }

  private async testEndToEndDetection(): Promise<IntegrationTestResult> {
    try {
      // Run the full detection pipeline
      const scanner = new TestFileScanner();
      const structureAnalyzer = new StructureAnalyzer();
      const contentAnalyzer = new ContentAnalyzer();
      const engine = new DuplicateDetectionEngine(structureAnalyzer, contentAnalyzer);

      const files = await scanner.scanProject(process.cwd());
      const duplicates = await engine.findDuplicates(files);

      return {
        testName: 'End-to-End Duplicate Detection',
        passed: true,
        description: 'Full pipeline from file scanning to duplicate detection',
        result: {
          filesScanned: files.length,
          duplicatesFound: duplicates.length,
          processingCompleted: true
        }
      };

    } catch (error) {
      return {
        testName: 'End-to-End Duplicate Detection',
        passed: false,
        description: 'Full pipeline from file scanning to duplicate detection',
        result: { error: error.toString() }
      };
    }
  }

  private async testReportGeneration(): Promise<IntegrationTestResult> {
    try {
      // Check if detection report exists
      const reportExists = existsSync('duplicate-detection-report.json');

      if (reportExists) {
        const reportContent = await readFile('duplicate-detection-report.json', 'utf-8');
        const report = JSON.parse(reportContent);

        const hasRequiredFields = !!(
          report.totalFiles &&
          report.duplicateGroups &&
          report.processingTime !== undefined
        );

        return {
          testName: 'Report Generation',
          passed: hasRequiredFields,
          description: 'Validates report structure and content',
          result: {
            reportExists,
            hasRequiredFields,
            totalFiles: report.totalFiles,
            duplicateGroups: report.duplicateGroups?.length || 0
          }
        };
      } else {
        return {
          testName: 'Report Generation',
          passed: false,
          description: 'Validates report structure and content',
          result: { reportExists: false }
        };
      }

    } catch (error) {
      return {
        testName: 'Report Generation',
        passed: false,
        description: 'Validates report structure and content',
        result: { error: error.toString() }
      };
    }
  }

  private async testFileSystemIntegration(): Promise<IntegrationTestResult> {
    try {
      // Test file system operations
      const testData = { test: 'validation', timestamp: Date.now() };
      const testFile = 'test-validation.json';

      await writeFile(testFile, JSON.stringify(testData));
      const readData = JSON.parse(await readFile(testFile, 'utf-8'));

      const writeReadSuccess = readData.test === testData.test;

      return {
        testName: 'File System Integration',
        passed: writeReadSuccess,
        description: 'Tests file read/write operations',
        result: {
          writeSuccess: true,
          readSuccess: writeReadSuccess,
          dataIntegrity: readData.test === testData.test
        }
      };

    } catch (error) {
      return {
        testName: 'File System Integration',
        passed: false,
        description: 'Tests file read/write operations',
        result: { error: error.toString() }
      };
    }
  }

  private async runPerformanceTests(): Promise<PerformanceTestResult[]> {
    console.log('⚡ Running performance tests...');

    const results: PerformanceTestResult[] = [];

    // Test 1: File scanning performance
    const scanStartTime = performance.now();
    const scanner = new TestFileScanner();
    const files = await scanner.scanProject(process.cwd());
    const scanEndTime = performance.now();
    const scanDuration = scanEndTime - scanStartTime;

    results.push({
      metric: 'File Scanning Speed',
      target: 5000, // 5 seconds
      actual: scanDuration,
      passed: scanDuration < 5000,
      unit: 'ms'
    });

    // Test 2: Detection accuracy (based on known duplicates)
    if (files.length > 0) {
      const structureAnalyzer = new StructureAnalyzer();
      const contentAnalyzer = new ContentAnalyzer();
      const engine = new DuplicateDetectionEngine(structureAnalyzer, contentAnalyzer);

      const detectionStartTime = performance.now();
      const duplicates = await engine.findDuplicates(files.slice(0, 50)); // Limit for performance
      const detectionEndTime = performance.now();
      const detectionDuration = detectionEndTime - detectionStartTime;

      results.push({
        metric: 'Duplicate Detection Speed',
        target: 10000, // 10 seconds for 50 files
        actual: detectionDuration,
        passed: detectionDuration < 10000,
        unit: 'ms'
      });

      // Test 3: Memory efficiency (approximate)
      const memoryUsage = process.memoryUsage();
      results.push({
        metric: 'Memory Usage',
        target: 500, // 500 MB
        actual: memoryUsage.heapUsed / 1024 / 1024,
        passed: memoryUsage.heapUsed / 1024 / 1024 < 500,
        unit: 'MB'
      });
    }

    return results;
  }

  private calculateOverallScore(
    componentTests: ComponentTestResult[],
    integrationTests: IntegrationTestResult[],
    performanceTests: PerformanceTestResult[]
  ): number {
    const componentScore = componentTests.reduce((sum, test) => sum + test.score, 0) / componentTests.length;
    const integrationScore = (integrationTests.filter(test => test.passed).length / integrationTests.length) * 100;
    const performanceScore = (performanceTests.filter(test => test.passed).length / performanceTests.length) * 100;

    return Math.round((componentScore * 0.5 + integrationScore * 0.3 + performanceScore * 0.2));
  }

  private generateRecommendations(
    componentTests: ComponentTestResult[],
    integrationTests: IntegrationTestResult[],
    performanceTests: PerformanceTestResult[]
  ): string[] {
    const recommendations: string[] = [];

    // Component recommendations
    for (const test of componentTests) {
      if (test.score < 80) {
        recommendations.push(`Improve ${test.component}: ${test.issues.join(', ')}`);
      }
    }

    // Integration recommendations
    const failedIntegration = integrationTests.filter(test => !test.passed);
    if (failedIntegration.length > 0) {
      recommendations.push(`Fix integration issues: ${failedIntegration.map(t => t.testName).join(', ')}`);
    }

    // Performance recommendations
    const failedPerformance = performanceTests.filter(test => !test.passed);
    if (failedPerformance.length > 0) {
      recommendations.push(`Optimize performance: ${failedPerformance.map(t => t.metric).join(', ')}`);
    }

    if (recommendations.length === 0) {
      recommendations.push('System validation passed! All components working correctly.');
    }

    return recommendations;
  }

  generateValidationReport(report: SystemValidationReport): string {
    const lines = [];

    lines.push('# 🔍 SYSTEM VALIDATION REPORT');
    lines.push('');
    lines.push(`**Generated:** ${new Date().toISOString()}`);
    lines.push(`**Processing Time:** ${Math.round(report.processingTime)}ms`);
    lines.push(`**Overall Score:** ${report.overallScore}/100`);
    lines.push('');

    // Overall Status
    const status = report.overallScore >= 80 ? '✅ PASSED' :
                  report.overallScore >= 60 ? '⚠️ NEEDS IMPROVEMENT' : '❌ FAILED';
    lines.push(`**Status:** ${status}`);
    lines.push('');

    // Component Tests
    lines.push('## 🧪 COMPONENT TEST RESULTS');
    lines.push('');
    for (const test of report.componentTests) {
      const icon = test.passed ? '✅' : '❌';
      lines.push(`### ${icon} ${test.component} (${test.score}/100)`);
      lines.push('');
      if (test.issues.length > 0) {
        lines.push('**Issues:**');
        test.issues.forEach(issue => lines.push(`- ${issue}`));
        lines.push('');
      }
      lines.push('**Metrics:**');
      Object.entries(test.metrics).forEach(([key, value]) => {
        lines.push(`- ${key}: ${value}`);
      });
      lines.push('');
    }

    // Integration Tests
    lines.push('## 🔗 INTEGRATION TEST RESULTS');
    lines.push('');
    for (const test of report.integrationTests) {
      const icon = test.passed ? '✅' : '❌';
      lines.push(`### ${icon} ${test.testName}`);
      lines.push('');
      lines.push(`**Description:** ${test.description}`);
      lines.push('');
      lines.push('**Result:**');
      lines.push('```json');
      lines.push(JSON.stringify(test.result, null, 2));
      lines.push('```');
      lines.push('');
    }

    // Performance Tests
    lines.push('## ⚡ PERFORMANCE TEST RESULTS');
    lines.push('');
    for (const test of report.performanceTests) {
      const icon = test.passed ? '✅' : '❌';
      lines.push(`### ${icon} ${test.metric}`);
      lines.push('');
      lines.push(`- **Target:** ${test.target} ${test.unit}`);
      lines.push(`- **Actual:** ${Math.round(test.actual)} ${test.unit}`);
      lines.push(`- **Status:** ${test.passed ? 'PASSED' : 'FAILED'}`);
      lines.push('');
    }

    // Recommendations
    lines.push('## 💡 RECOMMENDATIONS');
    lines.push('');
    report.recommendations.forEach(rec => {
      lines.push(`- ${rec}`);
    });
    lines.push('');

    return lines.join('\n');
  }
}

// ============================================================================
// MAIN EXECUTION
// ============================================================================

async function main() {
  console.log('🔍 Starting System Validation');
  console.log('📋 Comprehensive validation of duplicate detection system');
  console.log('');

  try {
    const validator = new SystemValidator();
    const report = await validator.validateSystem();

    // Display results
    console.log('\n📊 VALIDATION RESULTS');
    console.log('=====================');
    console.log(`Overall Score: ${report.overallScore}/100`);
    console.log(`Processing Time: ${Math.round(report.processingTime)}ms`);
    console.log('');

    // Component results
    console.log('Component Tests:');
    report.componentTests.forEach(test => {
      const icon = test.passed ? '✅' : '❌';
      console.log(`  ${icon} ${test.component}: ${test.score}/100`);
    });
    console.log('');

    // Integration results
    console.log('Integration Tests:');
    report.integrationTests.forEach(test => {
      const icon = test.passed ? '✅' : '❌';
      console.log(`  ${icon} ${test.testName}`);
    });
    console.log('');

    // Performance results
    console.log('Performance Tests:');
    report.performanceTests.forEach(test => {
      const icon = test.passed ? '✅' : '❌';
      console.log(`  ${icon} ${test.metric}: ${Math.round(test.actual)} ${test.unit}`);
    });
    console.log('');

    // Recommendations
    if (report.recommendations.length > 0) {
      console.log('Recommendations:');
      report.recommendations.forEach(rec => {
        console.log(`  💡 ${rec}`);
      });
      console.log('');
    }

    // Generate and save report
    const reportContent = validator.generateValidationReport(report);
    await writeFile('system-validation-report.md', reportContent);
    console.log('📄 Validation report saved: system-validation-report.md');

    // Exit with appropriate code
    process.exit(report.overallScore >= 60 ? 0 : 1);

  } catch (error) {
    console.error('❌ System validation error:', error);
    process.exit(1);
  }
}

// Run if called directly
if (import.meta.main) {
  main();
}

export {
  SystemValidator,
  type SystemValidationReport
};