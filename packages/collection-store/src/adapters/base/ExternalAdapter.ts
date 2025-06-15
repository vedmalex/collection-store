// Base ExternalAdapter abstract class
// Implements common functionality for all external adapters

import { EventEmitter } from 'events';
import { IExternalAdapter } from './interfaces/IExternalAdapter';
import {
  AdapterConfig,
  AdapterState,
  AdapterMetrics,
  AdapterHealth,
  AdapterQuery,
  AdapterData,
  AdapterResult,
  AdapterTransaction,
  AdapterSubscription,
  AdapterCallback,
  AdapterEvent,
  AdapterEventHandler
} from './types/AdapterTypes';
import { merge } from 'lodash-es'; // Import merge for deep cloning

export abstract class ExternalAdapter extends EventEmitter implements IExternalAdapter {
  protected _state: AdapterState = AdapterState.INACTIVE;
  protected _metrics: AdapterMetrics;
  protected _subscriptions: Map<string, AdapterSubscription> = new Map();
  protected _transactions: Map<string, AdapterTransaction> = new Map();
  protected _healthCheckInterval?: NodeJS.Timeout;
  protected _startTime: Date = new Date();

  constructor(
    public readonly id: string,
    public readonly type: string,
    protected _config: AdapterConfig
  ) {
    super();
    this._metrics = this.initializeMetrics();
    this.setupHealthCheck();
  }

  // Getters
  get state(): AdapterState {
    return this._state;
  }

  get config(): AdapterConfig {
    return { ...this._config };
  }

  get metrics(): AdapterMetrics {
    return { ...this._metrics };
  }

  // Lifecycle methods
  async initialize(): Promise<void> {
    this.setState(AdapterState.INITIALIZING);
    try {
      await this.doInitialize();
      this.setState(AdapterState.INACTIVE);
      this.emit('STATE_CHANGE', { type: 'STATE_CHANGE', adapterId: this.id, timestamp: new Date(), data: { state: this._state } });
    } catch (error) {
      this.recordError(error as Error);
      this.setState(AdapterState.ERROR);
      throw error;
    }
  }

  async start(): Promise<void> {
    if (this._state === AdapterState.ACTIVE) {
      return;
    }

    try {
      await this.doStart();
      this.setState(AdapterState.ACTIVE);
      this._startTime = new Date();
      this.emit('STATE_CHANGE', { type: 'STATE_CHANGE', adapterId: this.id, timestamp: new Date(), data: { state: this._state } });
    } catch (error) {
      this.setState(AdapterState.ERROR);
      this.recordError(error as Error);
      throw error;
    }
  }

  async stop(): Promise<void> {
    if (this._state === AdapterState.INACTIVE) {
      return;
    }

    this.setState(AdapterState.STOPPING);
    try {
      // Stop health check
      if (this._healthCheckInterval) {
        clearInterval(this._healthCheckInterval);
        this._healthCheckInterval = undefined;
      }

      // Unsubscribe all subscriptions
      for (const subscription of this._subscriptions.values()) {
        await this.doUnsubscribe(subscription.id);
      }
      this._subscriptions.clear();

      // Rollback active transactions
      for (const transaction of this._transactions.values()) {
        if (transaction.state === 'ACTIVE' || transaction.state === 'PREPARED') {
          await this.rollbackTransaction(transaction);
        }
      }
      this._transactions.clear();

      await this.doStop();
      this.setState(AdapterState.INACTIVE);
      this.emit('STATE_CHANGE', { type: 'STATE_CHANGE', adapterId: this.id, timestamp: new Date(), data: { state: this._state } });
    } catch (error) {
      this.setState(AdapterState.ERROR);
      this.recordError(error as Error);
      throw error;
    }
  }

  async restart(): Promise<void> {
    await this.stop();
    await this.initialize();
    await this.start();
  }

  // Health monitoring
  async getHealth(): Promise<AdapterHealth> {
    try {
      const healthDetails = await this.doHealthCheck();
      let status: AdapterHealth['status'];

      if (this.isHealthy()) {
        status = 'healthy';
      } else if (healthDetails.status) { // Use status from doHealthCheck if adapter is not healthy
        status = healthDetails.status;
      } else {
        status = 'unhealthy';
      }

      return {
        status: status,
        lastCheck: new Date(),
        details: healthDetails
      };
    } catch (error) {
      return {
        status: 'unhealthy',
        lastCheck: new Date(),
        details: { error: (error as Error).message }
      };
    }
  }

  isHealthy(): boolean {
    return this._state === AdapterState.ACTIVE;
  }

  // Configuration management
  async updateConfig(config: Partial<AdapterConfig>): Promise<void> {
    const newConfig = merge({}, this._config, config);

    if (await this.validateConfig(newConfig)) {
      this._config = newConfig;
      await this.doConfigUpdate(config);
    } else {
      throw new Error('Invalid configuration');
    }
  }

  async validateConfig(config: Partial<AdapterConfig>): Promise<boolean> {
    return this.doValidateConfig(config);
  }

  // Event handling
  override emit(eventName: string | symbol, event: AdapterEvent): boolean {
    return super.emit(eventName, event);
  }

  override on(event: string, handler: AdapterEventHandler): this {
    super.on(event, handler);
    return this;
  }

  override off(event: string, handler: AdapterEventHandler): this {
    super.off(event, handler);
    return this;
  }

  // Utility methods
  async ping(): Promise<boolean> {
    try {
      return await this.doPing();
    } catch {
      return false;
    }
  }

  getMetrics(): AdapterMetrics {
    return {
      ...this._metrics,
      uptime: Date.now() - this._startTime.getTime()
    };
  }

  resetMetrics(): void {
    this._metrics = this.initializeMetrics();
  }

  // Protected helper methods
  protected setState(state: AdapterState): void {
    this._state = state;
  }

  protected recordOperation(): void {
    this._metrics.operationsCount++;
    this._metrics.lastOperation = new Date();
  }

  protected recordError(error: Error): void {
    this._metrics.errorCount++;
    this._metrics.lastError = new Date();
    this.emit('ERROR', {
      type: 'ERROR',
      adapterId: this.id,
      timestamp: new Date(),
      data: { error: error.message, stack: error.stack }
    });
  }

  protected updateResponseTime(duration: number): void {
    const count = this._metrics.operationsCount;
    this._metrics.averageResponseTime =
      (this._metrics.averageResponseTime * (count - 1) + duration) / count;
  }

  protected generateSubscriptionId(): string {
    return `${this.id}_sub_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  protected generateTransactionId(): string {
    return `${this.id}_tx_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private initializeMetrics(): AdapterMetrics {
    return {
      operationsCount: 0,
      errorCount: 0,
      lastOperation: null,
      lastError: null,
      averageResponseTime: 0,
      uptime: 0
    };
  }

  private setupHealthCheck(): void {
    if (this._config.lifecycle.healthCheckInterval > 0) {
      this._healthCheckInterval = setInterval(async () => {
        try {
          const health = await this.getHealth();
          this.emit('HEALTH_CHECK', {
            type: 'HEALTH_CHECK',
            adapterId: this.id,
            timestamp: new Date(),
            data: { health }
          });
        } catch (error) {
          this.emit('ERROR', {
            type: 'ERROR',
            adapterId: this.id,
            timestamp: new Date(),
            data: { error: (error as Error).message }
          });
        }
      }, this._config.lifecycle.healthCheckInterval);
    }
  }

  // Abstract methods to be implemented by concrete adapters
  protected abstract doInitialize(): Promise<void>;
  protected abstract doStart(): Promise<void>;
  protected abstract doStop(): Promise<void>;
  protected abstract doHealthCheck(): Promise<Record<string, any>>;
  protected abstract doConfigUpdate(config: Partial<AdapterConfig>): Promise<void>;
  protected abstract doValidateConfig(config: Partial<AdapterConfig>): Promise<boolean>;
  protected abstract doPing(): Promise<boolean>;
  protected abstract doUnsubscribe(subscriptionId: string): Promise<void>;

  // Abstract data operation methods
  abstract query(query: AdapterQuery): Promise<AdapterResult>;
  abstract insert(data: AdapterData): Promise<AdapterResult>;
  abstract update(filter: Record<string, any>, data: Record<string, any>): Promise<AdapterResult>;
  abstract delete(filter: Record<string, any>): Promise<AdapterResult>;
  abstract batchInsert(data: AdapterData[]): Promise<AdapterResult[]>;
  abstract batchUpdate(operations: Array<{ filter: Record<string, any>; data: Record<string, any> }>): Promise<AdapterResult[]>;
  abstract batchDelete(filters: Record<string, any>[]): Promise<AdapterResult[]>;
  abstract subscribe(callback: AdapterCallback, filter?: Record<string, any>): Promise<AdapterSubscription>;
  abstract unsubscribe(subscriptionId: string): Promise<void>;
  abstract beginTransaction(): Promise<AdapterTransaction>;
  abstract prepareTransaction(transaction: AdapterTransaction): Promise<boolean>;
  abstract commitTransaction(transaction: AdapterTransaction): Promise<void>;
  abstract rollbackTransaction(transaction: AdapterTransaction): Promise<void>;
}