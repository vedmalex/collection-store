/**
 * Core types for Real-time Subscription System
 * Phase 3: Real-time Subscriptions & Notifications
 */

import type { User } from '../../auth/interfaces/types'

// ============================================================================
// Core Subscription Types
// ============================================================================

export interface Subscription {
  id: string
  userId: string
  query: ParsedSubscriptionQuery
  connection: Connection
  context: SubscriptionContext
  createdAt: Date
  lastActivity: Date
  status: 'active' | 'paused' | 'closed'
  metadata: SubscriptionMetadata
}

export interface SubscriptionQuery {
  resourceType?: 'database' | 'collection' | 'document' | 'field'
  database?: string
  collection?: string
  documentId?: string
  fieldPath?: string
  filters?: SubscriptionFilter[]
  includeInitialData?: boolean
  includeMetadata?: boolean
  batchSize?: number
  throttleMs?: number
}

export interface ParsedSubscriptionQuery {
  id: string
  resourceType: 'database' | 'collection' | 'document' | 'field'
  database?: string
  collection?: string
  documentId?: string
  fieldPath?: string
  filters: ParsedFilter[]
  options: SubscriptionOptions
}

export interface SubscriptionOptions {
  includeInitialData: boolean
  includeMetadata: boolean
  batchSize: number
  throttleMs: number
}

export interface SubscriptionContext {
  tabId?: string
  userAgent?: string
  ipAddress?: string
  customData?: Record<string, any>
}

export interface SubscriptionMetadata {
  userAgent?: string
  ipAddress?: string
  tabId?: string
  protocol?: 'websocket' | 'sse'
  connectionTime?: number
}

// ============================================================================
// Filter Types
// ============================================================================

export interface SubscriptionFilter {
  type: 'field' | 'user' | 'custom'
}

export interface FieldFilter extends SubscriptionFilter {
  type: 'field'
  field: string
  operator: 'eq' | 'ne' | 'gt' | 'gte' | 'lt' | 'lte' | 'in' | 'nin' | 'regex'
  value: any
  caseSensitive?: boolean
}

export interface UserFilter extends SubscriptionFilter {
  type: 'user'
  userField: string
  operator: 'eq' | 'ne' | 'in' | 'nin'
  value: any
}

export interface CustomFilter extends SubscriptionFilter {
  type: 'custom'
  evaluator: (data: any, context: FilterContext) => boolean | Promise<boolean>
}

export interface ParsedFilter {
  type: 'field' | 'user' | 'custom'
}

export interface ParsedFieldFilter extends ParsedFilter {
  type: 'field'
  field: string
  operator: string
  value: any
  caseSensitive: boolean
}

export interface ParsedUserFilter extends ParsedFilter {
  type: 'user'
  userField: string
  operator: string
  value: any
}

export interface ParsedCustomFilter extends ParsedFilter {
  type: 'custom'
  evaluator: (data: any, context: FilterContext) => boolean | Promise<boolean>
}

export interface FilterContext {
  user: User
  subscription: Subscription
  timestamp: number
}

// ============================================================================
// Connection Types
// ============================================================================

export interface Connection {
  id: string
  user: User
  protocol: 'websocket' | 'sse'
  readyState: number
  subscriptions: Set<string>
  metadata: ConnectionMetadata
  transport: any // WebSocket or SSE Response
}

export interface WebSocketConnection extends Connection {
  socket: any // WebSocket
  protocol: 'websocket'
}

export interface SSEConnection extends Connection {
  response: any // Response
  protocol: 'sse'
}

export interface ConnectionMetadata {
  userAgent?: string
  ipAddress?: string
  protocol: 'websocket' | 'sse'
  connectedAt: Date
  lastActivity: Date
}

// ============================================================================
// Data Change Types
// ============================================================================

export interface DataChange {
  id: string
  resourceType: 'database' | 'collection' | 'document' | 'field'
  database: string
  collection?: string
  documentId?: string
  operation: 'insert' | 'update' | 'delete'
  data?: any
  previousData?: any
  affectedFields?: string[]
  timestamp: number
  userId?: string
  transactionId?: string
}

// ============================================================================
// Message Types
// ============================================================================

export interface WebSocketMessage {
  type: 'subscribe' | 'unsubscribe' | 'ping' | 'get_subscriptions' | 'data_change' | 'error' | 'connection_established' | 'subscription_created'
  data?: any
  id?: string
  timestamp?: number
}

export interface SubscriptionRequest {
  query: SubscriptionQuery
  tabId?: string
  options?: SubscriptionRequestOptions
}

export interface SubscriptionRequestOptions {
  priority?: 'low' | 'normal' | 'high'
  timeout?: number
}

// ============================================================================
// Error Types
// ============================================================================

export class SubscriptionError extends Error {
  constructor(
    message: string,
    public details?: Record<string, any>
  ) {
    super(message)
    this.name = 'SubscriptionError'
  }
}

export class QueryParseError extends Error {
  constructor(
    message: string,
    public query?: SubscriptionQuery
  ) {
    super(message)
    this.name = 'QueryParseError'
  }
}

export class ConnectionError extends Error {
  constructor(
    message: string,
    public details?: Record<string, any>
  ) {
    super(message)
    this.name = 'ConnectionError'
  }
}

// ============================================================================
// Configuration Types
// ============================================================================

export interface SubscriptionConfig {
  query: QueryParserConfig
  filtering: DataFilterConfig
  notifications: NotificationConfig
  connections: ConnectionConfig
}

export interface QueryParserConfig {
  maxFilters: number
  allowCustomFilters: boolean
  defaultBatchSize: number
  maxBatchSize: number
  defaultThrottleMs: number
  maxThrottleMs: number
}

export interface DataFilterConfig {
  enableCaching: boolean
  cacheTTL: number
  maxCacheSize: number
}

export interface NotificationConfig {
  batchSize: number
  batchTimeoutMs: number
  maxRetries: number
  retryDelayMs: number
}

export interface AuthenticationConfig {
  enableRateLimit: boolean
  maxAttemptsPerMinute: number
  tokenExpirationCheck: boolean
  sessionValidationInterval: number
}

export interface AuthenticationResult {
  success: boolean
  user?: User
  error?: string
  details?: Record<string, any>
  metadata?: {
    authMethod?: 'jwt' | 'session'
    tokenType?: string
    sessionId?: string
    authenticatedAt?: Date
    expiresAt?: Date
    refreshedAt?: Date
    userAgent?: string
    ipAddress?: string
  }
}

export interface ConnectionConfig {
  maxConnections: number
  maxConnectionsPerUser: number
  connectionTimeout: number
  pingInterval?: number
  keepAliveInterval?: number
  cleanupInterval?: number
}

// ============================================================================
// Statistics Types
// ============================================================================

export interface SubscriptionStats {
  totalSubscriptions: number
  activeSubscriptions: number
  subscriptionsByUser: Map<string, number>
  subscriptionsByCollection: Map<string, number>
  averageSubscriptionAge: number
  messagesProcessed: number
  averageProcessingTime: number
}

export interface ConnectionStats {
  totalConnections: number
  activeConnections: number
  messagesSent: number
  messagesReceived: number
  errors: number
  connectionsByProtocol: Map<string, number>
  averageConnectionDuration: number
  peakConnections: number
  startTime: Date
}

// ============================================================================
// Utility Types
// ============================================================================

export type SubscriptionId = string
export type ConnectionId = string
export type UserId = string

export interface PaginationResult<T> {
  data: T[]
  nextCursor?: string
  hasMore: boolean
  totalCount?: number
}

export interface CacheStats {
  hitRate: number
  missRate: number
  totalRequests: number
  cacheSize: number
  memoryUsage: number
}

// ============================================================================
// Notification Types
// ============================================================================

export type NotificationPriority = 'low' | 'normal' | 'high'

export interface NotificationBatch {
  connectionId: string
  notifications: any[]
  createdAt: number
}

export interface NotificationStats {
  sent: number
  errors: number
  batched: number
  immediate: number
  retries: number
  averageLatency: number
  peakThroughput: number
  startTime: Date
}

export interface NotificationResult {
  success: boolean
  error?: string
  subscriptionId?: string
  connectionId?: string
  notificationId?: string
  batched?: boolean
}

// ============================================================================
// Chunked Streaming Types (Priority 1 Fix)
// ============================================================================

export interface StreamOptions {
  chunkSize: number
  compression: boolean
  format: 'json' | 'messagepack'
  timeout?: number
}

export interface ChunkData {
  chunk: any
  chunkIndex: number
  totalChunks: number
  isLast: boolean
  compressed?: boolean
  format?: 'json' | 'messagepack'
}

export interface StreamingSession {
  id: string
  connectionId: string
  totalChunks: number
  sentChunks: number
  startTime: number
  options: StreamOptions
}

// ============================================================================
// Cross-Tab Synchronization Types (Priority 2 Fix)
// ============================================================================

export interface DataUpdate {
  type: 'insert' | 'update' | 'delete' | 'cache_update'
  collection: string
  documentId: string
  data?: any
  changes?: ChangeRecord[]
  timestamp: number
  sourceTabId?: string
}

export interface ChangeRecord {
  type: 'insert' | 'update' | 'delete'
  documentId: string
  data?: any
  previousData?: any
}

export interface CrossTabMessage {
  type: 'data_update' | 'subscription_coordination' | 'tab_registered' | 'tab_closed'
  data?: any
  sourceTabId: string
  timestamp: number
}

export interface TabInfo {
  id: string
  userId: string
  registeredAt: Date
  lastActivity: Date
  subscriptions: string[]
}

// ============================================================================
// Protocol Management Types (Priority 3 Fix)
// ============================================================================

export interface ProtocolConfig {
  preferred: 'websocket' | 'sse'
  fallback: 'websocket' | 'sse'
  format: 'json' | 'messagepack'
  compression: boolean
}

export interface MessagePackOptions {
  enabled: boolean
  compressionLevel?: number
  maxSize?: number
}

// ============================================================================
// Client-Side Data Management Types (Priority 4 Fix)
// ============================================================================

export interface ClientDataCache {
  collection: string
  data: Map<string, any>
  lastUpdated: Date
  filters?: SubscriptionFilter[]
}

export interface SyncStatus {
  connected: boolean
  lastSync: Date
  pendingChanges: number
  conflictCount: number
}

export interface ConflictResolution {
  strategy: 'client_wins' | 'server_wins' | 'merge' | 'manual'
  resolvedData?: any
  mergeRules?: MergeRule[]
}

export interface MergeRule {
  field: string
  strategy: 'client' | 'server' | 'latest' | 'custom'
  customResolver?: (clientValue: any, serverValue: any) => any
}

// ============================================================================
// Enhanced Interfaces
// ============================================================================

export interface ICrossTabSynchronizer {
  registerTab(tabId: string, userId: string): void
  unregisterTab(tabId: string): void
  broadcastUpdate(update: DataUpdate): void
  coordinateSubscriptions(userId: string): void
  onUpdate(handler: (update: DataUpdate) => void): void
  getActiveTabsForUser(userId: string): string[]
}

export interface IClientDataManager {
  syncSubset(collections: string[], filters: SubscriptionFilter[]): Promise<void>
  getLocalData(collection: string, query?: any): Promise<any[]>
  updateLocalData(collection: string, changes: ChangeRecord[]): Promise<void>
  enableOfflineMode(enabled: boolean): void
  syncPendingChanges(): Promise<ConflictResolution[]>
}