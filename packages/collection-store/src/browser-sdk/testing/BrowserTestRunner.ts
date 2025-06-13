// src/browser-sdk/testing/BrowserTestRunner.ts

import { ITestRunner, TestCaseResult, TestSuiteResult, TestScenario } from './types';

/**
 * A conceptual cross-browser test runner for the Collection Store SDK.
 * This runner can register and execute test scenarios, simulating browser environments.
 */
export class BrowserTestRunner implements ITestRunner {
  private testScenarios: Map<string, TestScenario> = new Map();
  private currentBrowser: string = 'Chrome'; // Simulated browser
  private currentOS: string = 'macOS'; // Simulated OS
  private currentUA: string = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'; // Simulated User Agent
  private sdkVersion: string = '6.0.0'; // Simulated SDK Version

  constructor(initialBrowser?: string) {
    if (initialBrowser) {
      this.currentBrowser = initialBrowser;
      this.currentUA = this.generateUserAgent(initialBrowser);
      this.currentOS = this.getOSForBrowser(initialBrowser);
    }
  }

  /**
   * Registers a new test scenario (group of tests).
   * @param scenario The test scenario to register.
   */
  registerScenario(scenario: TestScenario): void {
    if (this.testScenarios.has(scenario.name)) {
      console.warn(`Test scenario '${scenario.name}' already registered. Overwriting.`);
    }
    this.testScenarios.set(scenario.name, scenario);
    console.log(`Test scenario '${scenario.name}' registered.`);
  }

  /**
   * Registers a single test function under a default scenario (or specified).
   * @param testName The name of the test.
   * @param testFn The test function to execute.
   */
  registerTest(testName: string, testFn: () => Promise<void>): void {
    const defaultScenarioName = 'Default Tests';
    let scenario = this.testScenarios.get(defaultScenarioName);
    if (!scenario) {
      scenario = { name: defaultScenarioName, tests: {} };
      this.testScenarios.set(defaultScenarioName, scenario);
    }
    scenario.tests[testName] = testFn;
    console.log(`Test '${testName}' registered under '${defaultScenarioName}'.`);
  }

  /**
   * Sets the current browser environment for subsequent test runs.
   * @param browser The name of the browser (e.g., 'Chrome', 'Firefox', 'Safari', 'Edge').
   */
  setBrowser(browser: string): void {
    this.currentBrowser = browser;
    this.currentUA = this.generateUserAgent(browser);
    this.currentOS = this.getOSForBrowser(browser);
    console.log(`Test runner set to simulate: ${this.currentBrowser} (${this.currentOS})`);
  }

  /**
   * Runs all registered test scenarios.
   * @returns A promise that resolves with the overall test suite result.
   */
  async runAll(): Promise<TestSuiteResult> {
    console.log(`
--- Running all tests in ${this.currentBrowser} (${this.currentOS}) ---
`);
    const allResults: TestCaseResult[] = [];
    let totalTests = 0;
    let passedTests = 0;
    let failedTests = 0;
    let skippedTests = 0;
    const startTime = Date.now();

    for (const [scenarioName, scenario] of this.testScenarios.entries()) {
      console.log(`Running scenario: ${scenarioName}`);
      for (const testName in scenario.tests) {
        totalTests++;
        const testFn = scenario.tests[testName];
        const testCaseResult = await this.runSingleTest(testName, testFn);
        allResults.push(testCaseResult);
        if (testCaseResult.status === 'PASS') {
          passedTests++;
        } else if (testCaseResult.status === 'FAIL') {
          failedTests++;
        } else if (testCaseResult.status === 'SKIP') {
          skippedTests++;
        }
      }
    }

    const durationMs = Date.now() - startTime;
    const suiteResult: TestSuiteResult = {
      suiteName: 'Cross-Browser Test Suite',
      totalTests,
      passedTests,
      failedTests,
      skippedTests,
      durationMs,
      timestamp: Date.now(),
      results: allResults,
      environment: {
        browser: this.currentBrowser,
        os: this.currentOS,
        userAgent: this.currentUA,
        sdkVersion: this.sdkVersion,
      },
    };

    this.logTestSuiteResult(suiteResult);
    return suiteResult;
  }

  /**
   * Runs a specific set of tests by their names.
   * @param testNames An array of test names to run.
   * @returns A promise that resolves with the overall test suite result.
   */
  async run(testNames: string[]): Promise<TestSuiteResult> {
    console.log(`
--- Running specified tests in ${this.currentBrowser} (${this.currentOS}) ---
`);
    const allResults: TestCaseResult[] = [];
    let totalTests = 0;
    let passedTests = 0;
    let failedTests = 0;
    let skippedTests = 0;
    const startTime = Date.now();

    for (const testName of testNames) {
      let found = false;
      for (const scenario of this.testScenarios.values()) {
        if (scenario.tests[testName]) {
          found = true;
          totalTests++;
          const testFn = scenario.tests[testName];
          const testCaseResult = await this.runSingleTest(testName, testFn);
          allResults.push(testCaseResult);
          if (testCaseResult.status === 'PASS') {
            passedTests++;
          } else if (testCaseResult.status === 'FAIL') {
            failedTests++;
          } else if (testCaseResult.status === 'SKIP') {
            skippedTests++;
          }
          break; // Test found and run, move to next requested testName
        }
      }
      if (!found) {
        console.warn(`Test '${testName}' not found.`);
        totalTests++; // Count missing test as a skipped test
        skippedTests++;
        allResults.push({
          testName,
          status: 'SKIP',
          durationMs: 0,
          errorMessage: 'Test not found',
          browser: this.currentBrowser,
          os: this.currentOS,
          userAgent: this.currentUA,
          timestamp: Date.now(),
        });
      }
    }

    const durationMs = Date.now() - startTime;
    const suiteResult: TestSuiteResult = {
      suiteName: 'Cross-Browser Test Suite',
      totalTests,
      passedTests,
      failedTests,
      skippedTests,
      durationMs,
      timestamp: Date.now(),
      results: allResults,
      environment: {
        browser: this.currentBrowser,
        os: this.currentOS,
        userAgent: this.currentUA,
        sdkVersion: this.sdkVersion,
      },
    };

    this.logTestSuiteResult(suiteResult);
    return suiteResult;
  }

  private async runSingleTest(testName: string, testFn: () => Promise<void>): Promise<TestCaseResult> {
    const startTime = Date.now();
    let status: TestCaseResult['status'] = 'PASS';
    let errorMessage: string | undefined;

    try {
      await testFn();
      console.log(`  ✅ ${testName}`);
    } catch (e: any) {
      status = 'FAIL';
      errorMessage = e.message || 'Unknown error';
      console.error(`  ❌ ${testName}: ${errorMessage}`);
    }

    const durationMs = Date.now() - startTime;
    return {
      testName,
      status,
      durationMs,
      errorMessage,
      browser: this.currentBrowser,
      os: this.currentOS,
      userAgent: this.currentUA,
      timestamp: Date.now(),
    };
  }

  private logTestSuiteResult(suiteResult: TestSuiteResult): void {
    console.log(`
--- Test Suite Summary for ${suiteResult.suiteName} ---
Browser: ${suiteResult.environment.browser} (${suiteResult.environment.os})
SDK Version: ${suiteResult.environment.sdkVersion}
Total Tests: ${suiteResult.totalTests}
Passed: ${suiteResult.passedTests}
Failed: ${suiteResult.failedTests}
Skipped: ${suiteResult.skippedTests}
Duration: ${suiteResult.durationMs}ms
-------------------------------------------
`);
    suiteResult.results.forEach(res => {
      console.log(`${res.status === 'PASS' ? '✅' : res.status === 'FAIL' ? '❌' : '⚠️'} ${res.testName} (${res.durationMs}ms)${res.errorMessage ? `: ${res.errorMessage}` : ''}`);
    });
    console.log('\n');
  }

  private generateUserAgent(browser: string): string {
    switch (browser.toLowerCase()) {
      case 'firefox': return 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10.15; rv:109.0) Gecko/20100101 Firefox/115.0';
      case 'safari': return 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.6 Safari/605.1.15';
      case 'edge': return 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36 Edg/120.0.0.0';
      case 'chrome':
      default: return 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';
    }
  }

  private getOSForBrowser(browser: string): string {
    // Simplified OS simulation based on common browser environments
    switch (browser.toLowerCase()) {
      case 'firefox':
      case 'safari': return 'macOS';
      case 'edge': return 'Windows';
      case 'chrome':
      default: return 'macOS'; // Assuming development on macOS
    }
  }
}
