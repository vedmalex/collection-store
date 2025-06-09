// AdapterCoordinator - coordinates operations across multiple adapters
// Based on creative phase decisions: Orchestration layer for adapter coordination

import { EventEmitter } from 'events';
import { AdapterRegistry } from './AdapterRegistry';
import { IExternalAdapter } from '../../base/interfaces/IExternalAdapter';
import {
  AdapterQuery,
  AdapterData,
  AdapterResult,
  AdapterTransaction,
  AdapterOperation,
  AdapterType
} from '../../base/types/AdapterTypes';

export interface CoordinationConfig {
  parallelOperations: boolean;
  timeoutMs: number;
  retryAttempts: number;
  retryDelayMs: number;
}

export interface CrossAdapterOperation {
  id: string;
  type: 'QUERY' | 'INSERT' | 'UPDATE' | 'DELETE' | 'BATCH';
  adapters: string[];
  data?: any;
  filter?: Record<string, any>;
  timeout?: number;
}

export interface CrossAdapterResult {
  operationId: string;
  success: boolean;
  results: Map<string, AdapterResult>;
  errors: Map<string, string>;
  duration: number;
}

export interface CrossAdapterTransaction {
  id: string;
  adapters: string[];
  operations: CrossAdapterOperation[];
  state: 'ACTIVE' | 'PREPARING' | 'PREPARED' | 'COMMITTING' | 'COMMITTED' | 'ROLLING_BACK' | 'ROLLED_BACK';
  startTime: Date;
  adapterTransactions: Map<string, AdapterTransaction>;
}

export class AdapterCoordinator extends EventEmitter {
  private activeTransactions: Map<string, CrossAdapterTransaction> = new Map();
  private operationCounter = 0;
  private transactionCounter = 0;

  constructor(
    private registry: AdapterRegistry,
    private config: CoordinationConfig
  ) {
    super();
  }

  // Single adapter operations
  async executeQuery(adapterId: string, query: AdapterQuery): Promise<AdapterResult> {
    const adapter = this.registry.getAdapter(adapterId);
    if (!adapter) {
      throw new Error(`Adapter '${adapterId}' not found`);
    }

    return this.executeWithTimeout(
      () => adapter.query(query),
      this.config.timeoutMs,
      `Query operation on adapter '${adapterId}'`
    );
  }

  async executeInsert(adapterId: string, data: AdapterData): Promise<AdapterResult> {
    const adapter = this.registry.getAdapter(adapterId);
    if (!adapter) {
      throw new Error(`Adapter '${adapterId}' not found`);
    }

    return this.executeWithTimeout(
      () => adapter.insert(data),
      this.config.timeoutMs,
      `Insert operation on adapter '${adapterId}'`
    );
  }

  async executeUpdate(adapterId: string, filter: Record<string, any>, data: Record<string, any>): Promise<AdapterResult> {
    const adapter = this.registry.getAdapter(adapterId);
    if (!adapter) {
      throw new Error(`Adapter '${adapterId}' not found`);
    }

    return this.executeWithTimeout(
      () => adapter.update(filter, data),
      this.config.timeoutMs,
      `Update operation on adapter '${adapterId}'`
    );
  }

  async executeDelete(adapterId: string, filter: Record<string, any>): Promise<AdapterResult> {
    const adapter = this.registry.getAdapter(adapterId);
    if (!adapter) {
      throw new Error(`Adapter '${adapterId}' not found`);
    }

    return this.executeWithTimeout(
      () => adapter.delete(filter),
      this.config.timeoutMs,
      `Delete operation on adapter '${adapterId}'`
    );
  }

  // Cross-adapter operations
  async executeCrossAdapterQuery(adapterIds: string[], query: AdapterQuery): Promise<CrossAdapterResult> {
    const operationId = this.generateOperationId();
    const startTime = Date.now();

    const operation: CrossAdapterOperation = {
      id: operationId,
      type: 'QUERY',
      adapters: adapterIds,
      data: query
    };

    return this.executeCrossAdapterOperation(operation, startTime);
  }

  async executeCrossAdapterInsert(adapterIds: string[], data: AdapterData): Promise<CrossAdapterResult> {
    const operationId = this.generateOperationId();
    const startTime = Date.now();

    const operation: CrossAdapterOperation = {
      id: operationId,
      type: 'INSERT',
      adapters: adapterIds,
      data
    };

    return this.executeCrossAdapterOperation(operation, startTime);
  }

  async executeCrossAdapterUpdate(
    adapterIds: string[],
    filter: Record<string, any>,
    data: Record<string, any>
  ): Promise<CrossAdapterResult> {
    const operationId = this.generateOperationId();
    const startTime = Date.now();

    const operation: CrossAdapterOperation = {
      id: operationId,
      type: 'UPDATE',
      adapters: adapterIds,
      filter,
      data
    };

    return this.executeCrossAdapterOperation(operation, startTime);
  }

  async executeCrossAdapterDelete(adapterIds: string[], filter: Record<string, any>): Promise<CrossAdapterResult> {
    const operationId = this.generateOperationId();
    const startTime = Date.now();

    const operation: CrossAdapterOperation = {
      id: operationId,
      type: 'DELETE',
      adapters: adapterIds,
      filter
    };

    return this.executeCrossAdapterOperation(operation, startTime);
  }

  // Transaction management
  async beginCrossAdapterTransaction(adapterIds: string[]): Promise<CrossAdapterTransaction> {
    const transactionId = this.generateTransactionId();

    const transaction: CrossAdapterTransaction = {
      id: transactionId,
      adapters: adapterIds,
      operations: [],
      state: 'ACTIVE',
      startTime: new Date(),
      adapterTransactions: new Map()
    };

    // Begin transaction on each adapter
    for (const adapterId of adapterIds) {
      const adapter = this.registry.getAdapter(adapterId);
      if (!adapter) {
        throw new Error(`Adapter '${adapterId}' not found`);
      }

      if (!adapter.config.capabilities.transactions) {
        throw new Error(`Adapter '${adapterId}' does not support transactions`);
      }

      const adapterTx = await adapter.beginTransaction();
      transaction.adapterTransactions.set(adapterId, adapterTx);
    }

    this.activeTransactions.set(transactionId, transaction);
    this.emit('transaction-started', { transactionId, adapters: adapterIds });

    return transaction;
  }

  async commitCrossAdapterTransaction(transactionId: string): Promise<void> {
    const transaction = this.activeTransactions.get(transactionId);
    if (!transaction) {
      throw new Error(`Transaction '${transactionId}' not found`);
    }

    if (transaction.state !== 'ACTIVE' && transaction.state !== 'PREPARED') {
      throw new Error(`Transaction '${transactionId}' is not in a committable state: ${transaction.state}`);
    }

    try {
      // Phase 1: Prepare all adapters
      transaction.state = 'PREPARING';
      const prepareResults = new Map<string, boolean>();

      for (const [adapterId, adapterTx] of transaction.adapterTransactions) {
        const adapter = this.registry.getAdapter(adapterId);
        if (!adapter) {
          throw new Error(`Adapter '${adapterId}' not found during commit`);
        }

        const prepared = await adapter.prepareTransaction(adapterTx);
        prepareResults.set(adapterId, prepared);

        if (!prepared) {
          throw new Error(`Adapter '${adapterId}' failed to prepare transaction`);
        }
      }

      transaction.state = 'PREPARED';

      // Phase 2: Commit all adapters
      transaction.state = 'COMMITTING';

      for (const [adapterId, adapterTx] of transaction.adapterTransactions) {
        const adapter = this.registry.getAdapter(adapterId);
        if (!adapter) {
          throw new Error(`Adapter '${adapterId}' not found during commit`);
        }

        await adapter.commitTransaction(adapterTx);
      }

      transaction.state = 'COMMITTED';
      this.activeTransactions.delete(transactionId);

      this.emit('transaction-committed', {
        transactionId,
        adapters: transaction.adapters,
        duration: Date.now() - transaction.startTime.getTime()
      });

    } catch (error) {
      // Rollback on any failure
      await this.rollbackCrossAdapterTransaction(transactionId);
      throw error;
    }
  }

  async rollbackCrossAdapterTransaction(transactionId: string): Promise<void> {
    const transaction = this.activeTransactions.get(transactionId);
    if (!transaction) {
      throw new Error(`Transaction '${transactionId}' not found`);
    }

    transaction.state = 'ROLLING_BACK';

    const rollbackErrors: string[] = [];

    for (const [adapterId, adapterTx] of transaction.adapterTransactions) {
      try {
        const adapter = this.registry.getAdapter(adapterId);
        if (adapter) {
          await adapter.rollbackTransaction(adapterTx);
        }
      } catch (error) {
        rollbackErrors.push(`Failed to rollback adapter '${adapterId}': ${(error as Error).message}`);
      }
    }

    transaction.state = 'ROLLED_BACK';
    this.activeTransactions.delete(transactionId);

    this.emit('transaction-rolled-back', {
      transactionId,
      adapters: transaction.adapters,
      errors: rollbackErrors,
      duration: Date.now() - transaction.startTime.getTime()
    });

    if (rollbackErrors.length > 0) {
      throw new Error(`Rollback completed with errors: ${rollbackErrors.join(', ')}`);
    }
  }

  // Adapter discovery and routing
  getAdaptersByType(type: AdapterType): IExternalAdapter[] {
    return this.registry.getAdaptersByType(type);
  }

  getActiveAdapters(): IExternalAdapter[] {
    return this.registry.getActiveAdapters();
  }

  // Utility methods
  async ping(adapterId: string): Promise<boolean> {
    const adapter = this.registry.getAdapter(adapterId);
    if (!adapter) {
      return false;
    }

    return adapter.ping();
  }

  async pingAll(): Promise<Map<string, boolean>> {
    const results = new Map<string, boolean>();
    const adapters = this.registry.getAllAdapters();

    if (this.config.parallelOperations) {
      const pingPromises = adapters.map(async adapter => {
        const result = await adapter.ping();
        return { id: adapter.id, result };
      });

      const pingResults = await Promise.all(pingPromises);
      for (const { id, result } of pingResults) {
        results.set(id, result);
      }
    } else {
      for (const adapter of adapters) {
        const result = await adapter.ping();
        results.set(adapter.id, result);
      }
    }

    return results;
  }

  // Private methods
  private async executeCrossAdapterOperation(
    operation: CrossAdapterOperation,
    startTime: number
  ): Promise<CrossAdapterResult> {
    const results = new Map<string, AdapterResult>();
    const errors = new Map<string, string>();

    const executeOnAdapter = async (adapterId: string): Promise<void> => {
      try {
        const adapter = this.registry.getAdapter(adapterId);
        if (!adapter) {
          throw new Error(`Adapter '${adapterId}' not found`);
        }

        let result: AdapterResult;

        switch (operation.type) {
          case 'QUERY':
            result = await adapter.query(operation.data as AdapterQuery);
            break;
          case 'INSERT':
            result = await adapter.insert(operation.data as AdapterData);
            break;
          case 'UPDATE':
            result = await adapter.update(operation.filter!, operation.data);
            break;
          case 'DELETE':
            result = await adapter.delete(operation.filter!);
            break;
          default:
            throw new Error(`Unsupported operation type: ${operation.type}`);
        }

        results.set(adapterId, result);
      } catch (error) {
        errors.set(adapterId, (error as Error).message);
      }
    };

    if (this.config.parallelOperations) {
      const promises = operation.adapters.map(executeOnAdapter);
      await Promise.all(promises);
    } else {
      for (const adapterId of operation.adapters) {
        await executeOnAdapter(adapterId);
      }
    }

    const duration = Date.now() - startTime;
    const success = errors.size === 0;

    const result: CrossAdapterResult = {
      operationId: operation.id,
      success,
      results,
      errors,
      duration
    };

    this.emit('cross-adapter-operation-completed', result);

    return result;
  }

  private async executeWithTimeout<T>(
    operation: () => Promise<T>,
    timeoutMs: number,
    operationName: string
  ): Promise<T> {
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error(`${operationName} timed out after ${timeoutMs}ms`));
      }, timeoutMs);

      operation()
        .then(result => {
          clearTimeout(timeout);
          resolve(result);
        })
        .catch(error => {
          clearTimeout(timeout);
          reject(error);
        });
    });
  }

  private generateOperationId(): string {
    return `op_${++this.operationCounter}_${Date.now()}`;
  }

  private generateTransactionId(): string {
    return `tx_${++this.transactionCounter}_${Date.now()}`;
  }

  // Cleanup
  async shutdown(): Promise<void> {
    // Rollback all active transactions
    const rollbackPromises = Array.from(this.activeTransactions.keys()).map(txId =>
      this.rollbackCrossAdapterTransaction(txId).catch(error => ({
        transactionId: txId,
        error: (error as Error).message
      }))
    );

    await Promise.all(rollbackPromises);
    this.activeTransactions.clear();

    this.emit('coordinator-shutdown');
  }
}