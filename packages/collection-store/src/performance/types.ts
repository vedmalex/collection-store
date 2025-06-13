export interface TestResult {
  testName: string
  duration: number // in milliseconds
  metrics: unknown // to be defined, e.g., memory usage, CPU time
}

export interface PerformanceScenario {
  name: string
  description: string
  setup: () => Promise<void>
  tests: string[]
  teardown?: () => Promise<void>
}

export interface PerformanceReport {
  scenario: PerformanceScenario
  results: TestResult[]
  totalDuration: number
  // other summary metrics
}

export interface IndexRecommendation {
  field: string;
  options?: { unique?: boolean };
  name: string;
  impact: number;
}

export interface IndexOptimization {
  recommendations: IndexRecommendation[];
  applied: number;
}

export interface QueryOptimizationResult {
  improvement: number;
  query: unknown; // Query object
  id: string;
}

export interface QueryOptimization {
  optimized: number;
}

export interface OptimizationResult {
  baseline: unknown;
  optimized: unknown;
  improvements: unknown;
  optimizations: (IndexOptimization | QueryOptimization)[];
}

export type LoadTestOperation = 'create' | 'read' | 'update' | 'delete' | 'query';

export interface LoadTestConfig {
  name: string;
  concurrentUsers: number;
  duration: number; // in milliseconds
  operations: LoadTestOperation[];
}

export interface LoadTestResult {
  // Define metrics for load test results
  totalRequests: number;
  errors: number;
  errorRate: number;
  avgLatency: number;
}

export interface StressTestResult {
  scenarios: LoadTestResult[];
}