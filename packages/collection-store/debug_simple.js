// Simple debug test
const { RealTimeOptimizer } = require('./src/performance/monitoring/RealTimeOptimizer.ts');

async function test() {
  const optimizer = new RealTimeOptimizer();

  const config = {
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

  await optimizer.startRealTimeOptimization(config);

  const thresholds = optimizer.getActiveThresholds();
  console.log('CPU warning threshold:', thresholds.resourceUsage.cpu.warning);

  const metrics = {
    timestamp: new Date(),
    responseTime: { min: 25, max: 100, avg: 50, p50: 45, p95: 75, p99: 90 },
    throughput: { totalOperations: 1000, operationsPerSecond: 100, successfulOperations: 900, failedOperations: 10 },
    errors: { totalErrors: 10, errorRate: 1, errorTypes: {} },
    system: {
      cpuUsage: 80, // This should trigger optimization
      memoryUsage: Math.floor((40 / 100) * 8 * 1024 * 1024 * 1024),
      networkBandwidth: 125,
      diskIO: 65
    }
  };

  console.log('CPU usage:', metrics.system.cpuUsage);
  console.log('Should trigger optimization:', metrics.system.cpuUsage > thresholds.resourceUsage.cpu.warning);

  const actions = await optimizer.applyDynamicOptimization(metrics);
  console.log('Actions count:', actions.length);
  console.log('Actions:', actions);

  await optimizer.stopRealTimeOptimization();
}

test().catch(console.error);