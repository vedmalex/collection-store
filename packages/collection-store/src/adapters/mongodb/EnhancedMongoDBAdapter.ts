// Enhanced MongoDB Adapter - Advanced MongoDB integration with improved reliability
// Based on creative phase decisions: Enhanced connection management and change streams

import { ExternalAdapter } from '../base/ExternalAdapter';
import {
  AdapterConfig,
  AdapterQuery,
  AdapterData,
  AdapterResult,
  AdapterTransaction,
  AdapterSubscription,
  AdapterCallback,
  AdapterChange
} from '../base/types/AdapterTypes';
import { MongoDBAdapterConfig } from '../../config/schemas/AdapterConfig';
import { MongoConnectionManager, ConnectionConfig } from './connection/MongoConnectionManager';
import { ChangeStreamManager, ChangeStreamConfig, StreamSubscription } from './streams/ChangeStreamManager';
import { Collection, ClientSession } from 'mongodb';

export class EnhancedMongoDBAdapter extends ExternalAdapter {
  private connectionManager?: MongoConnectionManager;
  private changeStreamManager?: ChangeStreamManager;
  private collections: Map<string, Collection> = new Map();
  private activeSessions: Map<string, ClientSession> = new Map();

  constructor(config: MongoDBAdapterConfig) {
    super(config.id, config.type, config as AdapterConfig);
  }

  // Abstract method implementations
  protected async doInitialize(): Promise<void> {
    const mongoConfig = this.config as MongoDBAdapterConfig;

    // Initialize connection manager
    const connectionConfig: ConnectionConfig = {
      connectionString: mongoConfig.config.connectionString,
      database: mongoConfig.config.database,
      options: {
        ssl: mongoConfig.config.ssl.enabled,
        sslCA: mongoConfig.config.ssl.ca,
        sslCert: mongoConfig.config.ssl.cert,
        sslKey: mongoConfig.config.ssl.key,
        sslValidate: !mongoConfig.config.ssl.allowInvalidCertificates
      },
      retry: {
        attempts: 3,
        delayMs: 1000,
        backoffMultiplier: 2,
        maxDelayMs: 10000
      },
      health: {
        pingIntervalMs: mongoConfig.lifecycle.healthCheckInterval,
        timeoutMs: 30000,
        failureThreshold: 3
      },
      pool: {
        maxPoolSize: mongoConfig.config.maxPoolSize,
        minPoolSize: mongoConfig.config.minPoolSize,
        maxIdleTimeMS: mongoConfig.config.maxIdleTimeMS,
        waitQueueTimeoutMS: 30000
      }
    };

    this.connectionManager = new MongoConnectionManager(connectionConfig);

    // Setup connection event handlers
    this.setupConnectionEventHandlers();

    // Connect to MongoDB
    await this.connectionManager.connect();

    // Initialize collections
    const db = this.connectionManager.getDatabase();
    if (db) {
      for (const [collectionName, collectionConfig] of Object.entries(mongoConfig.config.collections)) {
        const collection = db.collection(collectionConfig.name);
        this.collections.set(collectionName, collection);

        // Create indexes if specified
        for (const indexConfig of collectionConfig.indexes) {
          try {
            await collection.createIndex(indexConfig.fields, indexConfig.options);
          } catch (error) {
            console.warn(`Failed to create index for collection ${collectionName}:`, error);
          }
        }
      }
    }
  }

  protected async doStart(): Promise<void> {
    if (!this.connectionManager) {
      throw new Error('MongoDB adapter not initialized');
    }

    const mongoConfig = this.config as MongoDBAdapterConfig;

    // Initialize change stream manager if real-time is enabled
    if (mongoConfig.config.changeStreams.enabled && mongoConfig.capabilities.realtime) {
      await this.initializeChangeStreamManager();
    }
  }

  protected async doStop(): Promise<void> {
    // Stop change stream manager
    if (this.changeStreamManager) {
      await this.changeStreamManager.shutdown();
      this.changeStreamManager = undefined;
    }

    // Close all active sessions
    for (const [sessionId, session] of this.activeSessions) {
      try {
        if (!session.hasEnded) {
          await session.endSession();
        }
      } catch (error) {
        console.warn(`Failed to close session ${sessionId}:`, error);
      }
    }
    this.activeSessions.clear();

    // Disconnect from MongoDB
    if (this.connectionManager) {
      await this.connectionManager.disconnect();
      this.connectionManager = undefined;
    }

    this.collections.clear();
  }

  protected async doHealthCheck(): Promise<Record<string, any>> {
    if (!this.connectionManager) {
      return { status: 'disconnected', error: 'Connection manager not initialized' };
    }

    try {
      const isConnected = this.connectionManager.isConnected();
      const isHealthy = this.connectionManager.isHealthy();

      if (!isConnected) {
        return { status: 'disconnected', error: 'Not connected to MongoDB' };
      }

      const connectionState = this.connectionManager.getState();
      const connectionMetrics = this.connectionManager.getMetrics();
      const serverStatus = await this.connectionManager.getServerStatus();

      const health = {
        status: isHealthy ? 'healthy' : 'degraded',
        connection: {
          state: connectionState.status,
          lastConnected: connectionState.lastConnected,
          failureCount: connectionState.failureCount,
          connectionId: connectionState.connectionId
        },
        metrics: {
          totalConnections: connectionMetrics.totalConnections,
          successfulConnections: connectionMetrics.successfulConnections,
          failedConnections: connectionMetrics.failedConnections,
          reconnections: connectionMetrics.reconnections,
          averageConnectionTime: connectionMetrics.averageConnectionTime,
          uptime: connectionMetrics.uptime
        },
        collections: this.collections.size,
        activeSessions: this.activeSessions.size,
        server: {
          version: serverStatus.version,
          uptime: serverStatus.uptime,
          connections: serverStatus.connections
        }
      };

      // Add change stream information if available
      if (this.changeStreamManager) {
        const activeStreams = this.changeStreamManager.getActiveStreams();
        health.changeStreams = {
          total: this.changeStreamManager.getAllStreams().length,
          active: activeStreams.length,
          streams: activeStreams.map(streamId => {
            const metrics = this.changeStreamManager.getStreamMetrics(streamId);
            const state = this.changeStreamManager.getStreamState(streamId);
            return {
              id: streamId,
              status: state?.status,
              totalEvents: metrics?.totalEvents,
              eventsPerSecond: metrics?.eventsPerSecond,
              errorCount: metrics?.errorCount,
              uptime: metrics?.uptime
            };
          })
        };
      }

      return health;
    } catch (error) {
      return {
        status: 'error',
        error: (error as Error).message
      };
    }
  }

  protected async doConfigUpdate(config: Partial<MongoDBAdapterConfig>): Promise<void> {
    // Handle configuration updates that don't require restart
    if (config.lifecycle && this.connectionManager) {
      const connectionConfig = {
        health: {
          pingIntervalMs: config.lifecycle.healthCheckInterval || 30000,
          timeoutMs: 30000,
          failureThreshold: 3
        }
      };
      this.connectionManager.updateConfig(connectionConfig);
    }

    // For connection-related changes, require restart
    if (config.config) {
      throw new Error('Connection configuration changes require adapter restart');
    }
  }

  protected async doValidateConfig(config: MongoDBAdapterConfig): Promise<boolean> {
    try {
      // Validate connection string format
      new URL(config.config.connectionString);

      // Validate database name
      if (!config.config.database || config.config.database.trim() === '') {
        return false;
      }

      // Validate collection configurations
      for (const [name, collectionConfig] of Object.entries(config.config.collections)) {
        if (!collectionConfig.name || collectionConfig.name.trim() === '') {
          return false;
        }
      }

      return true;
    } catch {
      return false;
    }
  }

  protected async doPing(): Promise<boolean> {
    if (!this.connectionManager) {
      return false;
    }

    return await this.connectionManager.ping();
  }

  protected async doUnsubscribe(subscriptionId: string): Promise<void> {
    if (this.changeStreamManager) {
      await this.changeStreamManager.destroyStream(subscriptionId);
    }
  }

  // Enhanced data operation implementations
  async query(query: AdapterQuery): Promise<AdapterResult> {
    const startTime = Date.now();

    try {
      if (!this.connectionManager?.isConnected()) {
        throw new Error('MongoDB adapter not connected');
      }

      const collection = this.getCollection(query.collection);

      let cursor = collection.find(query.filter || {});

      if (query.sort) {
        cursor = cursor.sort(query.sort);
      }

      if (query.skip) {
        cursor = cursor.skip(query.skip);
      }

      if (query.limit) {
        cursor = cursor.limit(query.limit);
      }

      const documents = await cursor.toArray();

      this.recordOperation();
      this.updateResponseTime(Date.now() - startTime);

      return {
        success: true,
        data: documents,
        metadata: {
          count: documents.length,
          collection: query.collection,
          executionTime: Date.now() - startTime
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
      if (!this.connectionManager?.isConnected()) {
        throw new Error('MongoDB adapter not connected');
      }

      const collection = this.getCollection(data.collection);

      let result;
      if (data.documents.length === 1) {
        result = await collection.insertOne(data.documents[0]);
      } else {
        result = await collection.insertMany(data.documents);
      }

      this.recordOperation();
      this.updateResponseTime(Date.now() - startTime);

      return {
        success: true,
        data: result,
        metadata: {
          insertedCount: 'insertedCount' in result ? result.insertedCount : 1,
          collection: data.collection,
          executionTime: Date.now() - startTime
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

  async update(filter: Record<string, any>, data: Record<string, any>): Promise<AdapterResult> {
    const startTime = Date.now();

    try {
      if (!this.connectionManager?.isConnected()) {
        throw new Error('MongoDB adapter not connected');
      }

      // Extract collection from filter or use default
      const collectionName = filter._collection || 'default';
      const collection = this.getCollection(collectionName);

      // Remove collection info from filter
      const { _collection, ...mongoFilter } = filter;

      const result = await collection.updateMany(mongoFilter, { $set: data });

      this.recordOperation();
      this.updateResponseTime(Date.now() - startTime);

      return {
        success: true,
        data: result,
        metadata: {
          matchedCount: result.matchedCount,
          modifiedCount: result.modifiedCount,
          collection: collectionName,
          executionTime: Date.now() - startTime
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

  async delete(filter: Record<string, any>): Promise<AdapterResult> {
    const startTime = Date.now();

    try {
      if (!this.connectionManager?.isConnected()) {
        throw new Error('MongoDB adapter not connected');
      }

      // Extract collection from filter or use default
      const collectionName = filter._collection || 'default';
      const collection = this.getCollection(collectionName);

      // Remove collection info from filter
      const { _collection, ...mongoFilter } = filter;

      const result = await collection.deleteMany(mongoFilter);

      this.recordOperation();
      this.updateResponseTime(Date.now() - startTime);

      return {
        success: true,
        data: result,
        metadata: {
          deletedCount: result.deletedCount,
          collection: collectionName,
          executionTime: Date.now() - startTime
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

  // Enhanced real-time subscriptions with change streams
  async subscribe(callback: AdapterCallback, filter?: Record<string, any>): Promise<AdapterSubscription> {
    if (!this.changeStreamManager) {
      throw new Error('Change streams not enabled');
    }

    const subscriptionId = this.generateSubscriptionId();
    const mongoConfig = this.config as MongoDBAdapterConfig;

    // Create stream subscription
    const streamSubscription: StreamSubscription = {
      id: subscriptionId,
      pipeline: filter ? [{ $match: filter }] : [],
      options: {
        fullDocument: mongoConfig.config.changeStreams.fullDocument,
        batchSize: mongoConfig.config.changeStreams.batchSize
      },
      callback,
      filter,
      active: true,
      createdAt: new Date(),
      errorCount: 0
    };

    // Create change stream
    await this.changeStreamManager.createStream(streamSubscription);

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

  async unsubscribe(subscriptionId: string): Promise<void> {
    await this.doUnsubscribe(subscriptionId);
    this._subscriptions.delete(subscriptionId);
  }

  // Enhanced transaction support
  async beginTransaction(): Promise<AdapterTransaction> {
    if (!this.connectionManager?.getClient()) {
      throw new Error('MongoDB adapter not connected');
    }

    const client = this.connectionManager.getClient()!;
    const session = client.startSession();
    const transactionId = this.generateTransactionId();

    session.startTransaction();

    const transaction: AdapterTransaction = {
      id: transactionId,
      adapterId: this.id,
      state: 'ACTIVE',
      operations: [],
      startTime: new Date()
    };

    // Store session in transaction metadata and active sessions
    (transaction as any).session = session;
    this.activeSessions.set(transactionId, session);

    this._transactions.set(transactionId, transaction);

    return transaction;
  }

  async prepareTransaction(transaction: AdapterTransaction): Promise<boolean> {
    try {
      const session = (transaction as any).session as ClientSession;
      if (!session) {
        return false;
      }

      // Check if session is still active
      if (session.hasEnded) {
        return false;
      }

      transaction.state = 'PREPARED';
      return true;
    } catch {
      return false;
    }
  }

  async commitTransaction(transaction: AdapterTransaction): Promise<void> {
    const session = (transaction as any).session as ClientSession;
    if (!session) {
      throw new Error('Transaction session not found');
    }

    try {
      await session.commitTransaction();
      transaction.state = 'COMMITTED';
    } finally {
      await session.endSession();
      this.activeSessions.delete(transaction.id);
      this._transactions.delete(transaction.id);
    }
  }

  async rollbackTransaction(transaction: AdapterTransaction): Promise<void> {
    const session = (transaction as any).session as ClientSession;
    if (!session) {
      throw new Error('Transaction session not found');
    }

    try {
      await session.abortTransaction();
      transaction.state = 'ROLLED_BACK';
    } finally {
      await session.endSession();
      this.activeSessions.delete(transaction.id);
      this._transactions.delete(transaction.id);
    }
  }

  // Private helper methods
  private getCollection(collectionName?: string): Collection {
    if (!collectionName) {
      throw new Error('Collection name is required');
    }

    const collection = this.collections.get(collectionName);
    if (!collection) {
      throw new Error(`Collection '${collectionName}' not found`);
    }

    return collection;
  }

  private async initializeChangeStreamManager(): Promise<void> {
    const db = this.connectionManager?.getDatabase();
    if (!db) {
      throw new Error('Database not available');
    }

    const mongoConfig = this.config as MongoDBAdapterConfig;

    const changeStreamConfig: ChangeStreamConfig = {
      fullDocument: mongoConfig.config.changeStreams.fullDocument,
      batchSize: mongoConfig.config.changeStreams.batchSize,
      maxAwaitTimeMS: 30000,
      resumeToken: {
        enabled: true,
        persistenceStrategy: 'memory',
        saveIntervalMs: 5000
      },
      errorHandling: {
        maxRetries: 5,
        retryDelayMs: 1000,
        backoffMultiplier: 2,
        maxRetryDelayMs: 30000,
        invalidateOnError: false
      },
      performance: {
        bufferSize: 100,
        flushIntervalMs: 1000,
        enableMetrics: true
      }
    };

    this.changeStreamManager = new ChangeStreamManager(db, changeStreamConfig);

    // Setup change stream event handlers
    this.setupChangeStreamEventHandlers();
  }

  private setupConnectionEventHandlers(): void {
    if (!this.connectionManager) {
      return;
    }

    this.connectionManager.on('connected', (event) => {
      this.emit('CONNECTION_ESTABLISHED', {
        adapterId: this.id,
        connectionId: event.connectionId,
        database: event.database,
        connectionTime: event.connectionTime
      });
    });

    this.connectionManager.on('disconnected', (event) => {
      this.emit('CONNECTION_LOST', {
        adapterId: this.id,
        connectionId: event.connectionId
      });
    });

    this.connectionManager.on('connection-failed', (event) => {
      this.emit('CONNECTION_ERROR', {
        adapterId: this.id,
        connectionId: event.connectionId,
        error: event.error,
        retryAttempt: event.retryAttempt
      });
    });

    this.connectionManager.on('reconnection-scheduled', (event) => {
      this.emit('RECONNECTION_SCHEDULED', {
        adapterId: this.id,
        connectionId: event.connectionId,
        delay: event.delay,
        failureCount: event.failureCount
      });
    });
  }

  private setupChangeStreamEventHandlers(): void {
    if (!this.changeStreamManager) {
      return;
    }

    this.changeStreamManager.on('stream-started', (event) => {
      this.emit('STREAM_STARTED', {
        adapterId: this.id,
        streamId: event.streamId
      });
    });

    this.changeStreamManager.on('stream-error', (event) => {
      this.emit('STREAM_ERROR', {
        adapterId: this.id,
        streamId: event.streamId,
        error: event.error,
        errorCount: event.errorCount
      });
    });

    this.changeStreamManager.on('stream-retry-scheduled', (event) => {
      this.emit('STREAM_RETRY_SCHEDULED', {
        adapterId: this.id,
        streamId: event.streamId,
        delay: event.delay,
        attempt: event.attempt
      });
    });
  }
}