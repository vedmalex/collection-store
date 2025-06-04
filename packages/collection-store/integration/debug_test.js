// Debug test for RealTimeOptimizer
import { RealTimeOptimizer } from './src/performance/monitoring/RealTimeOptimizer.ts';

function createMockMetrics(overrides = {}) {
  const defaults = {
    cpuUsage: 30,
    memoryUsage: 40,
    responseTime: 50,
    throughput: 100,
    errorRate: 1
  };

  const values = { ...defaults, ...overrides };

  return {
    timestamp: new Date(),
    responseTime: {
      min: values.responseTime * 0.5,
      max: values.responseTime * 2,
      avg: values.responseTime,
      p50: values.responseTime * 0.9,
      p95: values.responseTime * 1.5,
      p99: values.responseTime * 1.8
    },
    throughput: {
      totalOperations: values.throughput * 10,
      operationsPerSecond: values.throughput,
      successfulOperations: values.throughput * 9,
      failedOperations: Math.floor(values.throughput * 0.1)
    },
    errors: {
      totalErrors: Math.floor(values.errorRate * 10),
      errorRate: values.errorRate,
      errorTypes: {}
    },
    system: {
      cpuUsage: values.cpuUsage,
      memoryUsage: Math.floor((values.memoryUsage / 100) * 8 * 1024 * 1024 * 1024),
      networkBandwidth: 100 + Math.random() * 50,
      diskIO: 50 + Math.random() * 30
    }
  };
}

async function debugTest() {
  const optimizer = new RealTimeOptimizer();

  const mockConfig = {
    monitoringInterval: 1000,
    cooldownPeriod: 5,
    emergencyThresholds: {
      criticalCpuUsage: 90,
      criticalMemoryUsage: 95,
      criticalErrorRate: 10,
      criticalResponseTime: 500,
      criticalThroughputDrop: 50
    }
  };

  console.log('Starting optimizer...');
  await optimizer.startRealTimeOptimization(mockConfig);

  console.log('Getting active thresholds...');
  const thresholds = optimizer.getActiveThresholds();
  console.log('Active thresholds:', JSON.stringify(thresholds, null, 2));

  console.log('Creating metrics with CPU 80%...');
  const metrics = createMockMetrics({ cpuUsage: 80 });
  console.log('Metrics:', JSON.stringify(metrics, null, 2));

  console.log('Applying dynamic optimization...');
  const actions = await optimizer.applyDynamicOptimization(metrics);
  console.log('Actions:', JSON.stringify(actions, null, 2));

  await optimizer.stopRealTimeOptimization();
}

debugTest().catch(console.error);