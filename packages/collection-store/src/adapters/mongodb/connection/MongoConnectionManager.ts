// MongoDB Connection Manager - Advanced connection management with retry logic and failover
// Based on creative phase decisions: Enhanced reliability and performance

import { MongoClient, MongoClientOptions, Db, ServerHeartbeatSucceededEvent, ServerHeartbeatFailedEvent } from 'mongodb';
import { EventEmitter } from 'events';

export interface ConnectionConfig {
  connectionString: string;
  database: string;
  options: MongoClientOptions;

  // Retry configuration
  retry: {
    attempts: number;
    delayMs: number;
    backoffMultiplier: number;
    maxDelayMs: number;
  };

  // Health monitoring
  health: {
    pingIntervalMs: number;
    timeoutMs: number;
    failureThreshold: number;
  };

  // Connection pool
  pool: {
    maxPoolSize: number;
    minPoolSize: number;
    maxIdleTimeMS: number;
    waitQueueTimeoutMS: number;
  };
}

export interface ConnectionState {
  status: 'DISCONNECTED' | 'CONNECTING' | 'CONNECTED' | 'RECONNECTING' | 'FAILED';
  lastConnected?: Date;
  lastError?: Error;
  retryAttempt: number;
  failureCount: number;
  connectionId: string;
}

export interface ConnectionMetrics {
  totalConnections: number;
  successfulConnections: number;
  failedConnections: number;
  reconnections: number;
  averageConnectionTime: number;
  lastConnectionTime: number;
  uptime: number;
  startTime: Date;
}

export class MongoConnectionManager extends EventEmitter {
  private client?: MongoClient;
  private db?: Db;
  private state: ConnectionState;
  private metrics: ConnectionMetrics;
  private healthCheckInterval?: NodeJS.Timeout;
  private reconnectTimeout?: NodeJS.Timeout;
  private isShuttingDown = false;

  constructor(private config: ConnectionConfig) {
    super();

    this.state = {
      status: 'DISCONNECTED',
      retryAttempt: 0,
      failureCount: 0,
      connectionId: this.generateConnectionId()
    };

    this.metrics = {
      totalConnections: 0,
      successfulConnections: 0,
      failedConnections: 0,
      reconnections: 0,
      averageConnectionTime: 0,
      lastConnectionTime: 0,
      uptime: 0,
      startTime: new Date()
    };
  }

  // Connection management
  async connect(): Promise<void> {
    if (this.isShuttingDown) {
      throw new Error('Connection manager is shutting down');
    }

    if (this.state.status === 'CONNECTED') {
      return;
    }

    if (this.state.status === 'CONNECTING') {
      throw new Error('Connection already in progress');
    }

    await this.doConnect();
  }

  async disconnect(): Promise<void> {
    this.isShuttingDown = true;

    // Clear intervals and timeouts
    if (this.healthCheckInterval) {
      clearInterval(this.healthCheckInterval);
      this.healthCheckInterval = undefined;
    }

    if (this.reconnectTimeout) {
      clearTimeout(this.reconnectTimeout);
      this.reconnectTimeout = undefined;
    }

    // Close MongoDB connection
    if (this.client) {
      try {
        await this.client.close();
      } catch (error) {
        console.warn('Error closing MongoDB connection:', error);
      }
      this.client = undefined;
      this.db = undefined;
    }

    this.state.status = 'DISCONNECTED';
    this.emit('disconnected', { connectionId: this.state.connectionId });
  }

  async reconnect(): Promise<void> {
    if (this.isShuttingDown) {
      return;
    }

    this.state.status = 'RECONNECTING';
    this.metrics.reconnections++;

    // Close existing connection
    if (this.client) {
      try {
        await this.client.close();
      } catch (error) {
        console.warn('Error closing connection during reconnect:', error);
      }
      this.client = undefined;
      this.db = undefined;
    }

    await this.doConnect();
  }

  // Getters
  getClient(): MongoClient | undefined {
    return this.client;
  }

  getDatabase(): Db | undefined {
    return this.db;
  }

  getState(): ConnectionState {
    return { ...this.state };
  }

  getMetrics(): ConnectionMetrics {
    const now = Date.now();
    const uptimeMs = now - this.metrics.startTime.getTime();

    return {
      ...this.metrics,
      uptime: Math.floor(uptimeMs / 1000) // Convert to seconds
    };
  }

  isConnected(): boolean {
    return this.state.status === 'CONNECTED' && this.client !== undefined;
  }

  isHealthy(): boolean {
    return this.isConnected() && this.state.failureCount < this.config.health.failureThreshold;
  }

  // Health monitoring
  async ping(): Promise<boolean> {
    if (!this.db) {
      return false;
    }

    try {
      await this.db.admin().ping();
      return true;
    } catch (error) {
      this.handleHealthCheckFailure(error as Error);
      return false;
    }
  }

  async getServerStatus(): Promise<any> {
    if (!this.db) {
      throw new Error('Database not connected');
    }

    return await this.db.admin().serverStatus();
  }

  // Configuration updates
  updateConfig(newConfig: Partial<ConnectionConfig>): void {
    // Merge new configuration
    this.config = {
      ...this.config,
      ...newConfig,
      retry: { ...this.config.retry, ...newConfig.retry },
      health: { ...this.config.health, ...newConfig.health },
      pool: { ...this.config.pool, ...newConfig.pool }
    };

    // Restart health monitoring if interval changed
    if (newConfig.health?.pingIntervalMs && this.healthCheckInterval) {
      this.startHealthMonitoring();
    }
  }

  // Private methods
  private async doConnect(): Promise<void> {
    const startTime = Date.now();
    this.state.status = 'CONNECTING';
    this.state.retryAttempt = 0;
    this.metrics.totalConnections++;

    this.emit('connecting', {
      connectionId: this.state.connectionId,
      attempt: this.state.retryAttempt + 1
    });

    try {
      await this.connectWithRetry();

      const connectionTime = Date.now() - startTime;
      this.updateConnectionMetrics(connectionTime, true);

      this.state.status = 'CONNECTED';
      this.state.lastConnected = new Date();
      this.state.lastError = undefined;
      this.state.retryAttempt = 0;
      this.state.failureCount = 0;

      this.setupConnectionEventHandlers();
      this.startHealthMonitoring();

      this.emit('connected', {
        connectionId: this.state.connectionId,
        connectionTime,
        database: this.config.database
      });

    } catch (error) {
      this.updateConnectionMetrics(Date.now() - startTime, false);
      this.state.status = 'FAILED';
      this.state.lastError = error as Error;
      this.state.failureCount++;

      this.emit('connection-failed', {
        connectionId: this.state.connectionId,
        error: (error as Error).message,
        retryAttempt: this.state.retryAttempt
      });

      throw error;
    }
  }

  private async connectWithRetry(): Promise<void> {
    let lastError: Error | undefined;

    for (let attempt = 0; attempt <= this.config.retry.attempts; attempt++) {
      this.state.retryAttempt = attempt;

      try {
        // Create MongoDB client with enhanced options
        const clientOptions: MongoClientOptions = {
          ...this.config.options,
          maxPoolSize: this.config.pool.maxPoolSize,
          minPoolSize: this.config.pool.minPoolSize,
          maxIdleTimeMS: this.config.pool.maxIdleTimeMS,
          waitQueueTimeoutMS: this.config.pool.waitQueueTimeoutMS,
          serverSelectionTimeoutMS: this.config.health.timeoutMs,
          heartbeatFrequencyMS: this.config.health.pingIntervalMs,
          retryWrites: true,
          retryReads: true
        };

        this.client = new MongoClient(this.config.connectionString, clientOptions);

        // Connect with timeout
        await Promise.race([
          this.client.connect(),
          this.createTimeoutPromise(this.config.health.timeoutMs)
        ]);

        // Get database reference
        this.db = this.client.db(this.config.database);

        // Test connection with ping
        await this.db.admin().ping();

        return; // Success!

      } catch (error) {
        lastError = error as Error;

        // Clean up failed connection
        if (this.client) {
          try {
            await this.client.close();
          } catch (closeError) {
            console.warn('Error closing failed connection:', closeError);
          }
          this.client = undefined;
          this.db = undefined;
        }

        // Don't retry on the last attempt
        if (attempt < this.config.retry.attempts) {
          const delay = this.calculateRetryDelay(attempt);

          this.emit('retry-attempt', {
            connectionId: this.state.connectionId,
            attempt: attempt + 1,
            maxAttempts: this.config.retry.attempts + 1,
            delay,
            error: (error as Error).message
          });

          await this.sleep(delay);
        }
      }
    }

    throw lastError || new Error('Connection failed after all retry attempts');
  }

  private setupConnectionEventHandlers(): void {
    if (!this.client) {
      return;
    }

    // Monitor server heartbeat events
    this.client.on('serverHeartbeatSucceeded', (event: ServerHeartbeatSucceededEvent) => {
      this.state.failureCount = Math.max(0, this.state.failureCount - 1);
      this.emit('heartbeat-success', {
        connectionId: this.state.connectionId,
        duration: event.duration
      });
    });

    this.client.on('serverHeartbeatFailed', (event: ServerHeartbeatFailedEvent) => {
      this.state.failureCount++;
      this.emit('heartbeat-failed', {
        connectionId: this.state.connectionId,
        error: event.failure.message
      });

      // Trigger reconnection if failure threshold exceeded
      if (this.state.failureCount >= this.config.health.failureThreshold) {
        this.scheduleReconnection();
      }
    });

    // Monitor topology changes
    this.client.on('topologyDescriptionChanged', (event) => {
      this.emit('topology-changed', {
        connectionId: this.state.connectionId,
        previousType: event.previousDescription.type,
        newType: event.newDescription.type
      });
    });

    // Monitor connection pool events
    this.client.on('connectionPoolCreated', (event) => {
      this.emit('pool-created', {
        connectionId: this.state.connectionId,
        address: event.address
      });
    });

    this.client.on('connectionPoolClosed', (event) => {
      this.emit('pool-closed', {
        connectionId: this.state.connectionId,
        address: event.address
      });
    });
  }

  private startHealthMonitoring(): void {
    // Clear existing interval
    if (this.healthCheckInterval) {
      clearInterval(this.healthCheckInterval);
    }

    // Start new health check interval
    this.healthCheckInterval = setInterval(async () => {
      if (this.isShuttingDown) {
        return;
      }

      try {
        const isHealthy = await this.ping();
        if (!isHealthy && this.state.status === 'CONNECTED') {
          this.scheduleReconnection();
        }
      } catch (error) {
        this.handleHealthCheckFailure(error as Error);
      }
    }, this.config.health.pingIntervalMs);
  }

  private handleHealthCheckFailure(error: Error): void {
    this.state.failureCount++;
    this.state.lastError = error;

    this.emit('health-check-failed', {
      connectionId: this.state.connectionId,
      error: error.message,
      failureCount: this.state.failureCount
    });

    if (this.state.failureCount >= this.config.health.failureThreshold) {
      this.scheduleReconnection();
    }
  }

  private scheduleReconnection(): void {
    if (this.isShuttingDown || this.reconnectTimeout) {
      return;
    }

    const delay = this.calculateRetryDelay(this.state.failureCount);

    this.emit('reconnection-scheduled', {
      connectionId: this.state.connectionId,
      delay,
      failureCount: this.state.failureCount
    });

    this.reconnectTimeout = setTimeout(async () => {
      this.reconnectTimeout = undefined;

      try {
        await this.reconnect();
      } catch (error) {
        this.emit('reconnection-failed', {
          connectionId: this.state.connectionId,
          error: (error as Error).message
        });
      }
    }, delay);
  }

  private calculateRetryDelay(attempt: number): number {
    const baseDelay = this.config.retry.delayMs;
    const multiplier = Math.pow(this.config.retry.backoffMultiplier, attempt);
    const delay = baseDelay * multiplier;

    return Math.min(delay, this.config.retry.maxDelayMs);
  }

  private updateConnectionMetrics(connectionTime: number, success: boolean): void {
    if (success) {
      this.metrics.successfulConnections++;
      this.metrics.lastConnectionTime = connectionTime;

      // Update average connection time
      const totalTime = this.metrics.averageConnectionTime * (this.metrics.successfulConnections - 1) + connectionTime;
      this.metrics.averageConnectionTime = totalTime / this.metrics.successfulConnections;
    } else {
      this.metrics.failedConnections++;
    }
  }

  private createTimeoutPromise(timeoutMs: number): Promise<never> {
    return new Promise((_, reject) => {
      setTimeout(() => {
        reject(new Error(`Connection timeout after ${timeoutMs}ms`));
      }, timeoutMs);
    });
  }

  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  private generateConnectionId(): string {
    return `mongo_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
}