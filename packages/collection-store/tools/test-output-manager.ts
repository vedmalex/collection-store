#!/usr/bin/env bun

/**
 * Test Output Manager
 *
 * C9: Test Output Manager
 * Manages large test suite output using file-based analysis
 * Implements bun test > test_output.log 2>&1 pattern
 */

import { spawn } from 'child_process';
import { readFile, writeFile, mkdir } from 'fs/promises';
import { join, basename } from 'path';
import { existsSync } from 'fs';

// ============================================================================
// INTERFACES AND TYPES
// ============================================================================

interface TestRunConfig {
  outputFile: string;
  testPattern?: string;
  timeout?: number;
  maxBuffer?: number;
}

interface TestResult {
  passed: number;
  failed: number;
  skipped: number;
  total: number;
  duration: number;
  failedTests: FailedTest[];
}

interface FailedTest {
  name: string;
  file: string;
  error: string;
  line?: number;
}

interface TestAnalysis {
  totalRuns: number;
  successRate: number;
  averageDuration: number;
  commonFailures: Map<string, number>;
  performanceMetrics: PerformanceMetric[];
}

interface PerformanceMetric {
  testName: string;
  duration: number;
  category: 'FAST' | 'NORMAL' | 'SLOW' | 'VERY_SLOW';
}

// ============================================================================
// C9: TEST OUTPUT MANAGER
// ============================================================================

class TestOutputManager {
  private readonly outputDir = 'test-output';

  async runTestSuite(config: TestRunConfig): Promise<TestResult> {
    console.log('🧪 Running test suite with file-based output...');

    // Ensure output directory exists
    await this.ensureOutputDirectory();

    const outputPath = join(this.outputDir, config.outputFile);

    return new Promise((resolve, reject) => {
      const startTime = Date.now();

      // Build bun test command
      const args = ['test'];
      if (config.testPattern) {
        args.push('-t', config.testPattern);
      }

      console.log(`📝 Running: bun ${args.join(' ')} > ${outputPath} 2>&1`);

      // Spawn bun test process with output redirection
      const testProcess = spawn('bun', args, {
        stdio: ['pipe', 'pipe', 'pipe'],
        cwd: process.cwd()
      });

      let stdout = '';
      let stderr = '';

      testProcess.stdout.on('data', (data) => {
        stdout += data.toString();
      });

      testProcess.stderr.on('data', (data) => {
        stderr += data.toString();
      });

      testProcess.on('close', async (code) => {
        const endTime = Date.now();
        const duration = endTime - startTime;

        // Combine stdout and stderr as bun test does
        const combinedOutput = stdout + stderr;

        try {
          // Save output to file
          await writeFile(outputPath, combinedOutput);
          console.log(`✅ Test output saved to: ${outputPath}`);

          // Analyze results
          const result = await this.analyzeTestOutput(outputPath, duration);
          resolve(result);

        } catch (error) {
          reject(new Error(`Failed to save test output: ${error}`));
        }
      });

      testProcess.on('error', (error) => {
        reject(new Error(`Test process failed: ${error}`));
      });

      // Set timeout if specified
      if (config.timeout) {
        setTimeout(() => {
          testProcess.kill('SIGTERM');
          reject(new Error(`Test run timed out after ${config.timeout}ms`));
        }, config.timeout);
      }
    });
  }

  async analyzeTestOutput(outputFile: string, duration: number): Promise<TestResult> {
    console.log(`🔍 Analyzing test output from: ${outputFile}`);

    const content = await readFile(outputFile, 'utf-8');
    const lines = content.split('\n');

    let passed = 0;
    let failed = 0;
    let skipped = 0;
    const failedTests: FailedTest[] = [];

    // Parse bun test output patterns
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];

      // Count passed tests: ✓ test_name
      if (line.match(/^\s*✓/)) {
        passed++;
      }

      // Count failed tests: ✗ test_name
      if (line.match(/^\s*✗/)) {
        failed++;

        // Extract failed test info
        const testNameMatch = line.match(/✗\s+(.+?)(?:\s+\(\d+ms\))?$/);
        if (testNameMatch) {
          const testName = testNameMatch[1];

          // Look for error details in following lines
          let error = '';
          let j = i + 1;
          while (j < lines.length && lines[j].trim() && !lines[j].match(/^\s*[✓✗]/)) {
            error += lines[j] + '\n';
            j++;
          }

          failedTests.push({
            name: testName,
            file: this.extractFileFromError(error),
            error: error.trim()
          });
        }
      }

      // Count skipped tests: - test_name
      if (line.match(/^\s*-\s+/)) {
        skipped++;
      }
    }

    const total = passed + failed + skipped;

    return {
      passed,
      failed,
      skipped,
      total,
      duration,
      failedTests
    };
  }

  private extractFileFromError(error: string): string {
    // Look for file paths in error messages
    const fileMatch = error.match(/at\s+(.+?\.test\.[jt]s):/);
    if (fileMatch) {
      return fileMatch[1];
    }

    // Alternative pattern
    const altMatch = error.match(/(\w+\/.*\.test\.[jt]s)/);
    if (altMatch) {
      return altMatch[1];
    }

    return 'unknown';
  }

  async filterFailedTests(outputFile: string): Promise<string[]> {
    console.log('🔍 Filtering failed tests...');

    const content = await readFile(outputFile, 'utf-8');

    // Use grep-like filtering as specified in requirements
    const lines = content.split('\n');
    const failedLines = lines.filter(line => line.includes('(fail)') || line.match(/^\s*✗/));

    // Extract unique test names
    const failedTests = new Set<string>();

    for (const line of failedLines) {
      const testMatch = line.match(/✗\s+(.+?)(?:\s+\(\d+ms\))?$/);
      if (testMatch) {
        failedTests.add(testMatch[1]);
      }
    }

    return Array.from(failedTests);
  }

  async runSpecificTests(testNames: string[]): Promise<TestResult> {
    console.log(`🎯 Running specific tests: ${testNames.length} tests`);

    const results: TestResult[] = [];

    for (const testName of testNames) {
      try {
        const config: TestRunConfig = {
          outputFile: `specific-test-${Date.now()}.log`,
          testPattern: testName,
          timeout: 30000 // 30 seconds per test
        };

        const result = await this.runTestSuite(config);
        results.push(result);

      } catch (error) {
        console.warn(`⚠️ Failed to run test "${testName}": ${error}`);
      }
    }

    // Aggregate results
    return this.aggregateResults(results);
  }

  private aggregateResults(results: TestResult[]): TestResult {
    const aggregated: TestResult = {
      passed: 0,
      failed: 0,
      skipped: 0,
      total: 0,
      duration: 0,
      failedTests: []
    };

    for (const result of results) {
      aggregated.passed += result.passed;
      aggregated.failed += result.failed;
      aggregated.skipped += result.skipped;
      aggregated.total += result.total;
      aggregated.duration += result.duration;
      aggregated.failedTests.push(...result.failedTests);
    }

    return aggregated;
  }

  async generatePerformanceReport(outputFiles: string[]): Promise<TestAnalysis> {
    console.log('📊 Generating performance analysis...');

    const performanceMetrics: PerformanceMetric[] = [];
    const commonFailures = new Map<string, number>();
    let totalRuns = 0;
    let totalPassed = 0;
    let totalDuration = 0;

    for (const outputFile of outputFiles) {
      if (!existsSync(outputFile)) continue;

      const content = await readFile(outputFile, 'utf-8');
      const lines = content.split('\n');

      totalRuns++;

      // Extract performance metrics
      for (const line of lines) {
        // Parse test duration: ✓ test_name (123ms)
        const perfMatch = line.match(/[✓✗]\s+(.+?)\s+\((\d+)ms\)/);
        if (perfMatch) {
          const testName = perfMatch[1];
          const duration = parseInt(perfMatch[2]);

          const category = this.categorizePerformance(duration);
          performanceMetrics.push({ testName, duration, category });
        }

        // Count passed tests
        if (line.match(/^\s*✓/)) {
          totalPassed++;
        }

        // Track common failures
        if (line.match(/^\s*✗/)) {
          const testMatch = line.match(/✗\s+(.+?)(?:\s+\(\d+ms\))?$/);
          if (testMatch) {
            const testName = testMatch[1];
            commonFailures.set(testName, (commonFailures.get(testName) || 0) + 1);
          }
        }
      }

      // Extract total duration from summary
      const durationMatch = content.match(/(\d+)\s*tests?\s+run.*?in\s+(\d+(?:\.\d+)?)s/);
      if (durationMatch) {
        totalDuration += parseFloat(durationMatch[2]) * 1000;
      }
    }

    const successRate = totalRuns > 0 ? totalPassed / (totalPassed + commonFailures.size) : 0;
    const averageDuration = totalRuns > 0 ? totalDuration / totalRuns : 0;

    return {
      totalRuns,
      successRate,
      averageDuration,
      commonFailures,
      performanceMetrics
    };
  }

  private categorizePerformance(duration: number): 'FAST' | 'NORMAL' | 'SLOW' | 'VERY_SLOW' {
    if (duration < 100) return 'FAST';
    if (duration < 500) return 'NORMAL';
    if (duration < 2000) return 'SLOW';
    return 'VERY_SLOW';
  }

  async generateOutputReport(result: TestResult, analysis?: TestAnalysis): Promise<string> {
    const lines = [];

    lines.push('# 🧪 TEST OUTPUT ANALYSIS REPORT');
    lines.push('');
    lines.push(`**Generated:** ${new Date().toISOString()}`);
    lines.push('');

    // Test Results Summary
    lines.push('## 📊 TEST RESULTS SUMMARY');
    lines.push('');
    lines.push(`- **Total Tests:** ${result.total}`);
    lines.push(`- **Passed:** ${result.passed} (${Math.round(result.passed / result.total * 100)}%)`);
    lines.push(`- **Failed:** ${result.failed} (${Math.round(result.failed / result.total * 100)}%)`);
    lines.push(`- **Skipped:** ${result.skipped} (${Math.round(result.skipped / result.total * 100)}%)`);
    lines.push(`- **Duration:** ${Math.round(result.duration)}ms`);
    lines.push('');

    // Failed Tests
    if (result.failedTests.length > 0) {
      lines.push('## ❌ FAILED TESTS');
      lines.push('');

      result.failedTests.forEach((test, index) => {
        lines.push(`### ${index + 1}. ${test.name}`);
        lines.push('');
        lines.push(`**File:** \`${test.file}\``);
        lines.push('');
        lines.push('**Error:**');
        lines.push('```');
        lines.push(test.error);
        lines.push('```');
        lines.push('');
      });
    }

    // Performance Analysis
    if (analysis) {
      lines.push('## 🚀 PERFORMANCE ANALYSIS');
      lines.push('');
      lines.push(`- **Total Runs:** ${analysis.totalRuns}`);
      lines.push(`- **Success Rate:** ${Math.round(analysis.successRate * 100)}%`);
      lines.push(`- **Average Duration:** ${Math.round(analysis.averageDuration)}ms`);
      lines.push('');

      // Performance Categories
      const perfCounts = { FAST: 0, NORMAL: 0, SLOW: 0, VERY_SLOW: 0 };
      analysis.performanceMetrics.forEach(metric => {
        perfCounts[metric.category]++;
      });

      lines.push('### Performance Distribution');
      lines.push('');
      lines.push(`- **Fast (<100ms):** ${perfCounts.FAST} tests`);
      lines.push(`- **Normal (100-500ms):** ${perfCounts.NORMAL} tests`);
      lines.push(`- **Slow (500ms-2s):** ${perfCounts.SLOW} tests`);
      lines.push(`- **Very Slow (>2s):** ${perfCounts.VERY_SLOW} tests`);
      lines.push('');

      // Common Failures
      if (analysis.commonFailures.size > 0) {
        lines.push('### Most Common Failures');
        lines.push('');

        const sortedFailures = Array.from(analysis.commonFailures.entries())
          .sort((a, b) => b[1] - a[1])
          .slice(0, 10);

        sortedFailures.forEach(([testName, count]) => {
          lines.push(`- **${testName}:** ${count} failures`);
        });
        lines.push('');
      }
    }

    // Required Commands Reference
    lines.push('## 📋 REQUIRED ANALYSIS COMMANDS');
    lines.push('');
    lines.push('As specified in requirements, use these commands for analysis:');
    lines.push('');
    lines.push('```bash');
    lines.push('# Run tests with file output');
    lines.push('bun test > test_output.log 2>&1');
    lines.push('');
    lines.push('# Filter failed tests');
    lines.push('grep "(fail)" test_output.log');
    lines.push('');
    lines.push('# Get unique failed test files');
    lines.push('grep "(fail)" test_output.log | cut -d">" -f1 | sort | uniq');
    lines.push('');
    lines.push('# Run specific test category');
    lines.push('bun test -t "core > performance"');
    lines.push('```');
    lines.push('');

    return lines.join('\n');
  }

  private async ensureOutputDirectory(): Promise<void> {
    if (!existsSync(this.outputDir)) {
      await mkdir(this.outputDir, { recursive: true });
    }
  }
}

// ============================================================================
// MAIN EXECUTION
// ============================================================================

async function main() {
  console.log('🧪 Starting Test Output Manager');
  console.log('📁 File-based analysis for large test suites');
  console.log('');

  try {
    const manager = new TestOutputManager();

    // Configuration
    const config: TestRunConfig = {
      outputFile: `test-run-${new Date().toISOString().replace(/[:.]/g, '-')}.log`,
      timeout: 300000 // 5 minutes
    };

    // Run test suite
    const result = await manager.runTestSuite(config);

    // Display results
    console.log('\n🎯 TEST EXECUTION RESULTS');
    console.log('=========================');
    console.log(`Total tests: ${result.total}`);
    console.log(`Passed: ${result.passed} (${Math.round(result.passed / result.total * 100)}%)`);
    console.log(`Failed: ${result.failed} (${Math.round(result.failed / result.total * 100)}%)`);
    console.log(`Skipped: ${result.skipped} (${Math.round(result.skipped / result.total * 100)}%)`);
    console.log(`Duration: ${Math.round(result.duration)}ms`);
    console.log('');

    if (result.failed > 0) {
      console.log(`❌ ${result.failed} tests failed`);

      // Filter and re-run failed tests
      const outputPath = join(manager['outputDir'], config.outputFile);
      const failedTests = await manager.filterFailedTests(outputPath);

      if (failedTests.length > 0) {
        console.log(`🔄 Re-running ${failedTests.length} failed tests...`);
        const retryResult = await manager.runSpecificTests(failedTests.slice(0, 5)); // Limit to 5 for demo
        console.log(`Retry results: ${retryResult.passed} passed, ${retryResult.failed} still failing`);
      }
    } else {
      console.log('✅ All tests passed!');
    }

    // Generate and save report
    const report = await manager.generateOutputReport(result);
    await Bun.write('test-output-analysis-report.md', report);
    console.log('📄 Analysis report saved: test-output-analysis-report.md');

  } catch (error) {
    console.error('❌ Test output manager error:', error);
    process.exit(1);
  }
}

// Run if called directly
if (import.meta.main) {
  main();
}

export {
  TestOutputManager,
  type TestRunConfig,
  type TestResult,
  type TestAnalysis
};