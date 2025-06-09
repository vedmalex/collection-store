import { Worker } from 'worker_threads';
import {
  LoadTestConfig,
  LoadTestResult,
  StressTestResult,
} from '../types';

// This would be a more complex class in a real scenario
class LoadMetrics {
    results: any[] = [];
    add(result: any) {
        this.results.push(result);
    }
    summarize(): LoadTestResult {
        const totalRequests = this.results.reduce((sum, r) => sum + (r.metrics?.requests ?? 0), 0);
        const errors = this.results.reduce((sum, r) => sum + (r.metrics?.errors ?? 0), 0);
        return {
            totalRequests,
            errors,
            errorRate: totalRequests > 0 ? errors / totalRequests : 0,
            avgLatency: 0, // Placeholder
        };
    }
}


export class LoadTester {
  private workers: Worker[] = [];
  private metrics: LoadMetrics = new LoadMetrics();

  async runLoadTest(config: LoadTestConfig): Promise<LoadTestResult> {
    console.log(`🔥 Starting load test: ${config.name}`);
    console.log(`  👥 Users: ${config.concurrentUsers}`);
    console.log(`  ⏱️  Duration: ${config.duration}ms`);

    const workerPromises: Promise<any>[] = [];

    // Spawn worker threads for concurrent load
    for (let i = 0; i < config.concurrentUsers; i++) {
      // Correct the path to the worker script
      const worker = new Worker('./src/performance/load/load-worker.js');

      const promise = new Promise((resolve, reject) => {
          worker.on('message', (msg) => {
              if(msg.type === 'result') {
                  this.metrics.add(msg);
                  resolve(msg);
              }
          });
          worker.on('error', reject);
          worker.on('exit', (code) => {
            if (code !== 0)
              reject(new Error(`Worker stopped with exit code ${code}`));
          });
      });

      worker.postMessage({
        type: 'start',
        config: {
          ...config,
          workerId: i,
        },
      });
      this.workers.push(worker);
      workerPromises.push(promise);
    }

    // Wait for a timeout or for all workers to complete
    await new Promise(resolve => setTimeout(resolve, config.duration));

    const results = this.collectResults();
    await this.cleanup();
    return results;
  }

  private collectResults(): LoadTestResult {
      return this.metrics.summarize();
  }

  private async cleanup(): Promise<void> {
    console.log('Terminating workers...');
    for(const worker of this.workers) {
        await worker.terminate();
    }
    this.workers = [];
    this.metrics = new LoadMetrics();
  }

  async stressTest(): Promise<StressTestResult> {
    const scenarios = [
      { users: 10, duration: 1000 },
      { users: 50, duration: 1000 },
    ];

    const results = [];

    for (const scenario of scenarios) {
      const result = await this.runLoadTest({
        name: `Stress Test ${scenario.users} users`,
        concurrentUsers: scenario.users,
        duration: scenario.duration,
        operations: ['create', 'read', 'update', 'delete', 'query'],
      });

      results.push(result);

      // Break point detection
      if (result.errorRate > 0.05) {
        // 5% error rate
        console.log(`💥 Breaking point reached at ${scenario.users} users`);
        break;
      }

      // Cool down between tests
      await new Promise((resolve) => setTimeout(resolve, 500));
    }

    return { scenarios: results };
  }
}