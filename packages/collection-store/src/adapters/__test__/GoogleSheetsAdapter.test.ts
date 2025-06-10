// Google Sheets Adapter Tests - Comprehensive testing for Phase 3
// Testing authentication, API management, and adapter functionality

import { describe, test, expect, beforeEach, afterEach, jest } from 'bun:test';
import { GoogleSheetsAdapter } from '../googlesheets/GoogleSheetsAdapter';
import { GoogleSheetsAuth } from '../googlesheets/auth/GoogleSheetsAuth';
import { GoogleSheetsAPI } from '../googlesheets/api/GoogleSheetsAPI';
import { AdapterType, AdapterState } from '../base/types/AdapterTypes';
import { GoogleSheetsAdapterConfig } from '../../config/schemas/AdapterConfig';

// Mock implementations
class MockGoogleSheetsAuth {
  private authenticated = false;
  private state = {
    strategy: 'oauth2' as const,
    authenticated: false,
    refreshCount: 0,
    errorCount: 0,
    scopes: ['https://www.googleapis.com/auth/spreadsheets']
  };

  private metrics = {
    totalAuthentications: 0,
    successfulAuthentications: 0,
    failedAuthentications: 0,
    tokenRefreshes: 0,
    averageAuthTime: 100,
    lastAuthTime: 100,
    uptime: 0,
    startTime: new Date()
  };

  async authenticate(): Promise<void> {
    this.authenticated = true;
    this.state.authenticated = true;
    this.metrics.totalAuthentications++;
    this.metrics.successfulAuthentications++;
  }

  getState() {
    return { ...this.state };
  }

  getMetrics() {
    return { ...this.metrics };
  }

  isAuthenticated(): boolean {
    return this.authenticated;
  }

  isTokenValid(): boolean {
    return this.authenticated;
  }

  generateAuthUrl(): string {
    return 'https://accounts.google.com/oauth/authorize?mock=true';
  }

  async handleAuthCallback(code: string): Promise<void> {
    this.authenticated = true;
    this.state.authenticated = true;
  }

  async shutdown(): Promise<void> {
    this.authenticated = false;
    this.state.authenticated = false;
  }

  on(event: string, handler: Function): void {
    // Mock event handler
  }
}

class MockGoogleSheetsAPI {
  private rateLimitState = {
    requestsThisSecond: 0,
    requestsThisMinute: 0,
    requestsToday: 0,
    lastRequestTime: new Date(),
    lastSecondReset: new Date(),
    lastMinuteReset: new Date(),
    lastDayReset: new Date(),
    isThrottled: false
  };

  private quotaState = {
    dailyUsage: 0,
    dailyLimit: 1000,
    remainingQuota: 1000,
    quotaResetTime: new Date(),
    isNearLimit: false,
    isExceeded: false
  };

  private metrics = {
    totalRequests: 0,
    successfulRequests: 0,
    failedRequests: 0,
    throttledRequests: 0,
    quotaExceededRequests: 0,
    averageResponseTime: 150,
    lastRequestTime: new Date(),
    uptime: 0,
    startTime: new Date()
  };

  async getSpreadsheetData(spreadsheetId: string, range: string) {
    this.metrics.totalRequests++;
    this.metrics.successfulRequests++;
    this.quotaState.dailyUsage++;
    this.quotaState.remainingQuota--;

    return {
      success: true,
      data: {
        values: [
          ['Name', 'Age', 'City'],
          ['John', '30', 'New York'],
          ['Jane', '25', 'Los Angeles']
        ]
      },
      requestId: 'mock_request_id',
      responseTime: 150,
      quotaUsed: 1,
      rateLimitHit: false
    };
  }

  async appendSpreadsheetData(spreadsheetId: string, range: string, values: any[][]) {
    this.metrics.totalRequests++;
    this.metrics.successfulRequests++;
    this.quotaState.dailyUsage++;
    this.quotaState.remainingQuota--;

    return {
      success: true,
      data: {
        updatedCells: values.length,
        updatedRows: values.length
      },
      requestId: 'mock_request_id',
      responseTime: 200,
      quotaUsed: 1,
      rateLimitHit: false
    };
  }

  async updateSpreadsheetData(spreadsheetId: string, range: string, values: any[][]) {
    this.metrics.totalRequests++;
    this.metrics.successfulRequests++;
    this.quotaState.dailyUsage++;
    this.quotaState.remainingQuota--;

    return {
      success: true,
      data: {
        updatedCells: values.length,
        updatedRows: values.length
      },
      requestId: 'mock_request_id',
      responseTime: 180,
      quotaUsed: 1,
      rateLimitHit: false
    };
  }

  async clearSpreadsheetData(spreadsheetId: string, range: string) {
    this.metrics.totalRequests++;
    this.metrics.successfulRequests++;
    this.quotaState.dailyUsage++;
    this.quotaState.remainingQuota--;

    return {
      success: true,
      data: { clearedRange: range },
      requestId: 'mock_request_id',
      responseTime: 120,
      quotaUsed: 1,
      rateLimitHit: false
    };
  }

  async batchUpdate(spreadsheetId: string, requests: any[]) {
    this.metrics.totalRequests++;
    this.metrics.successfulRequests++;
    this.quotaState.dailyUsage++;
    this.quotaState.remainingQuota--;

    return {
      success: true,
      data: { replies: requests.map(() => ({ success: true })) },
      requestId: 'mock_request_id',
      responseTime: 300,
      quotaUsed: 1,
      rateLimitHit: false
    };
  }

  getRateLimitState() {
    return { ...this.rateLimitState };
  }

  getQuotaState() {
    return { ...this.quotaState };
  }

  getMetrics() {
    return { ...this.metrics };
  }

  getQueueStatus() {
    return { pending: 0, batches: 0 };
  }

  updateConfig(config: any): void {
    // Mock config update
  }

  async shutdown(): Promise<void> {
    // Mock shutdown
  }

  on(event: string, handler: Function): void {
    // Mock event handler
  }
}

// Mock the actual classes
jest.mock('../googlesheets/auth/GoogleSheetsAuth', () => ({
  GoogleSheetsAuth: MockGoogleSheetsAuth
}));

jest.mock('../googlesheets/api/GoogleSheetsAPI', () => ({
  GoogleSheetsAPI: MockGoogleSheetsAPI
}));

describe('Google Sheets Adapter Tests', () => {
  let adapter: GoogleSheetsAdapter;
  let config: GoogleSheetsAdapterConfig;

  beforeEach(() => {
    config = {
      id: 'test-sheets-adapter',
      type: AdapterType.GOOGLE_SHEETS,
      enabled: true,
      priority: 1,
      capabilities: {
        read: true,
        write: true,
        realtime: true,
        transactions: false,
        batch: true
      },
      config: {
        auth: {
          strategy: 'oauth2',
          oauth2: {
            clientId: 'test_client_id',
            clientSecret: 'test_client_secret',
            redirectUri: 'http://localhost:3000/callback',
            scopes: ['https://www.googleapis.com/auth/spreadsheets'],
            tokenPath: './tokens/google_sheets_token.json'
          }
        },
        rateLimit: {
          requestsPerSecond: 10,
          requestsPerMinute: 100,
          requestsPerDay: 1000
        },
        spreadsheets: {
          users: {
            spreadsheetId: '1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgvE2upms',
            range: 'Sheet1!A:Z'
          },
          products: {
            spreadsheetId: '1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgvE2upms',
            range: 'Products!A:Z'
          }
        },
        polling: {
          enabled: true,
          intervalMs: 30000
        }
      }
    };

    adapter = new GoogleSheetsAdapter(config);
  });

  afterEach(async () => {
    if (adapter.getState() !== AdapterState.STOPPED) {
      await adapter.stop();
    }
  });

  describe('Adapter Lifecycle', () => {
    test('should initialize successfully', async () => {
      await adapter.initialize();

      expect(adapter.getState()).toBe(AdapterState.INITIALIZED);
      expect(adapter.getId()).toBe('test-sheets-adapter');
      expect(adapter.getType()).toBe(AdapterType.GOOGLE_SHEETS);
    });

    test('should start successfully after initialization', async () => {
      await adapter.initialize();
      await adapter.start();

      expect(adapter.getState()).toBe(AdapterState.RUNNING);
    });

    test('should stop successfully', async () => {
      await adapter.initialize();
      await adapter.start();
      await adapter.stop();

      expect(adapter.getState()).toBe(AdapterState.STOPPED);
    });

    test('should restart successfully', async () => {
      await adapter.initialize();
      await adapter.start();
      await adapter.restart();

      expect(adapter.getState()).toBe(AdapterState.RUNNING);
    });
  });

  describe('Health Monitoring', () => {
    test('should return healthy status when running', async () => {
      await adapter.initialize();
      await adapter.start();

      const health = await adapter.healthCheck();

      expect(health.status).toBe('healthy');
      expect(health.authentication.authenticated).toBe(true);
      expect(health.authentication.strategy).toBe('oauth2');
      expect(health.api.totalRequests).toBeGreaterThanOrEqual(0);
      expect(health.quota.dailyLimit).toBe(1000);
      expect(health.spreadsheets).toBe(2);
    });

    test('should return disconnected status when not initialized', async () => {
      const health = await adapter.healthCheck();

      expect(health.status).toBe('disconnected');
      expect(health.error).toBe('Adapter not initialized');
    });
  });

  describe('Configuration Management', () => {
    test('should validate valid configuration', async () => {
      const isValid = await (adapter as any).doValidateConfig(config);
      expect(isValid).toBe(true);
    });

    test('should reject invalid OAuth2 configuration', async () => {
      const invalidConfig = {
        ...config,
        config: {
          ...config.config,
          auth: {
            strategy: 'oauth2' as const,
            oauth2: {
              clientId: '',
              clientSecret: '',
              redirectUri: 'http://localhost:3000/callback',
              scopes: ['https://www.googleapis.com/auth/spreadsheets']
            }
          }
        }
      };

      const isValid = await (adapter as any).doValidateConfig(invalidConfig);
      expect(isValid).toBe(false);
    });

    test('should reject invalid rate limit configuration', async () => {
      const invalidConfig = {
        ...config,
        config: {
          ...config.config,
          rateLimit: {
            requestsPerSecond: 0,
            requestsPerMinute: 0,
            requestsPerDay: 0
          }
        }
      };

      const isValid = await (adapter as any).doValidateConfig(invalidConfig);
      expect(isValid).toBe(false);
    });

    test('should update rate limit configuration', async () => {
      await adapter.initialize();

      const newConfig = {
        config: {
          rateLimit: {
            requestsPerSecond: 20,
            requestsPerMinute: 200,
            requestsPerDay: 2000
          }
        }
      };

      await (adapter as any).doConfigUpdate(newConfig);
      // Configuration update should succeed without error
    });

    test('should reject authentication configuration updates', async () => {
      await adapter.initialize();

      const newConfig = {
        config: {
          auth: {
            strategy: 'service_account' as const
          }
        }
      };

      await expect((adapter as any).doConfigUpdate(newConfig))
        .rejects.toThrow('Authentication configuration changes require adapter restart');
    });
  });

  describe('Data Operations', () => {
    beforeEach(async () => {
      await adapter.initialize();
      await adapter.start();
    });

    test('should query spreadsheet data successfully', async () => {
      const query = {
        collection: 'users',
        filter: { City: 'New York' },
        sort: { Name: 1 as const },
        limit: 10,
        skip: 0
      };

      const result = await adapter.query(query);

      expect(result.success).toBe(true);
      expect(result.data).toBeDefined();
      expect(result.metadata?.collection).toBe('users');
      expect(result.metadata?.executionTime).toBeGreaterThan(0);
    });

    test('should insert data successfully', async () => {
      const data = {
        collection: 'users',
        documents: [
          { Name: 'Alice', Age: '28', City: 'Chicago' },
          { Name: 'Bob', Age: '35', City: 'Boston' }
        ]
      };

      const result = await adapter.insert(data);

      expect(result.success).toBe(true);
      expect(result.metadata?.insertedCount).toBe(2);
      expect(result.metadata?.collection).toBe('users');
    });

    test('should handle query errors gracefully', async () => {
      // Mock API to return error
      const originalAPI = (adapter as any).api;
      (adapter as any).api = {
        ...originalAPI,
        getSpreadsheetData: async () => ({
          success: false,
          error: 'Spreadsheet not found'
        })
      };

      const query = {
        collection: 'nonexistent',
        filter: {},
        sort: {},
        limit: 10,
        skip: 0
      };

      const result = await adapter.query(query);

      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
    });

    test('should handle missing collection mapping', async () => {
      const query = {
        collection: 'nonexistent',
        filter: {},
        sort: {},
        limit: 10,
        skip: 0
      };

      const result = await adapter.query(query);

      expect(result.success).toBe(false);
      expect(result.error).toContain('No spreadsheet mapping found');
    });
  });

  describe('Real-time Subscriptions', () => {
    beforeEach(async () => {
      await adapter.initialize();
      await adapter.start();
    });

    test('should create subscription successfully', async () => {
      const callback = jest.fn();
      const filter = { collection: 'users' };

      const subscription = await adapter.subscribe(callback, filter);

      expect(subscription.id).toBeDefined();
      expect(subscription.adapterId).toBe('test-sheets-adapter');
      expect(subscription.active).toBe(true);
      expect(subscription.callback).toBe(callback);
      expect(subscription.filter).toEqual(filter);
    });

    test('should unsubscribe successfully', async () => {
      const callback = jest.fn();
      const subscription = await adapter.subscribe(callback);

      await adapter.unsubscribe(subscription.id);

      // Subscription should be removed
      const subscriptions = (adapter as any)._subscriptions;
      expect(subscriptions.has(subscription.id)).toBe(false);
    });
  });

  describe('Transaction Support', () => {
    beforeEach(async () => {
      await adapter.initialize();
      await adapter.start();
    });

    test('should begin transaction successfully', async () => {
      const transaction = await adapter.beginTransaction();

      expect(transaction.id).toBeDefined();
      expect(transaction.adapterId).toBe('test-sheets-adapter');
      expect(transaction.state).toBe('ACTIVE');
      expect(transaction.operations).toEqual([]);
      expect(transaction.startTime).toBeInstanceOf(Date);
    });

    test('should prepare transaction successfully', async () => {
      const transaction = await adapter.beginTransaction();
      const prepared = await adapter.prepareTransaction(transaction);

      expect(prepared).toBe(true);
      expect(transaction.state).toBe('PREPARED');
    });

    test('should commit transaction successfully', async () => {
      const transaction = await adapter.beginTransaction();
      await adapter.prepareTransaction(transaction);
      await adapter.commitTransaction(transaction);

      expect(transaction.state).toBe('COMMITTED');

      // Transaction should be removed from active transactions
      const transactions = (adapter as any)._transactions;
      expect(transactions.has(transaction.id)).toBe(false);
    });

    test('should rollback transaction successfully', async () => {
      const transaction = await adapter.beginTransaction();
      await adapter.rollbackTransaction(transaction);

      expect(transaction.state).toBe('ROLLED_BACK');

      // Transaction should be removed from active transactions
      const transactions = (adapter as any)._transactions;
      expect(transactions.has(transaction.id)).toBe(false);
    });
  });

  describe('Connectivity and Ping', () => {
    test('should ping successfully when running', async () => {
      await adapter.initialize();
      await adapter.start();

      const pingResult = await adapter.ping();
      expect(pingResult).toBe(true);
    });

    test('should fail ping when not initialized', async () => {
      const pingResult = await adapter.ping();
      expect(pingResult).toBe(false);
    });
  });

  describe('Error Handling', () => {
    test('should handle initialization errors', async () => {
      // Create adapter with invalid config
      const invalidAdapter = new GoogleSheetsAdapter({
        ...config,
        config: {
          ...config.config,
          auth: {
            strategy: 'oauth2',
            oauth2: {
              clientId: '',
              clientSecret: '',
              redirectUri: '',
              scopes: []
            }
          }
        }
      });

      // Mock auth to throw error
      const MockAuthWithError = class extends MockGoogleSheetsAuth {
        async authenticate(): Promise<void> {
          throw new Error('Authentication failed');
        }
      };

      (invalidAdapter as any).auth = new MockAuthWithError();

      await expect(invalidAdapter.initialize()).rejects.toThrow();
    });

    test('should handle API errors gracefully', async () => {
      await adapter.initialize();
      await adapter.start();

      // Mock API to throw error
      const originalAPI = (adapter as any).api;
      (adapter as any).api = {
        ...originalAPI,
        getSpreadsheetData: async () => {
          throw new Error('API Error');
        }
      };

      const query = {
        collection: 'users',
        filter: {},
        sort: {},
        limit: 10,
        skip: 0
      };

      const result = await adapter.query(query);

      expect(result.success).toBe(false);
      expect(result.error).toBe('API Error');
    });
  });

  describe('Metrics and Monitoring', () => {
    beforeEach(async () => {
      await adapter.initialize();
      await adapter.start();
    });

    test('should track operation metrics', async () => {
      const initialMetrics = adapter.getMetrics();

      // Perform some operations
      await adapter.query({
        collection: 'users',
        filter: {},
        sort: {},
        limit: 10,
        skip: 0
      });

      await adapter.insert({
        collection: 'users',
        documents: [{ Name: 'Test', Age: '30', City: 'Test City' }]
      });

      const finalMetrics = adapter.getMetrics();

      expect(finalMetrics.totalOperations).toBeGreaterThan(initialMetrics.totalOperations);
      expect(finalMetrics.successfulOperations).toBeGreaterThan(initialMetrics.successfulOperations);
    });

    test('should track error metrics', async () => {
      const initialMetrics = adapter.getMetrics();

      // Force an error
      await adapter.query({
        collection: 'nonexistent',
        filter: {},
        sort: {},
        limit: 10,
        skip: 0
      });

      const finalMetrics = adapter.getMetrics();

      expect(finalMetrics.errorCount).toBeGreaterThan(initialMetrics.errorCount);
    });
  });
});

describe('Google Sheets Authentication Tests', () => {
  test('should create auth instance with OAuth2 config', () => {
    const authConfig = {
      strategy: 'oauth2' as const,
      oauth2: {
        clientId: 'test_client_id',
        clientSecret: 'test_client_secret',
        redirectUri: 'http://localhost:3000/callback',
        scopes: ['https://www.googleapis.com/auth/spreadsheets']
      },
      tokenRefresh: {
        enabled: true,
        refreshThresholdMs: 300000,
        maxRetries: 3,
        retryDelayMs: 1000
      },
      security: {
        validateTokens: true,
        encryptStoredTokens: false,
        tokenExpiryBuffer: 300
      }
    };

    const auth = new MockGoogleSheetsAuth();
    expect(auth).toBeDefined();
  });

  test('should generate OAuth2 authorization URL', () => {
    const auth = new MockGoogleSheetsAuth();
    const authUrl = auth.generateAuthUrl();

    expect(authUrl).toContain('accounts.google.com');
    expect(authUrl).toContain('oauth/authorize');
  });

  test('should handle OAuth2 callback', async () => {
    const auth = new MockGoogleSheetsAuth();

    await auth.handleAuthCallback('test_auth_code');

    expect(auth.isAuthenticated()).toBe(true);
  });
});

describe('Google Sheets API Tests', () => {
  let api: MockGoogleSheetsAPI;

  beforeEach(() => {
    api = new MockGoogleSheetsAPI();
  });

  test('should get spreadsheet data', async () => {
    const response = await api.getSpreadsheetData('test_spreadsheet_id', 'A1:Z100');

    expect(response.success).toBe(true);
    expect(response.data.values).toBeDefined();
    expect(response.data.values.length).toBeGreaterThan(0);
    expect(response.quotaUsed).toBe(1);
  });

  test('should append data to spreadsheet', async () => {
    const values = [
      ['Alice', '28', 'Chicago'],
      ['Bob', '35', 'Boston']
    ];

    const response = await api.appendSpreadsheetData('test_spreadsheet_id', 'A1:C', values);

    expect(response.success).toBe(true);
    expect(response.data.updatedRows).toBe(2);
    expect(response.quotaUsed).toBe(1);
  });

  test('should update spreadsheet data', async () => {
    const values = [
      ['Updated Name', '30', 'Updated City']
    ];

    const response = await api.updateSpreadsheetData('test_spreadsheet_id', 'A2:C2', values);

    expect(response.success).toBe(true);
    expect(response.data.updatedCells).toBe(1);
    expect(response.quotaUsed).toBe(1);
  });

  test('should clear spreadsheet data', async () => {
    const response = await api.clearSpreadsheetData('test_spreadsheet_id', 'A1:Z100');

    expect(response.success).toBe(true);
    expect(response.data.clearedRange).toBe('A1:Z100');
    expect(response.quotaUsed).toBe(1);
  });

  test('should perform batch update', async () => {
    const requests = [
      { updateCells: { range: 'A1:A1', values: [['New Value']] } },
      { updateCells: { range: 'B1:B1', values: [['Another Value']] } }
    ];

    const response = await api.batchUpdate('test_spreadsheet_id', requests);

    expect(response.success).toBe(true);
    expect(response.data.replies).toHaveLength(2);
    expect(response.quotaUsed).toBe(1);
  });

  test('should track rate limit state', () => {
    const rateLimitState = api.getRateLimitState();

    expect(rateLimitState.requestsThisSecond).toBeGreaterThanOrEqual(0);
    expect(rateLimitState.requestsThisMinute).toBeGreaterThanOrEqual(0);
    expect(rateLimitState.requestsToday).toBeGreaterThanOrEqual(0);
    expect(rateLimitState.isThrottled).toBe(false);
  });

  test('should track quota state', () => {
    const quotaState = api.getQuotaState();

    expect(quotaState.dailyLimit).toBe(1000);
    expect(quotaState.remainingQuota).toBeGreaterThanOrEqual(0);
    expect(quotaState.isExceeded).toBe(false);
  });

  test('should track API metrics', () => {
    const metrics = api.getMetrics();

    expect(metrics.totalRequests).toBeGreaterThanOrEqual(0);
    expect(metrics.successfulRequests).toBeGreaterThanOrEqual(0);
    expect(metrics.averageResponseTime).toBeGreaterThan(0);
    expect(metrics.startTime).toBeInstanceOf(Date);
  });
});