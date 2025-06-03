import { EventEmitter } from 'events';
import {
  ComputedAttributeErrorFactory,
  ComputedAttributeErrorCodeDetailed
} from '../types/ErrorTypes';

/**
 * Configuration for memory and timeout limits
 */
export interface MemoryLimitConfig {
  maxMemoryUsage: number; // bytes
  maxComputeTime: number; // milliseconds
  memoryCheckInterval: number; // milliseconds
  enableMemoryMonitoring: boolean;
  enableTimeoutProtection: boolean;
  memoryWarningThreshold: number; // percentage (0-100)
}

/**
 * Default configuration
 */
export const DEFAULT_MEMORY_LIMIT_CONFIG: MemoryLimitConfig = {
  maxMemoryUsage: 100 * 1024 * 1024, // 100MB
  maxComputeTime: 30000, // 30 seconds
  memoryCheckInterval: 1000, // 1 second
  enableMemoryMonitoring: true,
  enableTimeoutProtection: true,
  memoryWarningThreshold: 80 // 80%
};

/**
 * Memory usage statistics
 */
export interface MemoryUsageStats {
  currentUsage: number;
  maxUsage: number;
  usagePercentage: number;
  isNearLimit: boolean;
  isOverLimit: boolean;
  lastCheck: Date;
}

/**
 * Computation execution context with limits
 */
export interface LimitedExecutionContext {
  attributeId: string;
  targetId: string;
  startTime: number;
  memorySnapshot: number;
  timeoutHandle?: NodeJS.Timeout;
  memoryCheckHandle?: NodeJS.Timeout;
}

/**
 * MemoryLimitManager manages memory usage and timeout limits for computations
 */
export class MemoryLimitManager extends EventEmitter {
  private config: MemoryLimitConfig;
  private activeComputations = new Map<string, LimitedExecutionContext>();
  private memoryUsageHistory: number[] = [];
  private isInitialized = false;

  constructor(config: Partial<MemoryLimitConfig> = {}) {
    super();
    this.config = { ...DEFAULT_MEMORY_LIMIT_CONFIG, ...config };
  }

  /**
   * Initialize the memory limit manager
   */
  async initialize(): Promise<void> {
    if (this.isInitialized) {
      throw ComputedAttributeErrorFactory.create(
        'MemoryLimitManager already initialized',
        ComputedAttributeErrorCodeDetailed.CONFIGURATION_ERROR
      );
    }

    this.isInitialized = true;
    this.emit('initialized');
  }

  /**
   * Start monitoring a computation
   */
  async startComputation(attributeId: string, targetId: string): Promise<string> {
    this.ensureInitialized();

    const computationId = `${attributeId}:${targetId}:${Date.now()}`;
    const startTime = Date.now();
    const memorySnapshot = this.getCurrentMemoryUsage();

    const context: LimitedExecutionContext = {
      attributeId,
      targetId,
      startTime,
      memorySnapshot
    };

    // Set up timeout protection
    if (this.config.enableTimeoutProtection) {
      context.timeoutHandle = setTimeout(() => {
        this.handleTimeout(computationId, context);
      }, this.config.maxComputeTime);
    }

    // Set up memory monitoring
    if (this.config.enableMemoryMonitoring) {
      context.memoryCheckHandle = setInterval(() => {
        this.checkMemoryUsage(computationId, context);
      }, this.config.memoryCheckInterval);
    }

    this.activeComputations.set(computationId, context);

    this.emit('computationStarted', {
      computationId,
      attributeId,
      targetId,
      startTime,
      memorySnapshot
    });

    return computationId;
  }

  /**
   * End monitoring a computation
   */
  async endComputation(computationId: string): Promise<void> {
    this.ensureInitialized();

    const context = this.activeComputations.get(computationId);
    if (!context) {
      return; // Already ended or never started
    }

    // Clear timers
    if (context.timeoutHandle) {
      clearTimeout(context.timeoutHandle);
    }
    if (context.memoryCheckHandle) {
      clearInterval(context.memoryCheckHandle);
    }

    const endTime = Date.now();
    const computeTime = endTime - context.startTime;
    const memoryUsed = this.getCurrentMemoryUsage() - context.memorySnapshot;

    this.activeComputations.delete(computationId);

    this.emit('computationEnded', {
      computationId,
      attributeId: context.attributeId,
      targetId: context.targetId,
      computeTime,
      memoryUsed,
      endTime
    });
  }

  /**
   * Create a timeout-protected promise wrapper
   */
  async withTimeout<T>(
    promise: Promise<T>,
    computationId: string,
    customTimeout?: number
  ): Promise<T> {
    const timeout = customTimeout || this.config.maxComputeTime;

    const timeoutPromise = new Promise<never>((_, reject) => {
      setTimeout(() => {
        const context = this.activeComputations.get(computationId);
        reject(ComputedAttributeErrorFactory.create(
          `Computation timeout after ${timeout}ms`,
          ComputedAttributeErrorCodeDetailed.COMPUTATION_TIMEOUT,
          'computation',
          {
            attributeId: context?.attributeId,
            targetId: context?.targetId
          }
        ));
      }, timeout);
    });

    return Promise.race([promise, timeoutPromise]);
  }

  /**
   * Create a memory-limited execution wrapper
   */
  async withMemoryLimit<T>(
    fn: () => Promise<T>,
    computationId: string,
    customMemoryLimit?: number
  ): Promise<T> {
    const memoryLimit = customMemoryLimit || this.config.maxMemoryUsage;
    const startMemory = this.getCurrentMemoryUsage();

    try {
      const result = await fn();

      // Check final memory usage
      const endMemory = this.getCurrentMemoryUsage();
      const memoryUsed = endMemory - startMemory;

      if (memoryUsed > memoryLimit) {
        const context = this.activeComputations.get(computationId);
        throw ComputedAttributeErrorFactory.create(
          `Memory limit exceeded: ${memoryUsed} bytes > ${memoryLimit} bytes`,
          ComputedAttributeErrorCodeDetailed.MEMORY_LIMIT_EXCEEDED,
          'computation',
          {
            attributeId: context?.attributeId,
            targetId: context?.targetId
          }
        );
      }

      return result;
    } catch (error) {
      // Check if it's a memory error
      if (error instanceof Error && error.message.includes('out of memory')) {
        const context = this.activeComputations.get(computationId);
        throw ComputedAttributeErrorFactory.create(
          'Out of memory during computation',
          ComputedAttributeErrorCodeDetailed.MEMORY_LIMIT_EXCEEDED,
          'computation',
          {
            attributeId: context?.attributeId,
            targetId: context?.targetId,
            originalError: error
          }
        );
      }
      throw error;
    }
  }

  /**
   * Get current memory usage statistics
   */
  getMemoryStats(): MemoryUsageStats {
    const currentUsage = this.getCurrentMemoryUsage();
    const maxUsage = Math.max(...this.memoryUsageHistory, currentUsage);
    const usagePercentage = (currentUsage / this.config.maxMemoryUsage) * 100;

    return {
      currentUsage,
      maxUsage,
      usagePercentage,
      isNearLimit: usagePercentage >= this.config.memoryWarningThreshold,
      isOverLimit: usagePercentage >= 100,
      lastCheck: new Date()
    };
  }

  /**
   * Get active computations count
   */
  getActiveComputationsCount(): number {
    return this.activeComputations.size;
  }

  /**
   * Get active computations details
   */
  getActiveComputations(): Array<{
    computationId: string;
    attributeId: string;
    targetId: string;
    runningTime: number;
    memoryUsed: number;
  }> {
    const now = Date.now();
    return Array.from(this.activeComputations.entries()).map(([id, context]) => ({
      computationId: id,
      attributeId: context.attributeId,
      targetId: context.targetId,
      runningTime: now - context.startTime,
      memoryUsed: this.getCurrentMemoryUsage() - context.memorySnapshot
    }));
  }

  /**
   * Force cleanup of all active computations
   */
  async cleanup(): Promise<void> {
    for (const [computationId, context] of this.activeComputations.entries()) {
      if (context.timeoutHandle) {
        clearTimeout(context.timeoutHandle);
      }
      if (context.memoryCheckHandle) {
        clearInterval(context.memoryCheckHandle);
      }
    }

    this.activeComputations.clear();
    this.emit('cleanup');
  }

  /**
   * Update configuration
   */
  updateConfig(newConfig: Partial<MemoryLimitConfig>): void {
    this.config = { ...this.config, ...newConfig };
    this.emit('configUpdated', this.config);
  }

  /**
   * Handle computation timeout
   */
  private handleTimeout(computationId: string, context: LimitedExecutionContext): void {
    const runningTime = Date.now() - context.startTime;

    this.emit('timeout', {
      computationId,
      attributeId: context.attributeId,
      targetId: context.targetId,
      runningTime,
      maxTime: this.config.maxComputeTime
    });

    // Clean up the computation
    this.endComputation(computationId);
  }

  /**
   * Check memory usage during computation
   */
  private checkMemoryUsage(computationId: string, context: LimitedExecutionContext): void {
    const currentMemory = this.getCurrentMemoryUsage();
    const memoryUsed = currentMemory - context.memorySnapshot;
    const usagePercentage = (memoryUsed / this.config.maxMemoryUsage) * 100;

    // Update memory history
    this.memoryUsageHistory.push(currentMemory);
    if (this.memoryUsageHistory.length > 100) {
      this.memoryUsageHistory.shift(); // Keep only last 100 measurements
    }

    // Check for memory warnings
    if (usagePercentage >= this.config.memoryWarningThreshold) {
      this.emit('memoryWarning', {
        computationId,
        attributeId: context.attributeId,
        targetId: context.targetId,
        memoryUsed,
        usagePercentage,
        maxMemory: this.config.maxMemoryUsage
      });
    }

    // Check for memory limit exceeded
    if (memoryUsed > this.config.maxMemoryUsage) {
      this.emit('memoryLimitExceeded', {
        computationId,
        attributeId: context.attributeId,
        targetId: context.targetId,
        memoryUsed,
        maxMemory: this.config.maxMemoryUsage
      });

      // Force end the computation
      this.endComputation(computationId);
    }
  }

  /**
   * Get current memory usage in bytes
   */
  private getCurrentMemoryUsage(): number {
    if (typeof process !== 'undefined' && process.memoryUsage) {
      const usage = process.memoryUsage();
      return usage.heapUsed + usage.external;
    }

    // Fallback for environments without process.memoryUsage
    return 0;
  }

  /**
   * Ensure manager is initialized
   */
  private ensureInitialized(): void {
    if (!this.isInitialized) {
      throw ComputedAttributeErrorFactory.create(
        'MemoryLimitManager not initialized',
        ComputedAttributeErrorCodeDetailed.CONFIGURATION_ERROR
      );
    }
  }
}