// MongoDB Change Streams Manager - Advanced change stream management with resume tokens
// Based on creative phase decisions: Real-time data synchronization with reliability

import { Db, ChangeStream, ChangeStreamDocument, ResumeToken, ChangeStreamOptions } from 'mongodb';
import { EventEmitter } from 'events';
import { AdapterChange, AdapterCallback } from '../../base/types/AdapterTypes';

export interface ChangeStreamConfig {
  // Stream configuration
  fullDocument: 'default' | 'updateLookup' | 'whenAvailable' | 'required';
  batchSize: number;
  maxAwaitTimeMS: number;

  // Resume token management
  resumeToken: {
    enabled: boolean;
    persistenceStrategy: 'memory' | 'file' | 'database';
    persistencePath?: string;
    saveIntervalMs: number;
  };

  // Error handling
  errorHandling: {
    maxRetries: number;
    retryDelayMs: number;
    backoffMultiplier: number;
    maxRetryDelayMs: number;
    invalidateOnError: boolean;
  };

  // Performance
  performance: {
    bufferSize: number;
    flushIntervalMs: number;
    enableMetrics: boolean;
  };
}

export interface StreamSubscription {
  id: string;
  pipeline: any[];
  options: ChangeStreamOptions;
  callback: AdapterCallback;
  filter?: Record<string, any>;
  active: boolean;
  createdAt: Date;
  lastActivity?: Date;
  errorCount: number;
}

export interface StreamState {
  id: string;
  status: 'INACTIVE' | 'STARTING' | 'ACTIVE' | 'ERROR' | 'STOPPING';
  resumeToken?: ResumeToken;
  lastProcessedTime?: Date;
  errorCount: number;
  retryAttempt: number;
  subscription: StreamSubscription;
}

export interface StreamMetrics {
  totalEvents: number;
  eventsPerSecond: number;
  lastEventTime?: Date;
  averageProcessingTime: number;
  errorCount: number;
  reconnections: number;
  uptime: number;
  startTime: Date;
}

export class ChangeStreamManager extends EventEmitter {
  private streams: Map<string, ChangeStream> = new Map();
  private streamStates: Map<string, StreamState> = new Map();
  private streamMetrics: Map<string, StreamMetrics> = new Map();
  private resumeTokens: Map<string, ResumeToken> = new Map();
  private eventBuffer: Map<string, ChangeStreamDocument[]> = new Map();
  private flushIntervals: Map<string, NodeJS.Timeout> = new Map();
  private retryTimeouts: Map<string, NodeJS.Timeout> = new Map();
  private isShuttingDown = false;

  constructor(
    private db: Db,
    private config: ChangeStreamConfig
  ) {
    super();

    if (this.config.resumeToken.enabled) {
      this.loadResumeTokens();
    }
  }

  // Stream management
  async createStream(subscription: StreamSubscription): Promise<string> {
    if (this.isShuttingDown) {
      throw new Error('Change stream manager is shutting down');
    }

    const streamId = subscription.id;

    if (this.streams.has(streamId)) {
      throw new Error(`Stream with id '${streamId}' already exists`);
    }

    // Initialize stream state
    const streamState: StreamState = {
      id: streamId,
      status: 'INACTIVE',
      resumeToken: this.resumeTokens.get(streamId),
      errorCount: 0,
      retryAttempt: 0,
      subscription
    };

    // Initialize metrics
    const metrics: StreamMetrics = {
      totalEvents: 0,
      eventsPerSecond: 0,
      averageProcessingTime: 0,
      errorCount: 0,
      reconnections: 0,
      uptime: 0,
      startTime: new Date()
    };

    this.streamStates.set(streamId, streamState);
    this.streamMetrics.set(streamId, metrics);
    this.eventBuffer.set(streamId, []);

    await this.startStream(streamId);

    return streamId;
  }

  async destroyStream(streamId: string): Promise<void> {
    const stream = this.streams.get(streamId);
    if (!stream) {
      return;
    }

    // Update state
    const state = this.streamStates.get(streamId);
    if (state) {
      state.status = 'STOPPING';
    }

    // Clear intervals and timeouts
    const flushInterval = this.flushIntervals.get(streamId);
    if (flushInterval) {
      clearInterval(flushInterval);
      this.flushIntervals.delete(streamId);
    }

    const retryTimeout = this.retryTimeouts.get(streamId);
    if (retryTimeout) {
      clearTimeout(retryTimeout);
      this.retryTimeouts.delete(streamId);
    }

    // Close stream
    try {
      await stream.close();
    } catch (error) {
      console.warn(`Error closing change stream ${streamId}:`, error);
    }

    // Flush remaining events
    await this.flushEventBuffer(streamId);

    // Save resume token
    if (this.config.resumeToken.enabled && state?.resumeToken) {
      await this.saveResumeToken(streamId, state.resumeToken);
    }

    // Cleanup
    this.streams.delete(streamId);
    this.streamStates.delete(streamId);
    this.streamMetrics.delete(streamId);
    this.eventBuffer.delete(streamId);

    this.emit('stream-destroyed', { streamId });
  }

  async restartStream(streamId: string): Promise<void> {
    const state = this.streamStates.get(streamId);
    if (!state) {
      throw new Error(`Stream '${streamId}' not found`);
    }

    await this.destroyStream(streamId);

    // Increment reconnection count
    const metrics = this.streamMetrics.get(streamId);
    if (metrics) {
      metrics.reconnections++;
    }

    await this.startStream(streamId);
  }

  // Stream operations
  async pauseStream(streamId: string): Promise<void> {
    const stream = this.streams.get(streamId);
    const state = this.streamStates.get(streamId);

    if (!stream || !state) {
      throw new Error(`Stream '${streamId}' not found`);
    }

    if (state.status === 'ACTIVE') {
      // Note: MongoDB change streams don't have a native pause,
      // so we'll stop processing events but keep the stream open
      state.status = 'INACTIVE';
      this.emit('stream-paused', { streamId });
    }
  }

  async resumeStream(streamId: string): Promise<void> {
    const stream = this.streams.get(streamId);
    const state = this.streamStates.get(streamId);

    if (!stream || !state) {
      throw new Error(`Stream '${streamId}' not found`);
    }

    if (state.status === 'INACTIVE') {
      state.status = 'ACTIVE';
      this.emit('stream-resumed', { streamId });
    }
  }

  // Getters
  getStreamState(streamId: string): StreamState | undefined {
    return this.streamStates.get(streamId);
  }

  getStreamMetrics(streamId: string): StreamMetrics | undefined {
    const metrics = this.streamMetrics.get(streamId);
    if (!metrics) {
      return undefined;
    }

    const now = Date.now();
    const uptimeMs = now - metrics.startTime.getTime();

    return {
      ...metrics,
      uptime: Math.floor(uptimeMs / 1000)
    };
  }

  getAllStreams(): string[] {
    return Array.from(this.streams.keys());
  }

  getActiveStreams(): string[] {
    return Array.from(this.streamStates.entries())
      .filter(([_, state]) => state.status === 'ACTIVE')
      .map(([streamId, _]) => streamId);
  }

  // Resume token management
  getResumeToken(streamId: string): ResumeToken | undefined {
    return this.resumeTokens.get(streamId);
  }

  async saveResumeToken(streamId: string, token: ResumeToken): Promise<void> {
    this.resumeTokens.set(streamId, token);

    if (this.config.resumeToken.enabled) {
      await this.persistResumeToken(streamId, token);
    }
  }

  async clearResumeToken(streamId: string): Promise<void> {
    this.resumeTokens.delete(streamId);

    if (this.config.resumeToken.enabled) {
      await this.removePersistedResumeToken(streamId);
    }
  }

  // Shutdown
  async shutdown(): Promise<void> {
    this.isShuttingDown = true;

    // Stop all streams
    const streamIds = Array.from(this.streams.keys());
    const shutdownPromises = streamIds.map(streamId =>
      this.destroyStream(streamId).catch(error => ({
        streamId,
        error: (error as Error).message
      }))
    );

    await Promise.all(shutdownPromises);

    // Save all resume tokens
    if (this.config.resumeToken.enabled) {
      await this.saveAllResumeTokens();
    }

    this.emit('manager-shutdown');
  }

  // Private methods
  private async startStream(streamId: string): Promise<void> {
    const state = this.streamStates.get(streamId);
    if (!state) {
      throw new Error(`Stream state for '${streamId}' not found`);
    }

    state.status = 'STARTING';
    state.retryAttempt = 0;

    try {
      await this.createChangeStream(streamId);
      state.status = 'ACTIVE';

      this.emit('stream-started', { streamId });
    } catch (error) {
      state.status = 'ERROR';
      state.errorCount++;

      this.emit('stream-start-failed', {
        streamId,
        error: (error as Error).message
      });

      // Schedule retry
      this.scheduleStreamRetry(streamId);
      throw error;
    }
  }

  private async createChangeStream(streamId: string): Promise<void> {
    const state = this.streamStates.get(streamId);
    if (!state) {
      throw new Error(`Stream state for '${streamId}' not found`);
    }

    const { subscription } = state;

    // Prepare change stream options
    const options: ChangeStreamOptions = {
      ...subscription.options,
      fullDocument: this.config.fullDocument,
      batchSize: this.config.batchSize,
      maxAwaitTimeMS: this.config.maxAwaitTimeMS
    };

    // Add resume token if available
    if (state.resumeToken) {
      options.resumeAfter = state.resumeToken;
    }

    // Create change stream
    const changeStream = this.db.watch(subscription.pipeline, options);

    // Setup event handlers
    this.setupStreamEventHandlers(streamId, changeStream);

    // Store stream
    this.streams.set(streamId, changeStream);

    // Setup event buffering
    if (this.config.performance.bufferSize > 0) {
      this.setupEventBuffering(streamId);
    }
  }

  private setupStreamEventHandlers(streamId: string, stream: ChangeStream): void {
    const state = this.streamStates.get(streamId);
    const metrics = this.streamMetrics.get(streamId);

    if (!state || !metrics) {
      return;
    }

    // Handle change events
    stream.on('change', (change: ChangeStreamDocument) => {
      if (state.status !== 'ACTIVE') {
        return;
      }

      const startTime = Date.now();

      try {
        // Update resume token
        if (change._id) {
          state.resumeToken = change._id;
          state.lastProcessedTime = new Date();
        }

                 // Convert to adapter change format
         const adapterChange: AdapterChange = {
           type: this.mapChangeType(change.operationType),
           collection: (change as any).ns?.coll || 'unknown',
           documentId: (change as any).documentKey?._id?.toString() || 'unknown',
           document: (change as any).fullDocument,
           previousDocument: (change as any).fullDocumentBeforeChange,
           timestamp: new Date()
         };

        // Buffer or process immediately
        if (this.config.performance.bufferSize > 0) {
          this.bufferEvent(streamId, change);
        } else {
          this.processEvent(streamId, adapterChange);
        }

        // Update metrics
        metrics.totalEvents++;
        metrics.lastEventTime = new Date();

        const processingTime = Date.now() - startTime;
        metrics.averageProcessingTime =
          (metrics.averageProcessingTime * (metrics.totalEvents - 1) + processingTime) / metrics.totalEvents;

        // Calculate events per second
        const timeWindow = 60000; // 1 minute
        const eventsInWindow = metrics.totalEvents; // Simplified calculation
        metrics.eventsPerSecond = eventsInWindow / (timeWindow / 1000);

      } catch (error) {
        this.handleStreamError(streamId, error as Error);
      }
    });

    // Handle stream errors
    stream.on('error', (error: Error) => {
      this.handleStreamError(streamId, error);
    });

    // Handle stream close
    stream.on('close', () => {
      this.emit('stream-closed', { streamId });
    });
  }

  private setupEventBuffering(streamId: string): void {
    const flushInterval = setInterval(() => {
      this.flushEventBuffer(streamId);
    }, this.config.performance.flushIntervalMs);

    this.flushIntervals.set(streamId, flushInterval);
  }

  private bufferEvent(streamId: string, change: ChangeStreamDocument): void {
    const buffer = this.eventBuffer.get(streamId);
    if (!buffer) {
      return;
    }

    buffer.push(change);

    // Flush if buffer is full
    if (buffer.length >= this.config.performance.bufferSize) {
      this.flushEventBuffer(streamId);
    }
  }

  private async flushEventBuffer(streamId: string): Promise<void> {
    const buffer = this.eventBuffer.get(streamId);
    const state = this.streamStates.get(streamId);

    if (!buffer || !state || buffer.length === 0) {
      return;
    }

         // Process all buffered events
     for (const change of buffer) {
       const adapterChange: AdapterChange = {
         type: this.mapChangeType(change.operationType),
         collection: (change as any).ns?.coll || 'unknown',
         documentId: (change as any).documentKey?._id?.toString() || 'unknown',
         document: (change as any).fullDocument,
         previousDocument: (change as any).fullDocumentBeforeChange,
         timestamp: new Date()
       };

       this.processEvent(streamId, adapterChange);
     }

    // Clear buffer
    buffer.length = 0;

    // Save resume token from last event
    const lastChange = buffer[buffer.length - 1];
    if (lastChange?._id) {
      await this.saveResumeToken(streamId, lastChange._id);
    }
  }

  private processEvent(streamId: string, change: AdapterChange): void {
    const state = this.streamStates.get(streamId);
    if (!state) {
      return;
    }

    try {
      // Apply filter if specified
      if (state.subscription.filter) {
        if (!this.matchesFilter(change, state.subscription.filter)) {
          return;
        }
      }

      // Call subscription callback
      state.subscription.callback(change);
      state.subscription.lastActivity = new Date();

    } catch (error) {
      this.handleStreamError(streamId, error as Error);
    }
  }

  private handleStreamError(streamId: string, error: Error): void {
    const state = this.streamStates.get(streamId);
    const metrics = this.streamMetrics.get(streamId);

    if (!state || !metrics) {
      return;
    }

    state.errorCount++;
    metrics.errorCount++;
    state.status = 'ERROR';

    this.emit('stream-error', {
      streamId,
      error: error.message,
      errorCount: state.errorCount
    });

    // Schedule retry if not exceeding max retries
    if (state.errorCount < this.config.errorHandling.maxRetries) {
      this.scheduleStreamRetry(streamId);
    } else {
      this.emit('stream-failed', {
        streamId,
        error: 'Max retries exceeded',
        totalErrors: state.errorCount
      });
    }
  }

  private scheduleStreamRetry(streamId: string): void {
    const state = this.streamStates.get(streamId);
    if (!state || this.retryTimeouts.has(streamId)) {
      return;
    }

    const delay = this.calculateRetryDelay(state.retryAttempt);
    state.retryAttempt++;

    this.emit('stream-retry-scheduled', {
      streamId,
      delay,
      attempt: state.retryAttempt
    });

    const timeout = setTimeout(async () => {
      this.retryTimeouts.delete(streamId);

      try {
        await this.restartStream(streamId);
      } catch (error) {
        this.emit('stream-retry-failed', {
          streamId,
          error: (error as Error).message
        });
      }
    }, delay);

    this.retryTimeouts.set(streamId, timeout);
  }

  private calculateRetryDelay(attempt: number): number {
    const baseDelay = this.config.errorHandling.retryDelayMs;
    const multiplier = Math.pow(this.config.errorHandling.backoffMultiplier, attempt);
    const delay = baseDelay * multiplier;

    return Math.min(delay, this.config.errorHandling.maxRetryDelayMs);
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

  private matchesFilter(change: AdapterChange, filter: Record<string, any>): boolean {
    // Simple filter matching - can be enhanced
    for (const [key, value] of Object.entries(filter)) {
      if (change.collection === key && change.type === value) {
        return true;
      }
    }
    return true; // Default to true for now
  }

  // Resume token persistence
  private async loadResumeTokens(): Promise<void> {
    // Implementation depends on persistence strategy
    switch (this.config.resumeToken.persistenceStrategy) {
      case 'memory':
        // Already in memory
        break;
      case 'file':
        await this.loadResumeTokensFromFile();
        break;
      case 'database':
        await this.loadResumeTokensFromDatabase();
        break;
    }
  }

  private async saveAllResumeTokens(): Promise<void> {
    const savePromises = Array.from(this.resumeTokens.entries()).map(([streamId, token]) =>
      this.persistResumeToken(streamId, token)
    );

    await Promise.all(savePromises);
  }

  private async persistResumeToken(streamId: string, token: ResumeToken): Promise<void> {
    switch (this.config.resumeToken.persistenceStrategy) {
      case 'memory':
        // Already in memory
        break;
      case 'file':
        await this.saveResumeTokenToFile(streamId, token);
        break;
      case 'database':
        await this.saveResumeTokenToDatabase(streamId, token);
        break;
    }
  }

  private async removePersistedResumeToken(streamId: string): Promise<void> {
    switch (this.config.resumeToken.persistenceStrategy) {
      case 'memory':
        // Already removed from memory
        break;
      case 'file':
        await this.removeResumeTokenFromFile(streamId);
        break;
      case 'database':
        await this.removeResumeTokenFromDatabase(streamId);
        break;
    }
  }

  // File-based persistence (simplified implementation)
  private async loadResumeTokensFromFile(): Promise<void> {
    // Implementation would read from file system
    // For now, this is a placeholder
  }

  private async saveResumeTokenToFile(streamId: string, token: ResumeToken): Promise<void> {
    // Implementation would save to file system
    // For now, this is a placeholder
  }

  private async removeResumeTokenFromFile(streamId: string): Promise<void> {
    // Implementation would remove from file system
    // For now, this is a placeholder
  }

  // Database-based persistence (simplified implementation)
  private async loadResumeTokensFromDatabase(): Promise<void> {
    // Implementation would read from database
    // For now, this is a placeholder
  }

  private async saveResumeTokenToDatabase(streamId: string, token: ResumeToken): Promise<void> {
    // Implementation would save to database
    // For now, this is a placeholder
  }

  private async removeResumeTokenFromDatabase(streamId: string): Promise<void> {
    // Implementation would remove from database
    // For now, this is a placeholder
  }
}