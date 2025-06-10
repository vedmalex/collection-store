// Google Sheets API Manager - Rate limiting and quota management
// Based on creative phase decisions: Efficient API usage with rate limiting

import { EventEmitter } from 'events';
import { GoogleSheetsAuth } from '../auth/GoogleSheetsAuth';

export interface RateLimitConfig {
  requestsPerSecond: number;
  requestsPerMinute: number;
  requestsPerDay: number;
  burstLimit: number;
  backoffMultiplier: number;
  maxRetries: number;
  retryDelayMs: number;
}

export interface QuotaConfig {
  dailyQuota: number;
  quotaResetHour: number; // Hour of day when quota resets (0-23)
  quotaWarningThreshold: number; // Percentage (0-100)
  quotaBuffer: number; // Reserve this many requests
}

export interface APIConfig {
  rateLimit: RateLimitConfig;
  quota: QuotaConfig;
  timeout: number;
  retryOnQuotaExceeded: boolean;
  enableMetrics: boolean;
}

export interface RateLimitState {
  requestsThisSecond: number;
  requestsThisMinute: number;
  requestsToday: number;
  lastRequestTime: Date;
  lastSecondReset: Date;
  lastMinuteReset: Date;
  lastDayReset: Date;
  isThrottled: boolean;
  throttleUntil?: Date;
}

export interface QuotaState {
  dailyUsage: number;
  dailyLimit: number;
  remainingQuota: number;
  quotaResetTime: Date;
  isNearLimit: boolean;
  isExceeded: boolean;
}

export interface APIMetrics {
  totalRequests: number;
  successfulRequests: number;
  failedRequests: number;
  throttledRequests: number;
  quotaExceededRequests: number;
  averageResponseTime: number;
  lastRequestTime?: Date;
  uptime: number;
  startTime: Date;
}

export interface SpreadsheetData {
  spreadsheetId: string;
  range: string;
  values: any[][];
  majorDimension?: 'ROWS' | 'COLUMNS';
}

export interface BatchRequest {
  requests: APIRequest[];
  batchId: string;
  priority: 'HIGH' | 'NORMAL' | 'LOW';
}

export interface APIRequest {
  method: 'GET' | 'POST' | 'PUT' | 'DELETE';
  endpoint: string;
  data?: any;
  spreadsheetId?: string;
  range?: string;
  requestId: string;
  priority: 'HIGH' | 'NORMAL' | 'LOW';
  retryCount: number;
  timestamp: Date;
}

export interface APIResponse {
  success: boolean;
  data?: any;
  error?: string;
  requestId: string;
  responseTime: number;
  quotaUsed: number;
  rateLimitHit: boolean;
}

export class GoogleSheetsAPI extends EventEmitter {
  private auth: GoogleSheetsAuth;
  private rateLimitState: RateLimitState;
  private quotaState: QuotaState;
  private metrics: APIMetrics;
  private requestQueue: APIRequest[] = [];
  private batchQueue: BatchRequest[] = [];
  private processingInterval?: NodeJS.Timeout;
  private quotaResetInterval?: NodeJS.Timeout;
  private isShuttingDown = false;

  constructor(
    auth: GoogleSheetsAuth,
    private config: APIConfig
  ) {
    super();
    this.auth = auth;

    // Initialize rate limit state
    const now = new Date();
    this.rateLimitState = {
      requestsThisSecond: 0,
      requestsThisMinute: 0,
      requestsToday: 0,
      lastRequestTime: now,
      lastSecondReset: now,
      lastMinuteReset: now,
      lastDayReset: now,
      isThrottled: false
    };

    // Initialize quota state
    this.quotaState = {
      dailyUsage: 0,
      dailyLimit: config.quota.dailyQuota,
      remainingQuota: config.quota.dailyQuota,
      quotaResetTime: this.calculateNextQuotaReset(),
      isNearLimit: false,
      isExceeded: false
    };

    // Initialize metrics
    this.metrics = {
      totalRequests: 0,
      successfulRequests: 0,
      failedRequests: 0,
      throttledRequests: 0,
      quotaExceededRequests: 0,
      averageResponseTime: 0,
      uptime: 0,
      startTime: new Date()
    };

    this.startProcessing();
    this.scheduleQuotaReset();
  }

  // Spreadsheet operations
  async getSpreadsheetData(spreadsheetId: string, range: string): Promise<APIResponse> {
    const request: APIRequest = {
      method: 'GET',
      endpoint: `/spreadsheets/${spreadsheetId}/values/${range}`,
      spreadsheetId,
      range,
      requestId: this.generateRequestId(),
      priority: 'NORMAL',
      retryCount: 0,
      timestamp: new Date()
    };

    return await this.executeRequest(request);
  }

  async updateSpreadsheetData(
    spreadsheetId: string,
    range: string,
    values: any[][],
    majorDimension: 'ROWS' | 'COLUMNS' = 'ROWS'
  ): Promise<APIResponse> {
    const request: APIRequest = {
      method: 'PUT',
      endpoint: `/spreadsheets/${spreadsheetId}/values/${range}`,
      data: {
        values,
        majorDimension
      },
      spreadsheetId,
      range,
      requestId: this.generateRequestId(),
      priority: 'NORMAL',
      retryCount: 0,
      timestamp: new Date()
    };

    return await this.executeRequest(request);
  }

  async appendSpreadsheetData(
    spreadsheetId: string,
    range: string,
    values: any[][],
    insertDataOption: 'OVERWRITE' | 'INSERT_ROWS' = 'INSERT_ROWS'
  ): Promise<APIResponse> {
    const request: APIRequest = {
      method: 'POST',
      endpoint: `/spreadsheets/${spreadsheetId}/values/${range}:append`,
      data: {
        values,
        majorDimension: 'ROWS',
        insertDataOption
      },
      spreadsheetId,
      range,
      requestId: this.generateRequestId(),
      priority: 'NORMAL',
      retryCount: 0,
      timestamp: new Date()
    };

    return await this.executeRequest(request);
  }

  async clearSpreadsheetData(spreadsheetId: string, range: string): Promise<APIResponse> {
    const request: APIRequest = {
      method: 'POST',
      endpoint: `/spreadsheets/${spreadsheetId}/values/${range}:clear`,
      spreadsheetId,
      range,
      requestId: this.generateRequestId(),
      priority: 'NORMAL',
      retryCount: 0,
      timestamp: new Date()
    };

    return await this.executeRequest(request);
  }

  async batchUpdate(spreadsheetId: string, requests: any[]): Promise<APIResponse> {
    const request: APIRequest = {
      method: 'POST',
      endpoint: `/spreadsheets/${spreadsheetId}:batchUpdate`,
      data: { requests },
      spreadsheetId,
      requestId: this.generateRequestId(),
      priority: 'HIGH',
      retryCount: 0,
      timestamp: new Date()
    };

    return await this.executeRequest(request);
  }

  // Batch operations
  async executeBatch(batchRequest: BatchRequest): Promise<APIResponse[]> {
    this.batchQueue.push(batchRequest);

    this.emit('batch-queued', {
      batchId: batchRequest.batchId,
      requestCount: batchRequest.requests.length,
      priority: batchRequest.priority
    });

    // Process batch immediately if high priority
    if (batchRequest.priority === 'HIGH') {
      return await this.processBatch(batchRequest);
    }

    // Return promise that resolves when batch is processed
    return new Promise((resolve) => {
      this.once(`batch-completed-${batchRequest.batchId}`, resolve);
    });
  }

  // Queue management
  async executeRequest(request: APIRequest): Promise<APIResponse> {
    // Check authentication
    if (!this.auth.isAuthenticated() || !this.auth.isTokenValid()) {
      return {
        success: false,
        error: 'Authentication required or token expired',
        requestId: request.requestId,
        responseTime: 0,
        quotaUsed: 0,
        rateLimitHit: false
      };
    }

    // Check quota
    if (this.quotaState.isExceeded) {
      this.metrics.quotaExceededRequests++;
      return {
        success: false,
        error: 'Daily quota exceeded',
        requestId: request.requestId,
        responseTime: 0,
        quotaUsed: 0,
        rateLimitHit: false
      };
    }

    // Check rate limits
    if (!this.canMakeRequest()) {
      if (request.priority === 'HIGH') {
        // Queue high priority requests
        this.requestQueue.unshift(request);
      } else {
        this.requestQueue.push(request);
      }

      this.metrics.throttledRequests++;

      return new Promise((resolve) => {
        this.once(`request-completed-${request.requestId}`, resolve);
      });
    }

    return await this.makeAPICall(request);
  }

  // State getters
  getRateLimitState(): RateLimitState {
    return { ...this.rateLimitState };
  }

  getQuotaState(): QuotaState {
    return { ...this.quotaState };
  }

  getMetrics(): APIMetrics {
    const now = Date.now();
    const uptimeMs = now - this.metrics.startTime.getTime();

    return {
      ...this.metrics,
      uptime: Math.floor(uptimeMs / 1000)
    };
  }

  getQueueStatus(): { pending: number; batches: number } {
    return {
      pending: this.requestQueue.length,
      batches: this.batchQueue.length
    };
  }

  // Configuration updates
  updateConfig(newConfig: Partial<APIConfig>): void {
    this.config = {
      ...this.config,
      ...newConfig,
      rateLimit: { ...this.config.rateLimit, ...newConfig.rateLimit },
      quota: { ...this.config.quota, ...newConfig.quota }
    };

    // Update quota state if limits changed
    if (newConfig.quota?.dailyQuota) {
      this.quotaState.dailyLimit = newConfig.quota.dailyQuota;
      this.quotaState.remainingQuota = Math.max(0, newConfig.quota.dailyQuota - this.quotaState.dailyUsage);
    }
  }

  // Shutdown
  async shutdown(): Promise<void> {
    this.isShuttingDown = true;

    // Clear intervals
    if (this.processingInterval) {
      clearInterval(this.processingInterval);
      this.processingInterval = undefined;
    }

    if (this.quotaResetInterval) {
      clearInterval(this.quotaResetInterval);
      this.quotaResetInterval = undefined;
    }

    // Process remaining requests
    await this.processRemainingRequests();

    this.emit('api-shutdown');
  }

  // Private methods
  private canMakeRequest(): boolean {
    this.updateRateLimitCounters();

    const { rateLimit } = this.config;

    return (
      this.rateLimitState.requestsThisSecond < rateLimit.requestsPerSecond &&
      this.rateLimitState.requestsThisMinute < rateLimit.requestsPerMinute &&
      this.rateLimitState.requestsToday < rateLimit.requestsPerDay &&
      !this.rateLimitState.isThrottled
    );
  }

  private updateRateLimitCounters(): void {
    const now = new Date();

    // Reset second counter
    if (now.getTime() - this.rateLimitState.lastSecondReset.getTime() >= 1000) {
      this.rateLimitState.requestsThisSecond = 0;
      this.rateLimitState.lastSecondReset = now;
    }

    // Reset minute counter
    if (now.getTime() - this.rateLimitState.lastMinuteReset.getTime() >= 60000) {
      this.rateLimitState.requestsThisMinute = 0;
      this.rateLimitState.lastMinuteReset = now;
    }

    // Reset day counter
    if (now.getDate() !== this.rateLimitState.lastDayReset.getDate()) {
      this.rateLimitState.requestsToday = 0;
      this.rateLimitState.lastDayReset = now;
    }

    // Check if throttle period has ended
    if (this.rateLimitState.throttleUntil && now > this.rateLimitState.throttleUntil) {
      this.rateLimitState.isThrottled = false;
      this.rateLimitState.throttleUntil = undefined;
    }
  }

  private async makeAPICall(request: APIRequest): Promise<APIResponse> {
    const startTime = Date.now();
    this.metrics.totalRequests++;

    // Update rate limit counters
    this.rateLimitState.requestsThisSecond++;
    this.rateLimitState.requestsThisMinute++;
    this.rateLimitState.requestsToday++;
    this.rateLimitState.lastRequestTime = new Date();

    try {
      // Simulate API call - in real implementation, would use Google Sheets API
      const response = await this.simulateAPICall(request);

      const responseTime = Date.now() - startTime;
      this.updateMetrics(responseTime, true);
      this.updateQuotaUsage(1);

      const apiResponse: APIResponse = {
        success: true,
        data: response,
        requestId: request.requestId,
        responseTime,
        quotaUsed: 1,
        rateLimitHit: false
      };

      this.emit('request-completed', {
        requestId: request.requestId,
        success: true,
        responseTime
      });

      return apiResponse;

    } catch (error) {
      const responseTime = Date.now() - startTime;
      this.updateMetrics(responseTime, false);

      // Handle rate limit errors
      if ((error as any).code === 429) {
        this.handleRateLimitError();
        this.metrics.throttledRequests++;
      }

      // Handle quota exceeded errors
      if ((error as any).code === 403 && (error as any).message?.includes('quota')) {
        this.quotaState.isExceeded = true;
        this.metrics.quotaExceededRequests++;
      }

      const apiResponse: APIResponse = {
        success: false,
        error: (error as Error).message,
        requestId: request.requestId,
        responseTime,
        quotaUsed: 0,
        rateLimitHit: (error as any).code === 429
      };

      this.emit('request-failed', {
        requestId: request.requestId,
        error: (error as Error).message,
        responseTime
      });

      return apiResponse;
    }
  }

  private async simulateAPICall(request: APIRequest): Promise<any> {
    // Simulate network delay
    await new Promise(resolve => setTimeout(resolve, 100 + Math.random() * 200));

    // Simulate different responses based on request type
    switch (request.method) {
      case 'GET':
        return {
          values: [
            ['Name', 'Age', 'City'],
            ['John', '30', 'New York'],
            ['Jane', '25', 'Los Angeles']
          ]
        };
      case 'PUT':
      case 'POST':
        return {
          updatedCells: request.data?.values?.length || 0,
          updatedRows: request.data?.values?.length || 0
        };
      default:
        return { success: true };
    }
  }

  private handleRateLimitError(): void {
    const backoffMs = this.config.rateLimit.retryDelayMs *
      Math.pow(this.config.rateLimit.backoffMultiplier, this.rateLimitState.requestsThisSecond);

    this.rateLimitState.isThrottled = true;
    this.rateLimitState.throttleUntil = new Date(Date.now() + backoffMs);

    this.emit('rate-limit-hit', {
      throttleUntil: this.rateLimitState.throttleUntil,
      backoffMs
    });
  }

  private updateMetrics(responseTime: number, success: boolean): void {
    if (success) {
      this.metrics.successfulRequests++;

      // Update average response time
      const totalTime = this.metrics.averageResponseTime * (this.metrics.successfulRequests - 1) + responseTime;
      this.metrics.averageResponseTime = totalTime / this.metrics.successfulRequests;
    } else {
      this.metrics.failedRequests++;
    }

    this.metrics.lastRequestTime = new Date();
  }

  private updateQuotaUsage(quotaUsed: number): void {
    this.quotaState.dailyUsage += quotaUsed;
    this.quotaState.remainingQuota = Math.max(0, this.quotaState.dailyLimit - this.quotaState.dailyUsage);

    // Check if approaching quota limit
    const usagePercentage = (this.quotaState.dailyUsage / this.quotaState.dailyLimit) * 100;
    this.quotaState.isNearLimit = usagePercentage >= this.config.quota.quotaWarningThreshold;

    if (this.quotaState.isNearLimit) {
      this.emit('quota-warning', {
        usage: this.quotaState.dailyUsage,
        limit: this.quotaState.dailyLimit,
        percentage: usagePercentage
      });
    }
  }

  private startProcessing(): void {
    this.processingInterval = setInterval(async () => {
      if (this.isShuttingDown) {
        return;
      }

      await this.processRequestQueue();
      await this.processBatchQueue();
    }, 100); // Process every 100ms
  }

  private async processRequestQueue(): Promise<void> {
    while (this.requestQueue.length > 0 && this.canMakeRequest()) {
      const request = this.requestQueue.shift()!;
      const response = await this.makeAPICall(request);
      this.emit(`request-completed-${request.requestId}`, response);
    }
  }

  private async processBatchQueue(): Promise<void> {
    if (this.batchQueue.length === 0) {
      return;
    }

    // Process high priority batches first
    const batch = this.batchQueue.find(b => b.priority === 'HIGH') || this.batchQueue[0];
    if (!batch) {
      return;
    }

    const batchIndex = this.batchQueue.indexOf(batch);
    this.batchQueue.splice(batchIndex, 1);

    const responses = await this.processBatch(batch);
    this.emit(`batch-completed-${batch.batchId}`, responses);
  }

  private async processBatch(batch: BatchRequest): Promise<APIResponse[]> {
    const responses: APIResponse[] = [];

    for (const request of batch.requests) {
      if (!this.canMakeRequest()) {
        // Wait for rate limit to reset
        await new Promise(resolve => setTimeout(resolve, 1000));
      }

      const response = await this.makeAPICall(request);
      responses.push(response);
    }

    this.emit('batch-processed', {
      batchId: batch.batchId,
      requestCount: batch.requests.length,
      successCount: responses.filter(r => r.success).length
    });

    return responses;
  }

  private calculateNextQuotaReset(): Date {
    const now = new Date();
    const resetTime = new Date(now);
    resetTime.setHours(this.config.quota.quotaResetHour, 0, 0, 0);

    // If reset time has passed today, set for tomorrow
    if (resetTime <= now) {
      resetTime.setDate(resetTime.getDate() + 1);
    }

    return resetTime;
  }

  private scheduleQuotaReset(): void {
    const resetTime = this.quotaState.quotaResetTime;
    const now = new Date();
    const delayMs = resetTime.getTime() - now.getTime();

    this.quotaResetInterval = setTimeout(() => {
      this.resetQuota();
      this.scheduleQuotaReset(); // Schedule next reset
    }, delayMs);
  }

  private resetQuota(): void {
    this.quotaState.dailyUsage = 0;
    this.quotaState.remainingQuota = this.quotaState.dailyLimit;
    this.quotaState.isNearLimit = false;
    this.quotaState.isExceeded = false;
    this.quotaState.quotaResetTime = this.calculateNextQuotaReset();

    this.emit('quota-reset', {
      newLimit: this.quotaState.dailyLimit,
      resetTime: this.quotaState.quotaResetTime
    });
  }

  private async processRemainingRequests(): Promise<void> {
    // Process remaining requests with a timeout
    const timeout = 30000; // 30 seconds
    const startTime = Date.now();

    while (this.requestQueue.length > 0 && (Date.now() - startTime) < timeout) {
      await this.processRequestQueue();
      await new Promise(resolve => setTimeout(resolve, 100));
    }
  }

  private generateRequestId(): string {
    return `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
}