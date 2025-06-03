/**
 * Notification Manager for Subscription System
 * Phase 3: Real-time Subscriptions & Notifications
 */

import { EventEmitter } from 'events'
import type {
  DataChange,
  Subscription,
  Connection,
  NotificationConfig,
  NotificationBatch,
  NotificationStats,
  NotificationPriority,
  NotificationResult
} from '../interfaces/types'

export class NotificationManager extends EventEmitter {
  private pendingNotifications = new Map<string, NotificationBatch>()
  private batchTimers = new Map<string, NodeJS.Timeout>()
  private stats: NotificationStats
  private isRunning = false

  constructor(private config: NotificationConfig) {
    super()
    this.initializeStats()
  }

  /**
   * Start notification manager
   */
  async start(): Promise<void> {
    if (this.isRunning) {
      return
    }

    this.isRunning = true
    this.emit('started')
  }

  /**
   * Stop notification manager
   */
  async stop(): Promise<void> {
    if (!this.isRunning) {
      return
    }

    // Flush all pending notifications
    await this.flushAllPendingNotifications()

    // Clear all timers
    for (const timer of this.batchTimers.values()) {
      clearTimeout(timer)
    }
    this.batchTimers.clear()

    this.isRunning = false
    this.emit('stopped')
  }

  /**
   * Send notification to subscription
   */
  async sendNotification(
    subscription: Subscription,
    change: DataChange,
    priority: NotificationPriority = 'normal'
  ): Promise<NotificationResult> {
    if (!this.isRunning) {
      return {
        success: false,
        error: 'Notification manager not running',
        subscriptionId: subscription.id
      }
    }

    try {
      const notification = {
        id: this.generateNotificationId(),
        subscriptionId: subscription.id,
        connectionId: subscription.connection.id,
        change,
        priority,
        timestamp: Date.now(),
        retryCount: 0
      }

      // Handle based on priority
      if (priority === 'high') {
        // Send immediately for high priority
        return await this.sendImmediateNotification(subscription, notification)
      } else {
        // Batch for normal/low priority
        return await this.addToBatch(subscription, notification)
      }
    } catch (error: any) {
      this.stats.errors++
      return {
        success: false,
        error: error.message,
        subscriptionId: subscription.id
      }
    }
  }

  /**
   * Send multiple notifications (batch)
   */
  async sendNotifications(
    notifications: Array<{
      subscription: Subscription
      change: DataChange
      priority?: NotificationPriority
    }>
  ): Promise<NotificationResult[]> {
    const results: NotificationResult[] = []

    // Group by priority
    const highPriority = notifications.filter(n => n.priority === 'high')
    const normalPriority = notifications.filter(n => n.priority !== 'high')

    // Send high priority immediately
    for (const { subscription, change, priority } of highPriority) {
      const result = await this.sendNotification(subscription, change, priority)
      results.push(result)
    }

    // Batch normal priority
    for (const { subscription, change, priority } of normalPriority) {
      const result = await this.sendNotification(subscription, change, priority)
      results.push(result)
    }

    return results
  }

  /**
   * Broadcast change to all matching subscriptions
   */
  async broadcastChange(
    change: DataChange,
    matchingSubscriptions: Subscription[]
  ): Promise<NotificationResult[]> {
    const notifications = matchingSubscriptions.map(subscription => ({
      subscription,
      change,
      priority: this.determinePriority(change, subscription)
    }))

    return await this.sendNotifications(notifications)
  }

  /**
   * Send notification to specific connection
   */
  async sendToConnection(
    connection: Connection,
    message: any,
    priority: NotificationPriority = 'normal'
  ): Promise<NotificationResult> {
    if (!this.isRunning) {
      return {
        success: false,
        error: 'Notification manager not running',
        connectionId: connection.id
      }
    }

    try {
      const notification = {
        id: this.generateNotificationId(),
        connectionId: connection.id,
        message,
        priority,
        timestamp: Date.now(),
        retryCount: 0
      }

      if (priority === 'high') {
        return await this.sendImmediateConnectionNotification(connection, notification)
      } else {
        return await this.addConnectionToBatch(connection, notification)
      }
    } catch (error: any) {
      this.stats.errors++
      return {
        success: false,
        error: error.message,
        connectionId: connection.id
      }
    }
  }

  /**
   * Get notification statistics
   */
  getStats(): NotificationStats {
    return { ...this.stats }
  }

  /**
   * Flush all pending notifications
   */
  async flushAllPendingNotifications(): Promise<void> {
    const flushPromises: Promise<void>[] = []

    for (const [batchKey, batch] of this.pendingNotifications) {
      flushPromises.push(this.flushBatch(batchKey, batch))
    }

    await Promise.all(flushPromises)
  }

  /**
   * Get pending notification count
   */
  getPendingCount(): number {
    let total = 0
    for (const batch of this.pendingNotifications.values()) {
      total += batch.notifications.length
    }
    return total
  }

  /**
   * Health check for notification manager
   */
  getHealth(): {
    status: 'healthy' | 'degraded' | 'unhealthy'
    pendingCount: number
    errorRate: number
    uptime: number
  } {
    const totalNotifications = this.stats.sent + this.stats.errors
    const errorRate = totalNotifications > 0 ? this.stats.errors / totalNotifications : 0
    const uptime = Date.now() - this.stats.startTime.getTime()

    let status: 'healthy' | 'degraded' | 'unhealthy' = 'healthy'

    if (errorRate > 0.1) { // More than 10% error rate
      status = 'unhealthy'
    } else if (errorRate > 0.05 || this.getPendingCount() > 1000) {
      status = 'degraded'
    }

    return {
      status,
      pendingCount: this.getPendingCount(),
      errorRate,
      uptime
    }
  }

  // ============================================================================
  // Private Methods
  // ============================================================================

  private async sendImmediateNotification(
    subscription: Subscription,
    notification: any
  ): Promise<NotificationResult> {
    try {
      const message = this.formatNotificationMessage(notification)

      // Send via connection transport
      await this.sendViaTransport(subscription.connection, message)

      this.stats.sent++
      this.stats.immediate++

      return {
        success: true,
        subscriptionId: subscription.id,
        notificationId: notification.id
      }
    } catch (error: any) {
      this.stats.errors++

      // Retry logic for failed notifications
      if (notification.retryCount < this.config.maxRetries) {
        notification.retryCount++
        setTimeout(() => {
          this.sendImmediateNotification(subscription, notification)
        }, this.config.retryDelayMs * Math.pow(2, notification.retryCount))
      }

      return {
        success: false,
        error: error.message,
        subscriptionId: subscription.id,
        notificationId: notification.id
      }
    }
  }

  private async sendImmediateConnectionNotification(
    connection: Connection,
    notification: any
  ): Promise<NotificationResult> {
    try {
      await this.sendViaTransport(connection, notification.message)

      this.stats.sent++
      this.stats.immediate++

      return {
        success: true,
        connectionId: connection.id,
        notificationId: notification.id
      }
    } catch (error: any) {
      this.stats.errors++
      return {
        success: false,
        error: error.message,
        connectionId: connection.id,
        notificationId: notification.id
      }
    }
  }

  private async addToBatch(
    subscription: Subscription,
    notification: any
  ): Promise<NotificationResult> {
    const batchKey = this.getBatchKey(subscription.connection.id)

    if (!this.pendingNotifications.has(batchKey)) {
      this.pendingNotifications.set(batchKey, {
        connectionId: subscription.connection.id,
        notifications: [],
        createdAt: Date.now()
      })
    }

    const batch = this.pendingNotifications.get(batchKey)!
    batch.notifications.push(notification)

    // Check if batch is full
    if (batch.notifications.length >= this.config.batchSize) {
      await this.flushBatch(batchKey, batch)
    } else {
      // Set timer for batch timeout
      this.setBatchTimer(batchKey)
    }

    return {
      success: true,
      subscriptionId: subscription.id,
      notificationId: notification.id,
      batched: true
    }
  }

  private async addConnectionToBatch(
    connection: Connection,
    notification: any
  ): Promise<NotificationResult> {
    const batchKey = this.getBatchKey(connection.id)

    if (!this.pendingNotifications.has(batchKey)) {
      this.pendingNotifications.set(batchKey, {
        connectionId: connection.id,
        notifications: [],
        createdAt: Date.now()
      })
    }

    const batch = this.pendingNotifications.get(batchKey)!
    batch.notifications.push(notification)

    if (batch.notifications.length >= this.config.batchSize) {
      await this.flushBatch(batchKey, batch)
    } else {
      this.setBatchTimer(batchKey)
    }

    return {
      success: true,
      connectionId: connection.id,
      notificationId: notification.id,
      batched: true
    }
  }

  private async flushBatch(batchKey: string, batch: NotificationBatch): Promise<void> {
    try {
      // Clear timer
      const timer = this.batchTimers.get(batchKey)
      if (timer) {
        clearTimeout(timer)
        this.batchTimers.delete(batchKey)
      }

      // Remove from pending
      this.pendingNotifications.delete(batchKey)

      if (batch.notifications.length === 0) {
        return
      }

      // For now, just mark as sent (would implement real sending)
      this.stats.sent += batch.notifications.length
      this.stats.batched += batch.notifications.length

    } catch (error) {
      this.stats.errors++
      console.error('Error flushing batch:', error)
    }
  }

  private setBatchTimer(batchKey: string): void {
    // Clear existing timer
    const existingTimer = this.batchTimers.get(batchKey)
    if (existingTimer) {
      clearTimeout(existingTimer)
    }

    // Set new timer
    const timer = setTimeout(() => {
      const batch = this.pendingNotifications.get(batchKey)
      if (batch) {
        this.flushBatch(batchKey, batch)
      }
    }, this.config.batchTimeoutMs)

    this.batchTimers.set(batchKey, timer)
  }

  private async sendViaTransport(connection: Connection, message: any): Promise<void> {
    if (connection.protocol === 'websocket') {
      const ws = connection.transport
      if (ws.readyState === 1) { // OPEN
        ws.send(JSON.stringify(message))
      } else {
        throw new Error('WebSocket connection not open')
      }
    } else if (connection.protocol === 'sse') {
      const res = connection.transport
      const sseMessage = `event: notification\ndata: ${JSON.stringify(message)}\n\n`
      res.write(sseMessage)
    } else {
      throw new Error(`Unsupported protocol: ${connection.protocol}`)
    }
  }

  private formatNotificationMessage(notification: any): any {
    return {
      type: 'data_change',
      subscriptionId: notification.subscriptionId,
      change: notification.change,
      timestamp: notification.timestamp,
      id: notification.id
    }
  }

  private determinePriority(change: DataChange, subscription: Subscription): NotificationPriority {
    // Simple priority logic - can be enhanced
    if (change.operation === 'delete') {
      return 'high'
    }

    return 'normal'
  }

  private getBatchKey(connectionId: string): string {
    return `batch_${connectionId}`
  }

  private generateNotificationId(): string {
    return `notif_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
  }

  private initializeStats(): void {
    this.stats = {
      sent: 0,
      errors: 0,
      batched: 0,
      immediate: 0,
      retries: 0,
      averageLatency: 0,
      peakThroughput: 0,
      startTime: new Date()
    }
  }
}
