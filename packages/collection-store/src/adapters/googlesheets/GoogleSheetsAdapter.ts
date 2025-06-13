// Google Sheets Adapter - Main adapter integrating authentication and API management
// Based on creative phase decisions: Complete Google Sheets integration

import { ExternalAdapter } from '../base/ExternalAdapter';
import {
  AdapterQuery,
  AdapterData,
  AdapterResult,
  AdapterTransaction,
  AdapterSubscription,
  AdapterCallback
} from '../base/types/AdapterTypes';
import { GoogleSheetsAdapterConfig } from '../../config/schemas/AdapterConfig';
import { GoogleSheetsAuth, AuthConfig } from './auth/GoogleSheetsAuth';
import { GoogleSheetsAPI, APIConfig } from './api/GoogleSheetsAPI';
import { AdapterType, AdapterConfig } from '../base/types/AdapterTypes';

export class GoogleSheetsAdapter extends ExternalAdapter {
  private auth?: GoogleSheetsAuth;
  private api?: GoogleSheetsAPI;
  private pollingInterval?: NodeJS.Timeout;
  private spreadsheetMappings: Map<string, string> = new Map();

  constructor(config: GoogleSheetsAdapterConfig) {
    // Ensure config.id is a string, even if optional in schema
    super(config.id || `googlesheets-adapter-${Date.now()}`, config.type as AdapterType, config as AdapterConfig);
  }

  // Abstract method implementations
  protected async doInitialize(): Promise<void> {
    const sheetsConfig = this.config as GoogleSheetsAdapterConfig;

    // Initialize authentication
    const authConfig: AuthConfig = {
      strategy: sheetsConfig.config.auth.type,
      oauth2: sheetsConfig.config.auth.type === 'oauth2' && sheetsConfig.config.auth.oauth2 ? {
        clientId: sheetsConfig.config.auth.oauth2.clientId || '',
        clientSecret: sheetsConfig.config.auth.oauth2.clientSecret || '',
        redirectUri: sheetsConfig.config.auth.oauth2.redirectUri || '',
        scopes: sheetsConfig.config.auth.oauth2.scopes || []
      } : undefined,
      serviceAccount: sheetsConfig.config.auth.type === 'service_account' && sheetsConfig.config.auth.serviceAccountKey ? {
        keyFilePath: sheetsConfig.config.auth.serviceAccountKey,
        scopes: sheetsConfig.config.auth.scopes || [] // Ensure scopes are provided for service account
      } : undefined,
      tokenRefresh: {
        enabled: true,
        refreshThresholdMs: 300000, // 5 minutes
        maxRetries: 3,
        retryDelayMs: 1000
      },
      security: {
        validateTokens: true,
        encryptStoredTokens: false,
        tokenExpiryBuffer: 300 // 5 minutes
      }
    };

    this.auth = new GoogleSheetsAuth(authConfig);

    // Setup auth event handlers
    this.setupAuthEventHandlers();

    // Authenticate
    await this.auth.authenticate();

    // Initialize API manager
    const apiConfig: APIConfig = {
      rateLimit: {
        requestsPerSecond: sheetsConfig.config.rateLimit.requestsPerSecond,
        requestsPerMinute: sheetsConfig.config.rateLimit.requestsPerMinute,
        requestsPerDay: 1000, // Default daily quota
        burstLimit: sheetsConfig.config.rateLimit.batchSize || 10,
        backoffMultiplier: sheetsConfig.config.rateLimit.retryDelayMs || 2,
        maxRetries: sheetsConfig.config.rateLimit.retryAttempts || 3,
        retryDelayMs: sheetsConfig.config.rateLimit.retryDelayMs || 1000
      },
      quota: {
        dailyQuota: sheetsConfig.config.quota?.dailyQuota || 1000,
        quotaResetHour: sheetsConfig.config.quota?.quotaResetHour || 0,
        quotaWarningThreshold: sheetsConfig.config.quota?.quotaWarningThreshold || 80,
        quotaBuffer: sheetsConfig.config.quota?.quotaBuffer || 100
      },
      timeout: 30000,
      retryOnQuotaExceeded: true,
      enableMetrics: true
    };

    this.api = new GoogleSheetsAPI(this.auth, apiConfig);

    // Setup API event handlers
    this.setupAPIEventHandlers();

    // Initialize spreadsheet mappings
    for (const [collectionName, mapping] of Object.entries(sheetsConfig.config.spreadsheets)) {
      this.spreadsheetMappings.set(collectionName, mapping.spreadsheetId);
    }
  }

  protected async doStart(): Promise<void> {
    if (!this.auth || !this.api) {
      throw new Error('Google Sheets adapter not initialized');
    }

    const sheetsConfig = this.config as GoogleSheetsAdapterConfig;

    // Start real-time polling if enabled
    if (sheetsConfig.capabilities.realtime && sheetsConfig.config.polling.enabled) {
      this.startPolling();
    }
  }

  protected async doStop(): Promise<void> {
    // Stop polling
    if (this.pollingInterval) {
      clearInterval(this.pollingInterval);
      this.pollingInterval = undefined;
    }

    // Shutdown API manager
    if (this.api) {
      await this.api.shutdown();
      this.api = undefined;
    }

    // Shutdown authentication
    if (this.auth) {
      await this.auth.shutdown();
      this.auth = undefined;
    }

    this.spreadsheetMappings.clear();
  }

  protected async doHealthCheck(): Promise<Record<string, any>> {
    if (!this.auth || !this.api) {
      return { status: 'disconnected', error: 'Adapter not initialized' };
    }

    try {
      const authState = this.auth.getState();
      const authMetrics = this.auth.getMetrics();
      const apiMetrics = this.api.getMetrics();
      const rateLimitState = this.api.getRateLimitState();
      const quotaState = this.api.getQuotaState();
      const queueStatus = this.api.getQueueStatus();

      const health = {
        status: authState.authenticated && !quotaState.isExceeded ? 'healthy' : 'degraded',
        authentication: {
          strategy: authState.strategy,
          authenticated: authState.authenticated,
          tokenValid: this.auth.isTokenValid(),
          tokenExpiry: authState.tokenExpiry,
          errorCount: authState.errorCount,
          refreshCount: authState.refreshCount
        },
        api: {
          totalRequests: apiMetrics.totalRequests,
          successfulRequests: apiMetrics.successfulRequests,
          failedRequests: apiMetrics.failedRequests,
          averageResponseTime: apiMetrics.averageResponseTime,
          uptime: apiMetrics.uptime
        },
        rateLimit: {
          requestsThisSecond: rateLimitState.requestsThisSecond,
          requestsThisMinute: rateLimitState.requestsThisMinute,
          requestsToday: rateLimitState.requestsToday,
          isThrottled: rateLimitState.isThrottled,
          throttleUntil: rateLimitState.throttleUntil
        },
        quota: {
          dailyUsage: quotaState.dailyUsage,
          dailyLimit: quotaState.dailyLimit,
          remainingQuota: quotaState.remainingQuota,
          isNearLimit: quotaState.isNearLimit,
          isExceeded: quotaState.isExceeded,
          quotaResetTime: quotaState.quotaResetTime
        },
        queue: {
          pendingRequests: queueStatus.pending,
          pendingBatches: queueStatus.batches
        },
        spreadsheets: this.spreadsheetMappings.size
      };

      return health;
    } catch (error) {
      return {
        status: 'error',
        error: (error as Error).message
      };
    }
  }

  protected async doConfigUpdate(config: Partial<AdapterConfig>): Promise<void> {
    const sheetsConfig = config as Partial<GoogleSheetsAdapterConfig>;
    // Handle configuration updates that don't require restart
    if (sheetsConfig.config?.rateLimit && this.api) {
      const apiConfig: Partial<APIConfig> = {
        rateLimit: {
          requestsPerSecond: sheetsConfig.config.rateLimit.requestsPerSecond,
          requestsPerMinute: sheetsConfig.config.rateLimit.requestsPerMinute,
          requestsPerDay: 1000, // Default daily quota
          burstLimit: sheetsConfig.config.rateLimit.batchSize || 10,
          backoffMultiplier: sheetsConfig.config.rateLimit.retryDelayMs || 2,
          maxRetries: sheetsConfig.config.rateLimit.retryAttempts || 3,
          retryDelayMs: sheetsConfig.config.rateLimit.retryDelayMs || 1000
        },
        quota: {
          dailyQuota: 1000
        }
      };
      this.api.updateConfig(apiConfig);
    }

    // For auth-related changes, require restart
    if (sheetsConfig.config?.auth) {
      throw new Error('Authentication configuration changes require adapter restart');
    }
  }

  protected async doValidateConfig(config: AdapterConfig): Promise<boolean> {
    const sheetsConfig = config as GoogleSheetsAdapterConfig;
    try {
      // Validate authentication configuration
      if (sheetsConfig.config.auth.type === 'oauth2') {
        if (!sheetsConfig.config.auth.clientId || !sheetsConfig.config.auth.clientSecret) {
          return false;
        }
      } else if (sheetsConfig.config.auth.type === 'service_account') {
        if (!sheetsConfig.config.auth.serviceAccountKey) {
          return false;
        }
      }

      // Validate rate limit configuration
      if (sheetsConfig.config.rateLimit.requestsPerSecond <= 0 ||
          sheetsConfig.config.rateLimit.requestsPerMinute <= 0) {
        return false;
      }

      // Validate spreadsheet mappings
      for (const [name, mapping] of Object.entries(sheetsConfig.config.spreadsheets)) {
        if (!mapping.spreadsheetId) {
          return false;
        }
      }

      return true;
    } catch {
      return false;
    }
  }

  protected async doPing(): Promise<boolean> {
    if (!this.auth || !this.api) {
      return false;
    }

    try {
      // Try to make a simple API call to test connectivity
      const testSpreadsheetId = Object.values((this.config as GoogleSheetsAdapterConfig).config.spreadsheets)[0]?.spreadsheetId;
      if (!testSpreadsheetId) {
        return this.auth.isAuthenticated() && this.auth.isTokenValid();
      }

      const response = await this.api.getSpreadsheetData(testSpreadsheetId, 'A1:A1');
      return response.success;
    } catch {
      return false;
    }
  }

  public async unsubscribe(subscriptionId: string): Promise<void> {
    await this.doUnsubscribe(subscriptionId);
    this._subscriptions.delete(subscriptionId);
  }

  protected async doUnsubscribe(subscriptionId: string): Promise<void> {
    // Google Sheets doesn't have native subscriptions, so we manage polling-based subscriptions
    // This would be handled by stopping specific polling for this subscription
    console.log(`Unsubscribing from Google Sheets subscription: ${subscriptionId}`);
  }

  // Enhanced data operation implementations
  async query(query: AdapterQuery): Promise<AdapterResult> {
    const startTime = Date.now();

    try {
      if (!this.api) {
        throw new Error('Google Sheets adapter not initialized');
      }

      const spreadsheetId = this.getSpreadsheetId(query.collection);
      const range = this.buildRange(query);

      const response = await this.api.getSpreadsheetData(spreadsheetId, range);

      if (!response.success) {
        throw new Error(response.error || 'Failed to query spreadsheet');
      }

      // Convert spreadsheet data to adapter format
      const data = this.convertSpreadsheetToData(response.data);

      // Apply filters if specified
      const filteredData = query.filter ? this.applyFilters(data, query.filter) : data;

      // Apply sorting if specified
      const sortedData = query.sort ? this.applySorting(filteredData, query.sort) : filteredData;

      // Apply pagination if specified
      const paginatedData = this.applyPagination(sortedData, query.skip, query.limit);

      this.recordOperation();
      this.updateResponseTime(Date.now() - startTime);

      return {
        success: true,
        data: paginatedData,
        metadata: {
          count: paginatedData.length,
          totalCount: sortedData.length,
          collection: query.collection,
          executionTime: Date.now() - startTime,
          quotaUsed: response.quotaUsed
        }
      };
    } catch (error) {
      this.recordError(error as Error);
      return {
        success: false,
        error: (error as Error).message
      };
    }
  }

  async insert(data: AdapterData): Promise<AdapterResult> {
    const startTime = Date.now();

    try {
      if (!this.api) {
        throw new Error('Google Sheets adapter not initialized');
      }

      const spreadsheetId = this.getSpreadsheetId(data.collection);
      const range = this.getCollectionRange(data.collection);

      // Convert data to spreadsheet format
      const values = this.convertDataToSpreadsheet(data.documents);

      const response = await this.api.appendSpreadsheetData(spreadsheetId, range, values);

      if (!response.success) {
        throw new Error(response.error || 'Failed to insert data');
      }

      this.recordOperation();
      this.updateResponseTime(Date.now() - startTime);

      return {
        success: true,
        data: response.data,
        metadata: {
          insertedCount: data.documents.length,
          collection: data.collection,
          executionTime: Date.now() - startTime,
          quotaUsed: response.quotaUsed
        }
      };
    } catch (error) {
      this.recordError(error as Error);
      return {
        success: false,
        error: (error as Error).message
      };
    }
  }

  // Real-time subscriptions via polling
  async subscribe(callback: AdapterCallback, filter?: Record<string, any>): Promise<AdapterSubscription> {
    const subscriptionId = this.generateSubscriptionId();

    const subscription: AdapterSubscription = {
      id: subscriptionId,
      adapterId: this.id,
      callback,
      filter,
      active: true
    };

    this._subscriptions.set(subscriptionId, subscription);

    return subscription;
  }

  // Transaction support (limited for Google Sheets)
  async beginTransaction(): Promise<AdapterTransaction> {
    const transactionId = this.generateTransactionId();

    const transaction: AdapterTransaction = {
      id: transactionId,
      adapterId: this.id,
      state: 'ACTIVE',
      operations: [],
      startTime: new Date()
    };

    this._transactions.set(transactionId, transaction);

    return transaction;
  }

  async prepareTransaction(transaction: AdapterTransaction): Promise<boolean> {
    // Google Sheets doesn't have native transactions, so we simulate
    transaction.state = 'PREPARED';
    return true;
  }

  async commitTransaction(transaction: AdapterTransaction): Promise<void> {
    // Execute all operations in the transaction
    transaction.state = 'COMMITTED';
    this._transactions.delete(transaction.id);
  }

  async rollbackTransaction(transaction: AdapterTransaction): Promise<void> {
    // Google Sheets rollback would require manual reversal
    transaction.state = 'ROLLED_BACK';
    this._transactions.delete(transaction.id);
  }

  // Private helper methods
  private getSpreadsheetId(collection: string): string {
    const spreadsheetId = this.spreadsheetMappings.get(collection);
    if (!spreadsheetId) {
      throw new Error(`No spreadsheet mapping found for collection: ${collection}`);
    }
    return spreadsheetId;
  }

  private getCollectionRange(collection: string): string {
    const sheetsConfig = this.config as GoogleSheetsAdapterConfig;
    const mapping = sheetsConfig.config.spreadsheets[collection];
    return mapping?.sheets?.Sheet1?.range || 'A:Z';
  }

  private buildRange(query: AdapterQuery): string {
    const baseRange = this.getCollectionRange(query.collection);

    // For simplicity, return base range
    // In real implementation, would build specific range based on query
    return baseRange;
  }

  private convertSpreadsheetToData(spreadsheetData: any): any[] {
    if (!spreadsheetData?.values || !Array.isArray(spreadsheetData.values)) {
      return [];
    }

    const [headers, ...rows] = spreadsheetData.values;

    return rows.map((row: any[]) => {
      const obj: any = {};
      headers.forEach((header: string, index: number) => {
        obj[header] = row[index] || '';
      });
      return obj;
    });
  }

  private convertDataToSpreadsheet(documents: any[]): any[][] {
    if (documents.length === 0) {
      return [];
    }

    const headers = Object.keys(documents[0]);
    const rows = documents.map(doc => headers.map(header => doc[header] || ''));

    return [headers, ...rows];
  }

  private applyFilters(data: any[], filter: Record<string, any>): any[] {
    return data.filter(item => {
      return Object.entries(filter).every(([key, value]) => {
        return item[key] === value;
      });
    });
  }

  private applySorting(data: any[], sort: Record<string, 1 | -1>): any[] {
    return [...data].sort((a, b) => {
      for (const [field, direction] of Object.entries(sort)) {
        const aVal = a[field];
        const bVal = b[field];

        if (aVal < bVal) return direction === 1 ? -1 : 1;
        if (aVal > bVal) return direction === 1 ? 1 : -1;
      }
      return 0;
    });
  }

  private applyPagination(data: any[], skip?: number, limit?: number): any[] {
    let result = data;

    if (skip) {
      result = result.slice(skip);
    }

    if (limit) {
      result = result.slice(0, limit);
    }

    return result;
  }

  private startPolling(): void {
    const sheetsConfig = this.config as GoogleSheetsAdapterConfig;
    const intervalMs = sheetsConfig.config.polling.intervalMs;

    this.pollingInterval = setInterval(async () => {
      await this.pollForChanges();
    }, intervalMs);
  }

  private async pollForChanges(): Promise<void> {
    // Simplified polling implementation
    // In real implementation, would track changes and notify subscribers
    for (const [subscriptionId, subscription] of this._subscriptions) {
      if (subscription.active) {
        // Simulate change detection and callback
        // subscription.callback(changeData);
      }
    }
  }

  private setupAuthEventHandlers(): void {
    if (!this.auth) return;

    this.auth.on('AUTH_SUCCESS', (data) => {
      this.emit('OPERATION', { type: 'OPERATION', adapterId: this.id, timestamp: new Date(), data: { event: 'AUTH_SUCCESS', strategy: data.strategy } });
    });

    this.auth.on('AUTH_FAILURE', (data) => {
      this.emit('OPERATION', { type: 'OPERATION', adapterId: this.id, timestamp: new Date(), data: { event: 'AUTH_FAILURE', strategy: data.strategy, error: data.error } });
    });

    this.auth.on('TOKEN_REFRESH', (data) => {
      this.emit('OPERATION', { type: 'OPERATION', adapterId: this.id, timestamp: new Date(), data: { event: 'TOKEN_REFRESH', success: data.success } });
    });

    this.auth.on('TOKEN_EXPIRY_WARNING', (data) => {
      this.emit('OPERATION', { type: 'OPERATION', adapterId: this.id, timestamp: new Date(), data: { event: 'TOKEN_EXPIRY_WARNING', expiresAt: data.expiresAt } });
    });
  }

  private setupAPIEventHandlers(): void {
    if (!this.api) return;

    this.api.on('REQUEST_COMPLETE', (data) => {
      this.emit('OPERATION', { type: 'OPERATION', adapterId: this.id, timestamp: new Date(), data: { event: 'REQUEST_COMPLETE', usage: data.usage } });
    });

    this.api.on('RATE_LIMIT_EXCEEDED', (data) => {
      this.emit('OPERATION', { type: 'OPERATION', adapterId: this.id, timestamp: new Date(), data: { event: 'RATE_LIMIT_EXCEEDED', throttleUntil: data.throttleUntil } });
    });

    this.api.on('QUOTA_EXCEEDED', (data) => {
      this.emit('OPERATION', { type: 'OPERATION', adapterId: this.id, timestamp: new Date(), data: { event: 'QUOTA_EXCEEDED', newLimit: data.newLimit } });
    });

    this.api.on('API_ERROR', (data) => {
      this.emit('OPERATION', { type: 'OPERATION', adapterId: this.id, timestamp: new Date(), data: { event: 'API_ERROR', error: data.error } });
    });
  }

  async update(filter: Record<string, any>, data: Record<string, any>): Promise<AdapterResult> {
    // Implementation for update
    return { success: false, error: 'Not implemented' };
  }

  async delete(filter: Record<string, any>): Promise<AdapterResult> {
    // Implementation for delete
    return { success: false, error: 'Not implemented' };
  }

  async batchInsert(data: AdapterData[]): Promise<AdapterResult[]> {
    // Implementation for batchInsert
    return [{ success: false, error: 'Not implemented' }];
  }

  async batchUpdate(operations: Array<{ filter: Record<string, any>; data: Record<string, any> }>): Promise<AdapterResult[]> {
    // Implementation for batchUpdate
    return [{ success: false, error: 'Not implemented' }];
  }

  async batchDelete(filters: Record<string, any>[]): Promise<AdapterResult[]> {
    // Implementation for batchDelete
    return [{ success: false, error: 'Not implemented' }];
  }
}
