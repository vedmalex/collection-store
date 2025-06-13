/**
 * Represents the result of a single test case.
 */
export interface TestCaseResult {
  testName: string;
  status: 'PASS' | 'FAIL' | 'SKIP';
  durationMs: number;
  errorMessage?: string;
  browser: string;
  os: string;
  userAgent: string;
  timestamp: number;
}

/**
 * Represents the overall result of a test suite execution.
 */
export interface TestSuiteResult {
  suiteName: string;
  totalTests: number;
  passedTests: number;
  failedTests: number;
  skippedTests: number;
  durationMs: number;
  timestamp: number;
  results: TestCaseResult[];
  environment: {
    browser: string;
    os: string;
    userAgent: string;
    sdkVersion: string;
  };
}

/**
 * Interface for a test runner responsible for executing tests.
 */
export interface ITestRunner {
  runAll(): Promise<TestSuiteResult>;
  run(testNames: string[]): Promise<TestSuiteResult>;
  registerTest(testName: string, testFn: () => Promise<void>): void;
}

/**
 * Configuration options for the testing framework.
 */
export interface TestingConfig {
  enabled: boolean;
  reporters: ('console' | 'json' | 'remote')[];
  failFast: boolean;
  browserConcurrency: number;
  targetBrowsers: string[]; // e.g., 'chromium', 'firefox', 'webkit'
}

/**
 * Represents a test scenario or group of related tests.
 */
export interface TestScenario {
  name: string;
  tests: { [key: string]: () => Promise<void> };
}