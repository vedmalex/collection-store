import { describe, test, expect, beforeEach, afterEach } from 'bun:test';
import { PerformanceIntegrator } from '../testing/PerformanceIntegrator';
import type { BaselineMetrics, ComparisonReport, IntegrationConfig } from '../testing/interfaces';

describe('Phase 6: PerformanceIntegrator', () => {
  let integrator: PerformanceIntegrator;

  beforeEach(() => {
    integrator = new PerformanceIntegrator({
      enableDetailedLogging: false,
      baselineTestDuration: 0.5, // Very short duration for tests
      baselineVirtualUsers: 1, // Minimal users for tests
      testMode: true, // Enable test optimizations
      fastBaseline: true, // Use fast baseline measurement
      mockScenarios: true, // Use mock scenario execution
      parallelBaseline: true // Enable parallel baseline
    });
  });

  afterEach(async () => {
    await integrator.cleanup();
  });

  describe('Initialization', () => {
    test('should initialize with default config', () => {
      const defaultIntegrator = new PerformanceIntegrator();
      expect(defaultIntegrator).toBeDefined();
    });

    test('should initialize with custom config', () => {
      const config: IntegrationConfig = {
        enableMetricsCollection: false,
        baselineTestDuration: 30,
        baselineVirtualUsers: 5,
        resultStoragePath: './custom-results',
        enableDetailedLogging: true
      };

      const customIntegrator = new PerformanceIntegrator(config);
      expect(customIntegrator).toBeDefined();
    });

    test('should initialize successfully', async () => {
      await expect(integrator.initialize()).resolves.toBeUndefined();
    });
  });

  describe('Baseline Measurement', () => {
    beforeEach(async () => {
      await integrator.initialize();
    });

    test('should measure baseline metrics successfully', async () => {
      const baseline = await integrator.measureBaseline();

      expect(baseline).toBeDefined();
      expect(baseline.timestamp).toBeGreaterThan(0);
      expect(baseline.authentication).toBeDefined();
      expect(baseline.database).toBeDefined();
      expect(baseline.realtime).toBeDefined();
      expect(baseline.fileStorage).toBeDefined();
      expect(baseline.computedAttributes).toBeDefined();
      expect(baseline.storedFunctions).toBeDefined();
      expect(baseline.system).toBeDefined();
    });

    test('should store baseline metrics', async () => {
      const baseline = await integrator.measureBaseline();
      const storedBaseline = integrator.getBaselineMetrics();

      expect(storedBaseline).toEqual(baseline);
    });
  });

  describe('Performance Test Suite', () => {
    beforeEach(async () => {
      await integrator.initialize();
    });

    test('should run performance test suite successfully', async () => {
      const results = await integrator.runPerformanceTestSuite();

      expect(results).toBeDefined();
      expect(Array.isArray(results)).toBe(true);
      expect(results.length).toBeGreaterThan(0);
    });

    test('should run specific scenarios', async () => {
      const scenarios = ['authentication', 'database'];
      const results = await integrator.runPerformanceTestSuite(scenarios);

      expect(results).toBeDefined();
      expect(results.length).toBeLessThanOrEqual(scenarios.length);
    });
  });

  describe('Performance Comparison', () => {
    beforeEach(async () => {
      await integrator.initialize();
      await integrator.measureBaseline();
    });

    test('should compare performance with baseline', async () => {
      const currentResults = await integrator.runPerformanceTestSuite(['authentication']);
      const comparison = await integrator.compareWithBaseline(currentResults);

      expect(comparison).toBeDefined();
      expect(comparison.timestamp).toBeGreaterThan(0);
      expect(comparison.baselineTimestamp).toBeGreaterThan(0);
      expect(Array.isArray(comparison.comparisons)).toBe(true);
      expect(comparison.summary).toBeDefined();
    });

        test('should throw error when no baseline available', async () => {
      const noBaselineIntegrator = new PerformanceIntegrator({
        testMode: true,
        fastBaseline: true,
        mockScenarios: true
      });
      await noBaselineIntegrator.initialize();

      const currentResults = await noBaselineIntegrator.runPerformanceTestSuite(['authentication']);

      await expect(noBaselineIntegrator.compareWithBaseline(currentResults))
        .rejects.toThrow('No baseline metrics available');
    });
  });

  describe('Scenario Validation', () => {
    beforeEach(async () => {
      await integrator.initialize();
    });

    test('should validate all test scenarios', async () => {
      const validation = await integrator.validateTestScenarios();

      expect(validation).toBeDefined();
      expect(validation.passed).toBeGreaterThanOrEqual(0);
      expect(validation.failed).toBeGreaterThanOrEqual(0);
      expect(Array.isArray(validation.errors)).toBe(true);
    });
  });

  describe('Resource Management', () => {
    test('should cleanup resources properly', async () => {
      await integrator.initialize();
      await expect(integrator.cleanup()).resolves.toBeUndefined();
    });
  });
});
