import type { CSDatabase } from '../../..';
import type { User } from '../../interfaces';
import type {
  ComputationContext,
  HttpClient,
  AuthContext
} from '../types';
import {
  ComputedAttributeErrorFactory,
  ComputedAttributeErrorCodeDetailed
} from '../types/ErrorTypes';

/**
 * Configuration for context building
 */
export interface ContextBuilderConfig {
  enableHttpClient: boolean;
  enableDatabaseAccess: boolean;
  enableUserContext: boolean;
  enableCustomData: boolean;
  defaultTimeout: number;
  maxCustomDataSize: number; // bytes
}

/**
 * Default configuration
 */
export const DEFAULT_CONTEXT_BUILDER_CONFIG: ContextBuilderConfig = {
  enableHttpClient: false, // Disabled by default for security
  enableDatabaseAccess: true,
  enableUserContext: true,
  enableCustomData: true,
  defaultTimeout: 30000, // 30 seconds
  maxCustomDataSize: 1024 * 1024 // 1MB
};

/**
 * Context building options
 */
export interface ContextBuildOptions {
  target: any;
  targetId: string;
  targetType: 'user' | 'document' | 'collection' | 'database';
  database?: CSDatabase;
  currentCollection?: any;
  currentUser?: User;
  authContext?: AuthContext;
  customData?: Record<string, any>;
  httpClient?: HttpClient;
  nodeId?: string;
}

/**
 * Simple HTTP client implementation
 */
export class SimpleHttpClient implements HttpClient {
  private timeout: number;

  constructor(timeout: number = 5000) {
    this.timeout = timeout;
  }

  async get(url: string, options?: { timeout?: number; headers?: Record<string, string> }): Promise<any> {
    return this.makeRequest('GET', url, undefined, options);
  }

  async post(url: string, data?: any, options?: { timeout?: number; headers?: Record<string, string> }): Promise<any> {
    return this.makeRequest('POST', url, data, options);
  }

  async put(url: string, data?: any, options?: { timeout?: number; headers?: Record<string, string> }): Promise<any> {
    return this.makeRequest('PUT', url, data, options);
  }

  async delete(url: string, options?: { timeout?: number; headers?: Record<string, string> }): Promise<any> {
    return this.makeRequest('DELETE', url, undefined, options);
  }

  private async makeRequest(
    method: string,
    url: string,
    data?: any,
    options?: { timeout?: number; headers?: Record<string, string> }
  ): Promise<any> {
    const timeout = options?.timeout || this.timeout;

    try {
      // Use fetch if available (Node.js 18+ or browser)
      if (typeof fetch !== 'undefined') {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), timeout);

        try {
          const response = await fetch(url, {
            method,
            headers: {
              'Content-Type': 'application/json',
              ...options?.headers
            },
            body: data ? JSON.stringify(data) : undefined,
            signal: controller.signal
          });

          clearTimeout(timeoutId);

          if (!response.ok) {
            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
          }

          const responseData = await response.json();
          return {
            status: response.status,
            statusText: response.statusText,
            data: responseData,
            headers: Object.fromEntries(response.headers.entries())
          };
        } catch (error) {
          clearTimeout(timeoutId);
          throw error;
        }
      } else {
        // Fallback for environments without fetch
        throw new Error('HTTP client not available in this environment');
      }
    } catch (error) {
      throw ComputedAttributeErrorFactory.create(
        `HTTP request failed: ${error}`,
        ComputedAttributeErrorCodeDetailed.EXTERNAL_REQUEST_FAILED,
        'external',
        { originalError: error as Error }
      );
    }
  }
}

/**
 * ComputationContextBuilder creates computation contexts with proper data access
 */
export class ComputationContextBuilder {
  private config: ContextBuilderConfig;
  private httpClient?: HttpClient;
  private isInitialized = false;

  constructor(config: Partial<ContextBuilderConfig> = {}) {
    this.config = { ...DEFAULT_CONTEXT_BUILDER_CONFIG, ...config };
  }

  /**
   * Initialize the context builder
   */
  async initialize(): Promise<void> {
    if (this.isInitialized) {
      throw ComputedAttributeErrorFactory.create(
        'ComputationContextBuilder already initialized',
        ComputedAttributeErrorCodeDetailed.CONFIGURATION_ERROR
      );
    }

    // Initialize HTTP client if enabled
    if (this.config.enableHttpClient) {
      this.httpClient = new SimpleHttpClient(this.config.defaultTimeout);
    }

    this.isInitialized = true;
  }

  /**
   * Build a computation context
   */
  async buildContext(options: ContextBuildOptions): Promise<ComputationContext> {
    this.ensureInitialized();

    // Validate required options
    this.validateBuildOptions(options);

    // Build the context
    const context: ComputationContext = {
      target: options.target,
      targetId: options.targetId,
      targetType: options.targetType,
      database: options.database!, // Database is required in ComputationContext
      timestamp: Date.now(),
      nodeId: options.nodeId || this.generateNodeId()
    };

    // Add collection if provided
    if (options.currentCollection) {
      context.currentCollection = options.currentCollection;
    }

    // Add user context if enabled and provided
    if (this.config.enableUserContext) {
      if (options.currentUser) {
        context.currentUser = options.currentUser;
      }
      if (options.authContext) {
        context.authContext = options.authContext;
      }
    }

    // Add HTTP client if enabled
    if (this.config.enableHttpClient) {
      context.httpClient = options.httpClient || this.httpClient;
    }

    // Add custom data if enabled and provided
    if (this.config.enableCustomData && options.customData) {
      const customDataSize = this.calculateDataSize(options.customData);
      if (customDataSize > this.config.maxCustomDataSize) {
        throw ComputedAttributeErrorFactory.create(
          `Custom data size exceeds limit: ${customDataSize} > ${this.config.maxCustomDataSize} bytes`,
          ComputedAttributeErrorCodeDetailed.MEMORY_LIMIT_EXCEEDED,
          'validation'
        );
      }
      context.customData = { ...options.customData };
    }

    return context;
  }

  /**
   * Build context for user target
   */
  async buildUserContext(
    user: any,
    userId: string,
    database?: CSDatabase,
    currentUser?: User,
    customData?: Record<string, any>
  ): Promise<ComputationContext> {
    return this.buildContext({
      target: user,
      targetId: userId,
      targetType: 'user',
      database,
      currentUser,
      customData
    });
  }

  /**
   * Build context for document target
   */
  async buildDocumentContext(
    document: any,
    documentId: string,
    collection: any,
    database?: CSDatabase,
    currentUser?: User,
    customData?: Record<string, any>
  ): Promise<ComputationContext> {
    return this.buildContext({
      target: document,
      targetId: documentId,
      targetType: 'document',
      database,
      currentCollection: collection,
      currentUser,
      customData
    });
  }

  /**
   * Build context for collection target
   */
  async buildCollectionContext(
    collection: any,
    collectionName: string,
    database?: CSDatabase,
    currentUser?: User,
    customData?: Record<string, any>
  ): Promise<ComputationContext> {
    return this.buildContext({
      target: collection,
      targetId: collectionName,
      targetType: 'collection',
      database,
      currentCollection: collection,
      currentUser,
      customData
    });
  }

  /**
   * Build context for database target
   */
  async buildDatabaseContext(
    database: CSDatabase,
    databaseName: string,
    currentUser?: User,
    customData?: Record<string, any>
  ): Promise<ComputationContext> {
    return this.buildContext({
      target: database,
      targetId: databaseName,
      targetType: 'database',
      database,
      currentUser,
      customData
    });
  }

  /**
   * Create auth context from request information
   */
  createAuthContext(
    ip: string,
    userAgent: string,
    region?: string,
    customAttributes?: Record<string, any>
  ): AuthContext {
    return {
      ip,
      userAgent,
      region,
      timestamp: Date.now(),
      customAttributes
    };
  }

  /**
   * Set custom HTTP client
   */
  setHttpClient(httpClient: HttpClient): void {
    this.httpClient = httpClient;
  }

  /**
   * Update configuration
   */
  updateConfig(newConfig: Partial<ContextBuilderConfig>): void {
    this.config = { ...this.config, ...newConfig };

    // Reinitialize HTTP client if needed
    if (this.config.enableHttpClient && !this.httpClient) {
      this.httpClient = new SimpleHttpClient(this.config.defaultTimeout);
    } else if (!this.config.enableHttpClient) {
      this.httpClient = undefined;
    }
  }

  /**
   * Get current configuration
   */
  getConfig(): ContextBuilderConfig {
    return { ...this.config };
  }

  /**
   * Validate build options
   */
  private validateBuildOptions(options: ContextBuildOptions): void {
    if (!options.targetId || typeof options.targetId !== 'string') {
      throw ComputedAttributeErrorFactory.create(
        'Target ID is required and must be a string',
        ComputedAttributeErrorCodeDetailed.INVALID_DEFINITION,
        'validation'
      );
    }

    if (!options.targetType || !['user', 'document', 'collection', 'database'].includes(options.targetType)) {
      throw ComputedAttributeErrorFactory.create(
        'Target type must be one of: user, document, collection, database',
        ComputedAttributeErrorCodeDetailed.INVALID_TARGET_TYPE,
        'validation'
      );
    }

    if (!options.database) {
      throw ComputedAttributeErrorFactory.create(
        'Database is required for computation context',
        ComputedAttributeErrorCodeDetailed.INVALID_DEFINITION,
        'validation'
      );
    }
  }

  /**
   * Calculate approximate size of data in bytes
   */
  private calculateDataSize(data: any): number {
    try {
      return new TextEncoder().encode(JSON.stringify(data)).length;
    } catch {
      // Fallback estimation
      return JSON.stringify(data).length * 2; // Rough estimate for UTF-8
    }
  }

  /**
   * Generate a unique node ID
   */
  private generateNodeId(): string {
    return `node-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Ensure builder is initialized
   */
  private ensureInitialized(): void {
    if (!this.isInitialized) {
      throw ComputedAttributeErrorFactory.create(
        'ComputationContextBuilder not initialized',
        ComputedAttributeErrorCodeDetailed.CONFIGURATION_ERROR
      );
    }
  }
}