// IExternalAdapter interface - unified interface for all external adapters
// Based on creative phase decisions: Layered architecture with lifecycle management

import {
  AdapterConfig,
  AdapterState,
  AdapterMetrics,
  AdapterHealth,
  AdapterQuery,
  AdapterData,
  AdapterResult,
  AdapterTransaction,
  AdapterOperation,
  AdapterSubscription,
  AdapterCallback,
  AdapterEvent,
  AdapterEventHandler
} from '../types/AdapterTypes';

export interface IExternalAdapter {
  // Identification
  readonly id: string;
  readonly type: string;
  readonly config: AdapterConfig;

  // State management
  readonly state: AdapterState;
  readonly metrics: AdapterMetrics;

  // Lifecycle methods
  initialize(): Promise<void>;
  start(): Promise<void>;
  stop(): Promise<void>;
  restart(): Promise<void>;

  // Health monitoring
  getHealth(): Promise<AdapterHealth>;
  isHealthy(): boolean;

  // Configuration management
  updateConfig(config: Partial<AdapterConfig>): Promise<void>;
  validateConfig(config: AdapterConfig): Promise<boolean>;

  // Data operations
  query(query: AdapterQuery): Promise<AdapterResult>;
  insert(data: AdapterData): Promise<AdapterResult>;
  update(filter: Record<string, any>, data: Record<string, any>): Promise<AdapterResult>;
  delete(filter: Record<string, any>): Promise<AdapterResult>;

  // Batch operations
  batchInsert(data: AdapterData[]): Promise<AdapterResult[]>;
  batchUpdate(operations: Array<{ filter: Record<string, any>; data: Record<string, any> }>): Promise<AdapterResult[]>;
  batchDelete(filters: Record<string, any>[]): Promise<AdapterResult[]>;

  // Real-time subscriptions
  subscribe(callback: AdapterCallback, filter?: Record<string, any>): Promise<AdapterSubscription>;
  unsubscribe(subscriptionId: string): Promise<void>;

  // Transaction support
  beginTransaction(): Promise<AdapterTransaction>;
  prepareTransaction(transaction: AdapterTransaction): Promise<boolean>;
  commitTransaction(transaction: AdapterTransaction): Promise<void>;
  rollbackTransaction(transaction: AdapterTransaction): Promise<void>;

  // Event handling
  on(event: string, handler: AdapterEventHandler): this;
  off(event: string, handler: AdapterEventHandler): this;
  emit(eventName: string | symbol, event: AdapterEvent): boolean;

  // Utility methods
  ping(): Promise<boolean>;
  getMetrics(): AdapterMetrics;
  resetMetrics(): void;
}