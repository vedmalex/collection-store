// MongoDB Adapter - implements MongoDB integration with Change Streams
// Based on creative phase decisions: Layered architecture with real-time capabilities

import { MongoClient, Db, Collection, ChangeStream, ChangeStreamDocument } from 'mongodb';
import { ExternalAdapter } from '../base/ExternalAdapter';
import {
  AdapterQuery,
  AdapterData,
  AdapterResult,
  AdapterTransaction,
  AdapterSubscription,
  AdapterCallback,
  AdapterChange,
  AdapterOperation
} from '../base/types/AdapterTypes';
import { MongoDBAdapterConfig } from '../../config/schemas/AdapterConfig';

export class MongoDBAdapter extends ExternalAdapter {
  private client?: MongoClient;
  private db?: Db;
  private changeStreams: Map<string, ChangeStream> = new Map();
  private collections: Map<string, Collection> = new Map();

  constructor(config: MongoDBAdapterConfig) {
    super(config.id, config.type, config);
  }

  // Abstract method implementations
  protected async doInitialize(): Promise<void> {
    const mongoConfig = this.config as MongoDBAdapterConfig;

    this.client = new MongoClient(mongoConfig.config.connectionString, {
      maxPoolSize: mongoConfig.config.maxPoolSize,
      minPoolSize: mongoConfig.config.minPoolSize,
      maxIdleTimeMS: mongoConfig.config.maxIdleTimeMS,
      ssl: mongoConfig.config.ssl.enabled,
      sslCA: mongoConfig.config.ssl.ca,
      sslCert: mongoConfig.config.ssl.cert,
      sslKey: mongoConfig.config.ssl.key,
      sslValidate: !mongoConfig.config.ssl.allowInvalidCertificates
    });

    // Test connection
    await this.client.connect();
    this.db = this.client.db(mongoConfig.config.database);

    // Initialize collections
    for (const [collectionName, collectionConfig] of Object.entries(mongoConfig.config.collections)) {
      const collection = this.db.collection(collectionConfig.name);
      this.collections.set(collectionName, collection);

      // Create indexes if specified
      for (const indexConfig of collectionConfig.indexes) {
        await collection.createIndex(indexConfig.fields, indexConfig.options);
      }
    }
  }

  protected async doStart(): Promise<void> {
    if (!this.client || !this.db) {
      throw new Error('MongoDB adapter not initialized');
    }

    const mongoConfig = this.config as MongoDBAdapterConfig;

    // Start change streams if enabled
    if (mongoConfig.config.changeStreams.enabled && mongoConfig.capabilities.realtime) {
      await this.startChangeStreams();
    }
  }

  protected async doStop(): Promise<void> {
    // Stop all change streams
    for (const [streamId, stream] of this.changeStreams) {
      try {
        await stream.close();
      } catch (error) {
        console.warn(`Failed to close change stream ${streamId}:`, error);
      }
    }
    this.changeStreams.clear();

    // Close MongoDB connection
    if (this.client) {
      await this.client.close();
      this.client = undefined;
      this.db = undefined;
    }

    this.collections.clear();
  }

  protected async doHealthCheck(): Promise<Record<string, any>> {
    if (!this.client || !this.db) {
      return { status: 'disconnected', error: 'Client not initialized' };
    }

    try {
      // Ping the database
      await this.db.admin().ping();

      // Get server status
      const serverStatus = await this.db.admin().serverStatus();

      return {
        status: 'connected',
        database: this.db.databaseName,
        collections: this.collections.size,
        changeStreams: this.changeStreams.size,
        serverInfo: {
          version: serverStatus.version,
          uptime: serverStatus.uptime,
          connections: serverStatus.connections
        }
      };
    } catch (error) {
      return {
        status: 'error',
        error: (error as Error).message
      };
    }
  }

  protected async doConfigUpdate(config: Partial<MongoDBAdapterConfig>): Promise<void> {
    // Handle configuration updates that don't require restart
    if (config.lifecycle) {
      // Update lifecycle settings
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
    if (!this.db) {
      return false;
    }

    try {
      await this.db.admin().ping();
      return true;
    } catch {
      return false;
    }
  }

  protected async doUnsubscribe(subscriptionId: string): Promise<void> {
    const changeStream = this.changeStreams.get(subscriptionId);
    if (changeStream) {
      await changeStream.close();
      this.changeStreams.delete(subscriptionId);
    }
  }

  // Data operation implementations
  async query(query: AdapterQuery): Promise<AdapterResult> {
    const startTime = Date.now();

    try {
      if (!this.db) {
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
          collection: query.collection
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
      if (!this.db) {
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
          collection: data.collection
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
      if (!this.db) {
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
          collection: collectionName
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
      if (!this.db) {
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
          collection: collectionName
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

  // Batch operations
  async batchInsert(data: AdapterData[]): Promise<AdapterResult[]> {
    const results: AdapterResult[] = [];

    for (const batch of data) {
      const result = await this.insert(batch);
      results.push(result);
    }

    return results;
  }

  async batchUpdate(operations: Array<{ filter: Record<string, any>; data: Record<string, any> }>): Promise<AdapterResult[]> {
    const results: AdapterResult[] = [];

    for (const operation of operations) {
      const result = await this.update(operation.filter, operation.data);
      results.push(result);
    }

    return results;
  }

  async batchDelete(filters: Record<string, any>[]): Promise<AdapterResult[]> {
    const results: AdapterResult[] = [];

    for (const filter of filters) {
      const result = await this.delete(filter);
      results.push(result);
    }

    return results;
  }

  // Real-time subscriptions
  async subscribe(callback: AdapterCallback, filter?: Record<string, any>): Promise<AdapterSubscription> {
    if (!this.db) {
      throw new Error('MongoDB adapter not connected');
    }

    const subscriptionId = this.generateSubscriptionId();
    const mongoConfig = this.config as MongoDBAdapterConfig;

    // Create change stream
    const pipeline = filter ? [{ $match: filter }] : [];
    const options = {
      fullDocument: mongoConfig.config.changeStreams.fullDocument,
      batchSize: mongoConfig.config.changeStreams.batchSize
    };

    const changeStream = this.db.watch(pipeline, options);

    // Setup change stream event handlers
    changeStream.on('change', (change: ChangeStreamDocument) => {
      const adapterChange: AdapterChange = {
        type: this.mapChangeType(change.operationType),
        collection: change.ns?.coll || 'unknown',
        documentId: change.documentKey?._id?.toString() || 'unknown',
        document: change.fullDocument,
        previousDocument: change.fullDocumentBeforeChange,
        timestamp: new Date()
      };

      callback(adapterChange);
    });

    changeStream.on('error', (error) => {
      this.recordError(error);
    });

    this.changeStreams.set(subscriptionId, changeStream);

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

  // Transaction support
  async beginTransaction(): Promise<AdapterTransaction> {
    if (!this.client) {
      throw new Error('MongoDB adapter not connected');
    }

    const session = this.client.startSession();
    const transactionId = this.generateTransactionId();

    session.startTransaction();

    const transaction: AdapterTransaction = {
      id: transactionId,
      adapterId: this.id,
      state: 'ACTIVE',
      operations: [],
      startTime: new Date()
    };

    // Store session in transaction metadata
    (transaction as any).session = session;

    this._transactions.set(transactionId, transaction);

    return transaction;
  }

  async prepareTransaction(transaction: AdapterTransaction): Promise<boolean> {
    try {
      // MongoDB doesn't have explicit prepare phase, but we can validate the transaction
      const session = (transaction as any).session;
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
    const session = (transaction as any).session;
    if (!session) {
      throw new Error('Transaction session not found');
    }

    try {
      await session.commitTransaction();
      transaction.state = 'COMMITTED';
    } finally {
      await session.endSession();
      this._transactions.delete(transaction.id);
    }
  }

  async rollbackTransaction(transaction: AdapterTransaction): Promise<void> {
    const session = (transaction as any).session;
    if (!session) {
      throw new Error('Transaction session not found');
    }

    try {
      await session.abortTransaction();
      transaction.state = 'ROLLED_BACK';
    } finally {
      await session.endSession();
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

  private async startChangeStreams(): Promise<void> {
    if (!this.db) {
      return;
    }

    const mongoConfig = this.config as MongoDBAdapterConfig;

    // Start global change stream for all collections
    const options = {
      fullDocument: mongoConfig.config.changeStreams.fullDocument,
      batchSize: mongoConfig.config.changeStreams.batchSize
    };

    if (mongoConfig.config.changeStreams.resumeAfter) {
      (options as any).resumeAfter = mongoConfig.config.changeStreams.resumeAfter;
    }

    if (mongoConfig.config.changeStreams.startAtOperationTime) {
      (options as any).startAtOperationTime = mongoConfig.config.changeStreams.startAtOperationTime;
    }

    const changeStream = this.db.watch([], options);
    this.changeStreams.set('global', changeStream);
  }

  private mapChangeType(operationType: string): 'INSERT' | 'UPDATE' | 'DELETE' {
    switch (operationType) {
      case 'insert':
        return 'INSERT';
      case 'update':
      case 'replace':
        return 'UPDATE';
      case 'delete':
        return 'DELETE';
      default:
        return 'UPDATE';
    }
  }
}