/**
 * Core Real-time Subscription Engine
 * Phase 3: Real-time Subscriptions & Notifications
 */

import { EventEmitter } from 'events'
import type { User } from '../../auth/interfaces/types'
import type { CSDatabase } from '../../core/Database'
// import type { AuthorizationEngine } from '../../auth/core/AuthorizationEngine'
// import type { AuditLogger } from '../../auth/core/AuditLogger'
import type {
  ISubscriptionEngine,
  EngineHealth,
  EngineMetrics
} from '../interfaces/ISubscriptionEngine'
import type {
  Subscription,
  SubscriptionQuery,
  SubscriptionContext,
  DataChange,
  SubscriptionStats,
  Connection,
  SubscriptionId,
  UserId,
  ParsedSubscriptionQuery,
  SubscriptionConfig
} from '../interfaces/types'
import {
  SubscriptionError,
  QueryParseError
} from '../interfaces/types'
import { QueryParser } from './QueryParser'
import { DataFilter } from './DataFilter'

// Temporary auth stubs
interface AuthorizationEngine {
  checkPermission(user: User, resource: any, action: string, context?: any): Promise<{ allowed: boolean; reason: string }>
}

interface AuditLogger {
  log(entry: any): Promise<void>
}

export class SubscriptionEngine extends EventEmitter implements ISubscriptionEngine {
  private subscriptions = new Map<string, Subscription>()
  private userSubscriptions = new Map<string, Set<string>>()
  private connectionSubscriptions = new Map<string, Set<string>>()
  private queryParser: QueryParser
  private dataFilter: DataFilter
  private _isRunning = false
  private startTime: number = 0
  private metrics: EngineMetrics
  private maintenanceInterval?: NodeJS.Timeout

  // Protocol Management (Priority 3 Fix)
  private protocol: 'sse' | 'websocket' = 'websocket'
  private format: 'json' | 'messagepack' = 'json'
  private protocolConfig = {
    preferred: 'websocket' as 'websocket' | 'sse',
    fallback: 'sse' as 'websocket' | 'sse',
    format: 'json' as 'json' | 'messagepack',
    compression: false
  }

  constructor(
    private database: CSDatabase,
    private authorizationEngine: AuthorizationEngine,
    private auditLogger: AuditLogger,
    private config: SubscriptionConfig
  ) {
    super()
    this.queryParser = new QueryParser(config.query)
    this.dataFilter = new DataFilter(config.filtering, authorizationEngine)
    this.initializeMetrics()
    this.setupDatabaseChangeListeners()
  }

  // ============================================================================
  // Core Subscription Management
  // ============================================================================

  async subscribe(
    user: User,
    query: SubscriptionQuery,
    connection: Connection,
    context?: SubscriptionContext
  ): Promise<Subscription> {
    const startTime = performance.now()

    try {
      // 1. Validate engine is running
      if (!this._isRunning) {
        throw new SubscriptionError('Subscription engine is not running')
      }

      // 2. Parse and validate subscription query
      const parsedQuery = await this.queryParser.parse(query)

      // 3. Check authorization for subscription
      const authResult = await this.checkSubscriptionPermission(user, parsedQuery)
      if (!authResult.allowed) {
        throw new SubscriptionError('Subscription not authorized', {
          reason: authResult.reason,
          query: parsedQuery
        })
      }

      // 4. Check connection limits
      await this.checkConnectionLimits(user.id, connection.id)

      // 5. Create subscription
      const subscription: Subscription = {
        id: this.generateSubscriptionId(),
        userId: user.id,
        query: parsedQuery,
        connection,
        context: context || {},
        createdAt: new Date(),
        lastActivity: new Date(),
        status: 'active',
        metadata: {
          userAgent: context?.userAgent,
          ipAddress: context?.ipAddress,
          tabId: context?.tabId,
          protocol: connection.metadata.protocol,
          connectionTime: performance.now() - startTime
        }
      }

      // 6. Store subscription in indexes
      this.subscriptions.set(subscription.id, subscription)

      // Index by user
      if (!this.userSubscriptions.has(user.id)) {
        this.userSubscriptions.set(user.id, new Set())
      }
      this.userSubscriptions.get(user.id)!.add(subscription.id)

      // Index by connection
      if (!this.connectionSubscriptions.has(connection.id)) {
        this.connectionSubscriptions.set(connection.id, new Set())
      }
      this.connectionSubscriptions.get(connection.id)!.add(subscription.id)

      // 7. Add to connection's subscription set
      connection.subscriptions.add(subscription.id)

      // 8. Send initial data if requested
      if (parsedQuery.options.includeInitialData) {
        await this.sendInitialData(subscription)
      }

      // 9. Update metrics
      this.metrics.subscriptionsCreated++
      this.updateMetrics('subscription_created', performance.now() - startTime)

      // 10. Audit log
      await this.auditLogger.log({
        action: 'subscription_created',
        userId: user.id,
        resource: `subscription:${subscription.id}`,
        result: 'success',
        context: {
          ip: context?.ipAddress || 'unknown',
          userAgent: context?.userAgent || 'unknown',
          timestamp: Date.now()
        },
        details: {
          subscriptionId: subscription.id,
          query: parsedQuery,
          creationTime: performance.now() - startTime
        }
      })

      // 11. Emit event
      this.emit('subscription_created', subscription)

      return subscription
    } catch (error) {
      // Update error metrics
      this.metrics.errors++
      this.updateErrorMetrics(error)

      // Audit log failure
      await this.auditLogger.log({
        action: 'subscription_creation_failed',
        userId: user.id,
        resource: 'subscription',
        result: 'failure',
        context: {
          ip: context?.ipAddress || 'unknown',
          userAgent: context?.userAgent || 'unknown',
          timestamp: Date.now()
        },
        details: {
          error: error.message,
          query,
          creationTime: performance.now() - startTime
        }
      })

      throw error
    }
  }

  async unsubscribe(subscriptionId: SubscriptionId): Promise<void> {
    const startTime = performance.now()
    const subscription = this.subscriptions.get(subscriptionId)

    if (!subscription) {
      throw new SubscriptionError('Subscription not found', { subscriptionId })
    }

    try {
      // 1. Remove from all indexes
      this.subscriptions.delete(subscriptionId)

      // Remove from user index
      const userSubs = this.userSubscriptions.get(subscription.userId)
      if (userSubs) {
        userSubs.delete(subscriptionId)
        if (userSubs.size === 0) {
          this.userSubscriptions.delete(subscription.userId)
        }
      }

      // Remove from connection index
      const connSubs = this.connectionSubscriptions.get(subscription.connection.id)
      if (connSubs) {
        connSubs.delete(subscriptionId)
        if (connSubs.size === 0) {
          this.connectionSubscriptions.delete(subscription.connection.id)
        }
      }

      // Remove from connection's subscription set
      subscription.connection.subscriptions.delete(subscriptionId)

      // 2. Update metrics
      this.metrics.subscriptionsDestroyed++
      this.updateMetrics('subscription_destroyed', performance.now() - startTime)

      // 3. Audit log
      await this.auditLogger.log({
        action: 'subscription_ended',
        userId: subscription.userId,
        resource: `subscription:${subscriptionId}`,
        result: 'success',
        context: {
          ip: subscription.metadata.ipAddress || 'unknown',
          userAgent: subscription.metadata.userAgent || 'unknown',
          timestamp: Date.now()
        },
        details: {
          subscriptionId,
          duration: Date.now() - subscription.createdAt.getTime(),
          processingTime: performance.now() - startTime
        }
      })

      // 4. Emit event
      this.emit('subscription_destroyed', subscription)
    } catch (error) {
      this.metrics.errors++
      this.updateErrorMetrics(error)

      await this.auditLogger.log({
        action: 'subscription_unsubscribe_error',
        userId: subscription.userId,
        resource: `subscription:${subscriptionId}`,
        result: 'failure',
        context: {
          ip: subscription.metadata.ipAddress || 'unknown',
          userAgent: subscription.metadata.userAgent || 'unknown',
          timestamp: Date.now()
        },
        details: {
          subscriptionId,
          error: error.message,
          processingTime: performance.now() - startTime
        }
      })

      throw error
    }
  }

  async getSubscription(subscriptionId: SubscriptionId): Promise<Subscription | undefined> {
    return this.subscriptions.get(subscriptionId)
  }

  async getUserSubscriptions(userId: UserId): Promise<Subscription[]> {
    const subscriptionIds = this.userSubscriptions.get(userId)
    if (!subscriptionIds) {
      return []
    }

    const subscriptions: Subscription[] = []
    for (const id of subscriptionIds) {
      const subscription = this.subscriptions.get(id)
      if (subscription && subscription.status === 'active') {
        subscriptions.push(subscription)
      }
    }

    return subscriptions
  }

  async getAllSubscriptions(): Promise<Subscription[]> {
    return Array.from(this.subscriptions.values()).filter(
      sub => sub.status === 'active'
    )
  }

  // ============================================================================
  // Change Notification
  // ============================================================================

  async publishChange(change: DataChange): Promise<void> {
    const startTime = performance.now()
    let notifiedSubscriptions = 0

    try {
      // 1. Find affected subscriptions
      const affectedSubscriptions = await this.findAffectedSubscriptions(change)

      // 2. Filter and notify each subscription
      for (const subscription of affectedSubscriptions) {
        try {
          // Check if user still has permission for this data
          const hasPermission = await this.checkDataPermission(
            subscription.userId,
            change,
            subscription.query
          )

          if (hasPermission) {
            // Filter data according to subscription query and permissions
            const filteredChange = await this.dataFilter.filterChange(
              change,
              subscription.query,
              subscription.userId
            )

            if (filteredChange) {
              await this.sendChangeNotification(subscription, filteredChange)
              notifiedSubscriptions++

              // Update subscription activity
              subscription.lastActivity = new Date()
            }
          }
        } catch (error) {
          console.error(`Error notifying subscription ${subscription.id}:`, error)
          this.metrics.errors++
          // Continue with other subscriptions
        }
      }

      // 3. Update metrics
      this.metrics.messagesProcessed++
      this.updateMetrics('change_published', performance.now() - startTime)

      // 4. Emit event
      this.emit('change_published', {
        change,
        affectedSubscriptions: affectedSubscriptions.length,
        notifiedSubscriptions
      })
    } catch (error) {
      this.metrics.errors++
      this.updateErrorMetrics(error)
      console.error('Error publishing change:', error)
      throw error
    }
  }

  async publishChanges(changes: DataChange[]): Promise<void> {
    // Process changes in batches for better performance
    const batchSize = this.config.notifications.batchSize

    for (let i = 0; i < changes.length; i += batchSize) {
      const batch = changes.slice(i, i + batchSize)
      await Promise.all(batch.map(change => this.publishChange(change)))
    }
  }

  // ============================================================================
  // Subscription Lifecycle
  // ============================================================================

  async pauseSubscription(subscriptionId: SubscriptionId): Promise<void> {
    const subscription = this.subscriptions.get(subscriptionId)
    if (!subscription) {
      throw new SubscriptionError('Subscription not found', { subscriptionId })
    }

    subscription.status = 'paused'
    this.emit('subscription_paused', subscription)
  }

  async resumeSubscription(subscriptionId: SubscriptionId): Promise<void> {
    const subscription = this.subscriptions.get(subscriptionId)
    if (!subscription) {
      throw new SubscriptionError('Subscription not found', { subscriptionId })
    }

    subscription.status = 'active'
    subscription.lastActivity = new Date()
    this.emit('subscription_resumed', subscription)
  }

  async updateSubscription(
    subscriptionId: SubscriptionId,
    newQuery: SubscriptionQuery
  ): Promise<Subscription> {
    const subscription = this.subscriptions.get(subscriptionId)
    if (!subscription) {
      throw new SubscriptionError('Subscription not found', { subscriptionId })
    }

    // Parse new query
    const parsedQuery = await this.queryParser.parse(newQuery)

    // Check authorization for new query
    const authResult = await this.checkSubscriptionPermission(
      subscription.connection.user,
      parsedQuery
    )
    if (!authResult.allowed) {
      throw new SubscriptionError('Updated subscription not authorized', {
        reason: authResult.reason,
        query: parsedQuery
      })
    }

    // Update subscription
    subscription.query = parsedQuery
    subscription.lastActivity = new Date()

    this.emit('subscription_updated', subscription)
    return subscription
  }

  // ============================================================================
  // Connection Management
  // ============================================================================

  async handleConnectionClose(connectionId: string): Promise<void> {
    const subscriptionIds = this.connectionSubscriptions.get(connectionId)
    if (!subscriptionIds) {
      return
    }

    // Cleanup all subscriptions for this connection
    const cleanupPromises = Array.from(subscriptionIds).map(id =>
      this.unsubscribe(id).catch(error =>
        console.error(`Error cleaning up subscription ${id}:`, error)
      )
    )

    await Promise.all(cleanupPromises)
    this.connectionSubscriptions.delete(connectionId)
  }

  async updateConnectionActivity(connectionId: string): Promise<void> {
    const subscriptionIds = this.connectionSubscriptions.get(connectionId)
    if (!subscriptionIds) {
      return
    }

    const now = new Date()
    for (const id of subscriptionIds) {
      const subscription = this.subscriptions.get(id)
      if (subscription) {
        subscription.lastActivity = now
      }
    }
  }

  // ============================================================================
  // Engine Lifecycle
  // ============================================================================

  async start(): Promise<void> {
    if (this._isRunning) {
      return
    }

    this._isRunning = true
    this.startTime = Date.now()
    this.initializeMetrics()

    // Start maintenance cycle
    this.maintenanceInterval = setInterval(
      () => this.performMaintenance(),
      60000 // Every minute
    )

    this.emit('engine_started')
  }

  async stop(): Promise<void> {
    if (!this._isRunning) {
      return
    }

    this._isRunning = false

    // Stop maintenance
    if (this.maintenanceInterval) {
      clearInterval(this.maintenanceInterval)
      this.maintenanceInterval = undefined
    }

    // Cleanup all subscriptions
    const cleanupPromises = Array.from(this.subscriptions.keys()).map(id =>
      this.unsubscribe(id).catch(error =>
        console.error(`Error cleaning up subscription ${id}:`, error)
      )
    )

    await Promise.all(cleanupPromises)

    this.emit('engine_stopped')
  }

  isRunning(): boolean {
    return this._isRunning
  }

  // ============================================================================
  // Private Helper Methods
  // ============================================================================

  private generateSubscriptionId(): string {
    return `sub_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
  }

  private async checkSubscriptionPermission(
    user: User,
    query: ParsedSubscriptionQuery
  ): Promise<{ allowed: boolean; reason: string }> {
    // Check permission for subscription based on resource type
    const resource = {
      type: query.resourceType,
      database: query.database,
      collection: query.collection,
      documentId: query.documentId,
      fieldPath: query.fieldPath
    }

    const result = await this.authorizationEngine.checkPermission(
      user,
      resource,
      'subscribe',
      { subscription: true }
    )

    return {
      allowed: result.allowed,
      reason: result.reason
    }
  }

  private async checkConnectionLimits(userId: string, connectionId: string): Promise<void> {
    // Check max connections per user
    const userSubs = this.userSubscriptions.get(userId)
    if (userSubs && userSubs.size >= this.config.connections.maxConnectionsPerUser) {
      throw new SubscriptionError('Maximum subscriptions per user exceeded')
    }

    // Check total connections
    if (this.subscriptions.size >= this.config.connections.maxConnections) {
      throw new SubscriptionError('Maximum total subscriptions exceeded')
    }
  }

  private initializeMetrics(): void {
    this.metrics = {
      subscriptionsCreated: 0,
      subscriptionsDestroyed: 0,
      messagesProcessed: 0,
      averageProcessingTime: 0,
      errors: 0,
      timeouts: 0,
      memoryUsage: 0,
      cpuUsage: 0,
      periodStart: new Date(),
      periodEnd: new Date(),
      subscriptionsByStatus: new Map(),
      messagesByType: new Map(),
      errorsByType: new Map()
    }
  }

  private updateMetrics(operation: string, processingTime: number): void {
    // Update average processing time
    const totalOps = this.metrics.subscriptionsCreated + this.metrics.messagesProcessed
    this.metrics.averageProcessingTime =
      (this.metrics.averageProcessingTime * (totalOps - 1) + processingTime) / totalOps

    // Update operation-specific metrics
    const currentCount = this.metrics.messagesByType.get(operation) || 0
    this.metrics.messagesByType.set(operation, currentCount + 1)

    this.metrics.periodEnd = new Date()
  }

  private updateErrorMetrics(error: Error): void {
    const errorType = error.constructor.name
    const currentCount = this.metrics.errorsByType.get(errorType) || 0
    this.metrics.errorsByType.set(errorType, currentCount + 1)
  }

  private setupDatabaseChangeListeners(): void {
    // TODO: Setup database change listeners when CSDatabase supports events
    // For now, this is a placeholder
    console.log('Database change listeners setup - placeholder')
  }

  // ============================================================================
  // Subscription Matching and Data Handling
  // ============================================================================

  /**
   * Send initial data for a subscription
   */
  private async sendInitialData(subscription: Subscription): Promise<void> {
    try {
      // For now, send a simple initial data message
      // In a real implementation, this would query the database
      const initialData = {
        type: 'initial_data',
        subscriptionId: subscription.id,
        data: [],
        timestamp: Date.now()
      }

      await this.sendToConnection(subscription.connection, initialData)
    } catch (error) {
      console.error(`Error sending initial data for subscription ${subscription.id}:`, error)
    }
  }

  /**
   * Find subscriptions affected by a data change
   */
  private async findAffectedSubscriptions(change: DataChange): Promise<Subscription[]> {
    const affectedSubscriptions: Subscription[] = []

    for (const subscription of this.subscriptions.values()) {
      if (subscription.status !== 'active') {
        continue
      }

      // Check if change matches subscription scope
      if (this.matchesSubscriptionScope(change, subscription.query)) {
        affectedSubscriptions.push(subscription)
      }
    }

    return affectedSubscriptions
  }

  /**
   * Check if data change matches subscription scope
   */
  private matchesSubscriptionScope(change: DataChange, query: ParsedSubscriptionQuery): boolean {
    // Database level matching
    if (query.database && change.database !== query.database) {
      return false
    }

    // Collection level matching
    if (query.collection && change.collection !== query.collection) {
      return false
    }

    // Document level matching
    if (query.documentId && change.documentId !== query.documentId) {
      return false
    }

    // Field level matching
    if (query.fieldPath) {
      if (!change.affectedFields || !change.affectedFields.includes(query.fieldPath)) {
        return false
      }
    }

    // Resource type matching
    switch (query.resourceType) {
      case 'database':
        return true // Already checked database above
      case 'collection':
        return change.collection === query.collection
      case 'document':
        return change.collection === query.collection && change.documentId === query.documentId
      case 'field':
        return (
          change.collection === query.collection &&
          change.documentId === query.documentId &&
          change.affectedFields?.includes(query.fieldPath!)
        )
      default:
        return false
    }
  }

  /**
   * Check user permissions for specific data change
   */
  private async checkDataPermission(
    userId: string,
    change: DataChange,
    query: ParsedSubscriptionQuery
  ): Promise<boolean> {
    try {
      // Get user data
      const user = await this.getUserById(userId)
      if (!user) {
        return false
      }

      // Check permission through authorization engine
      const resource = {
        type: query.resourceType,
        database: change.database,
        collection: change.collection,
        documentId: change.documentId,
        data: change.data
      }

      const result = await this.authorizationEngine.checkPermission(
        user,
        resource,
        'read',
        { operation: change.operation }
      )

      return result.allowed
    } catch (error) {
      console.error('Error checking data permission:', error)
      return false
    }
  }

  /**
   * Send change notification to subscription
   */
  private async sendChangeNotification(
    subscription: Subscription,
    change: DataChange
  ): Promise<void> {
    try {
      const notification = {
        type: 'data_change',
        subscriptionId: subscription.id,
        change: {
          operation: change.operation,
          collection: change.collection,
          documentId: change.documentId,
          data: change.data,
          previousData: change.previousData,
          affectedFields: change.affectedFields,
          timestamp: change.timestamp
        },
        metadata: {
          userId: subscription.userId,
          connectionId: subscription.connection.id,
          timestamp: Date.now()
        }
      }

      await this.sendToConnection(subscription.connection, notification)
    } catch (error) {
      console.error(`Error sending change notification for subscription ${subscription.id}:`, error)
    }
  }

  /**
   * Send message to connection
   */
  private async sendToConnection(connection: Connection, message: any): Promise<void> {
    try {
      // For WebSocket connections
      if (connection.metadata.protocol === 'websocket' && connection.readyState === 1) {
        // In a real implementation, this would use the WebSocket send method
        console.log(`Sending to WebSocket ${connection.id}:`, message)
        return
      }

      // For SSE connections
      if (connection.metadata.protocol === 'sse') {
        // In a real implementation, this would use the SSE response object
        console.log(`Sending to SSE ${connection.id}:`, message)
        return
      }

      console.warn(`Unknown connection protocol: ${connection.metadata.protocol}`)
    } catch (error) {
      console.error(`Error sending message to connection ${connection.id}:`, error)
    }
  }

  /**
   * Get user by ID (stub implementation)
   */
  private async getUserById(userId: string): Promise<any> {
    // This would typically fetch from a user service
    return {
      id: userId,
      email: `user${userId}@example.com`,
      passwordHash: 'hash',
      roles: ['user'],
      attributes: {},
      createdAt: new Date(),
      updatedAt: new Date(),
      isActive: true
    }
  }

  // Maintenance and cleanup methods will be implemented in next steps
  async cleanupExpiredSubscriptions(): Promise<number> { return 0 }
  async cleanupOrphanedSubscriptions(): Promise<number> { return 0 }
  async performMaintenance(): Promise<void> {}
    async getStats(): Promise<SubscriptionStats> {
    const subscriptionsByUser = new Map<string, number>()
    for (const [userId, subscriptions] of this.userSubscriptions) {
      subscriptionsByUser.set(userId, subscriptions.size)
    }

    return {
      totalSubscriptions: this.subscriptions.size,
      activeSubscriptions: Array.from(this.subscriptions.values()).filter(s => s.status === 'active').length,
      subscriptionsByUser,
      subscriptionsByCollection: new Map(),
      averageSubscriptionAge: 0,
      messagesProcessed: this.metrics.messagesProcessed,
      averageProcessingTime: this.metrics.averageProcessingTime
    }
  }
  async getSubscriptionsByCollection(): Promise<Map<string, number>> { return new Map() }
  async getSubscriptionsByUser(): Promise<Map<string, number>> {
    const result = new Map<string, number>()
    for (const [userId, subscriptions] of this.userSubscriptions) {
      result.set(userId, subscriptions.size)
    }
    return result
  }
  async checkHealth(): Promise<EngineHealth> {
    return {
      status: this._isRunning ? 'healthy' : 'unhealthy',
      uptime: this._isRunning ? Date.now() - this.startTime : 0,
      subscriptionCount: this.subscriptions.size,
      connectionCount: this.connectionSubscriptions.size,
      memoryUsage: process.memoryUsage().heapUsed,
      checks: []
    }
  }
  async getMetrics(): Promise<EngineMetrics> { return this.metrics }

  // ============================================================================
  // Protocol Management (Priority 3 Fix)
  // ============================================================================

  /**
   * Set preferred protocol for new connections
   */
  setProtocol(protocol: 'sse' | 'websocket'): void {
    this.protocol = protocol
    this.protocolConfig.preferred = protocol
    this.emit('protocol_changed', protocol)
  }

  /**
   * Set message format (JSON or MessagePack)
   */
  setFormat(format: 'json' | 'messagepack'): void {
    this.format = format
    this.protocolConfig.format = format
    this.emit('format_changed', format)
  }

  /**
   * Get current protocol
   */
  getProtocol(): 'sse' | 'websocket' {
    return this.protocol
  }

  /**
   * Get current format
   */
  getFormat(): 'json' | 'messagepack' {
    return this.format
  }

  /**
   * Set protocol configuration
   */
  setProtocolConfig(config: Partial<typeof this.protocolConfig>): void {
    this.protocolConfig = { ...this.protocolConfig, ...config }

    if (config.preferred) {
      this.protocol = config.preferred
    }

    if (config.format) {
      this.format = config.format
    }

    this.emit('protocol_config_changed', this.protocolConfig)
  }

  /**
   * Get protocol configuration
   */
  getProtocolConfig(): typeof this.protocolConfig {
    return { ...this.protocolConfig }
  }

  /**
   * Encode message based on current format
   */
  private encodeMessage(data: any): any {
    switch (this.format) {
      case 'messagepack':
        return this.encodeMessagePack(data)
      case 'json':
      default:
        return data
    }
  }

  /**
   * Decode message based on format
   */
  private decodeMessage(data: any, format?: 'json' | 'messagepack'): any {
    const messageFormat = format || this.format

    switch (messageFormat) {
      case 'messagepack':
        return this.decodeMessagePack(data)
      case 'json':
      default:
        return data
    }
  }

  /**
   * MessagePack encoding (placeholder for now)
   */
  private encodeMessagePack(data: any): any {
    // TODO: Implement MessagePack encoding when msgpack dependency is added
    // For now, return JSON as fallback
    return data
  }

  /**
   * MessagePack decoding (placeholder for now)
   */
  private decodeMessagePack(data: any): any {
    // TODO: Implement MessagePack decoding when msgpack dependency is added
    // For now, return data as-is
    return data
  }

  /**
   * Choose best protocol for connection
   */
  chooseBestProtocol(clientCapabilities?: string[]): 'websocket' | 'sse' {
    if (!clientCapabilities) {
      return this.protocolConfig.preferred
    }

    // Check if client supports preferred protocol
    if (clientCapabilities.includes(this.protocolConfig.preferred)) {
      return this.protocolConfig.preferred
    }

    // Fall back to alternative
    if (clientCapabilities.includes(this.protocolConfig.fallback)) {
      return this.protocolConfig.fallback
    }

    // Default fallback
    return 'sse'
  }

  /**
   * Get protocol statistics
   */
  getProtocolStats(): any {
    const stats = {
      websocketConnections: 0,
      sseConnections: 0,
      jsonMessages: 0,
      messagepackMessages: 0,
      totalMessages: 0
    }

    // Count connections by protocol
    for (const subscription of this.subscriptions.values()) {
      if (subscription.connection.protocol === 'websocket') {
        stats.websocketConnections++
      } else if (subscription.connection.protocol === 'sse') {
        stats.sseConnections++
      }
    }

    // TODO: Add message format statistics when implemented
    stats.totalMessages = stats.jsonMessages + stats.messagepackMessages

    return stats
  }
}