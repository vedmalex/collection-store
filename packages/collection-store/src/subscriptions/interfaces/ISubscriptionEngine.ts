/**
 * Main interface for Real-time Subscription Engine
 * Phase 3: Real-time Subscriptions & Notifications
 */

import type { User } from '../../auth/interfaces/types'
import type {
  Subscription,
  SubscriptionQuery,
  SubscriptionContext,
  DataChange,
  SubscriptionStats,
  Connection,
  SubscriptionId,
  UserId
} from './types'

export interface ISubscriptionEngine {
  // ============================================================================
  // Core Subscription Management
  // ============================================================================

  /**
   * Create a new subscription for a user
   * @param user - The user creating the subscription
   * @param query - The subscription query
   * @param connection - The connection to send notifications to
   * @param context - Additional context for the subscription
   * @returns Promise resolving to the created subscription
   */
  subscribe(
    user: User,
    query: SubscriptionQuery,
    connection: Connection,
    context?: SubscriptionContext
  ): Promise<Subscription>

  /**
   * Remove a subscription
   * @param subscriptionId - ID of the subscription to remove
   * @returns Promise resolving when subscription is removed
   */
  unsubscribe(subscriptionId: SubscriptionId): Promise<void>

  /**
   * Get subscription by ID
   * @param subscriptionId - ID of the subscription
   * @returns Promise resolving to the subscription or undefined
   */
  getSubscription(subscriptionId: SubscriptionId): Promise<Subscription | undefined>

  /**
   * Get all active subscriptions for a user
   * @param userId - ID of the user
   * @returns Promise resolving to array of subscriptions
   */
  getUserSubscriptions(userId: UserId): Promise<Subscription[]>

  /**
   * Get all active subscriptions
   * @returns Promise resolving to array of all subscriptions
   */
  getAllSubscriptions(): Promise<Subscription[]>

  // ============================================================================
  // Change Notification
  // ============================================================================

  /**
   * Publish a data change to relevant subscriptions
   * @param change - The data change to publish
   * @returns Promise resolving when change is published
   */
  publishChange(change: DataChange): Promise<void>

  /**
   * Publish multiple data changes in batch
   * @param changes - Array of data changes to publish
   * @returns Promise resolving when all changes are published
   */
  publishChanges(changes: DataChange[]): Promise<void>

  // ============================================================================
  // Subscription Lifecycle
  // ============================================================================

  /**
   * Pause a subscription (stop sending notifications)
   * @param subscriptionId - ID of the subscription to pause
   * @returns Promise resolving when subscription is paused
   */
  pauseSubscription(subscriptionId: SubscriptionId): Promise<void>

  /**
   * Resume a paused subscription
   * @param subscriptionId - ID of the subscription to resume
   * @returns Promise resolving when subscription is resumed
   */
  resumeSubscription(subscriptionId: SubscriptionId): Promise<void>

  /**
   * Update subscription query
   * @param subscriptionId - ID of the subscription to update
   * @param newQuery - New subscription query
   * @returns Promise resolving to updated subscription
   */
  updateSubscription(
    subscriptionId: SubscriptionId,
    newQuery: SubscriptionQuery
  ): Promise<Subscription>

  // ============================================================================
  // Connection Management
  // ============================================================================

  /**
   * Handle connection close - cleanup associated subscriptions
   * @param connectionId - ID of the closed connection
   * @returns Promise resolving when cleanup is complete
   */
  handleConnectionClose(connectionId: string): Promise<void>

  /**
   * Update connection activity timestamp
   * @param connectionId - ID of the connection
   * @returns Promise resolving when activity is updated
   */
  updateConnectionActivity(connectionId: string): Promise<void>

  // ============================================================================
  // Maintenance and Cleanup
  // ============================================================================

  /**
   * Clean up expired subscriptions
   * @returns Promise resolving to number of cleaned up subscriptions
   */
  cleanupExpiredSubscriptions(): Promise<number>

  /**
   * Clean up orphaned subscriptions (connections no longer exist)
   * @returns Promise resolving to number of cleaned up subscriptions
   */
  cleanupOrphanedSubscriptions(): Promise<number>

  /**
   * Perform full maintenance cycle
   * @returns Promise resolving when maintenance is complete
   */
  performMaintenance(): Promise<void>

  // ============================================================================
  // Statistics and Monitoring
  // ============================================================================

  /**
   * Get subscription statistics
   * @returns Promise resolving to subscription statistics
   */
  getStats(): Promise<SubscriptionStats>

  /**
   * Get subscription count by collection
   * @returns Promise resolving to map of collection -> count
   */
  getSubscriptionsByCollection(): Promise<Map<string, number>>

  /**
   * Get subscription count by user
   * @returns Promise resolving to map of user -> count
   */
  getSubscriptionsByUser(): Promise<Map<string, number>>

  // ============================================================================
  // Health and Diagnostics
  // ============================================================================

  /**
   * Check engine health
   * @returns Promise resolving to health status
   */
  checkHealth(): Promise<EngineHealth>

  /**
   * Get engine metrics
   * @returns Promise resolving to engine metrics
   */
  getMetrics(): Promise<EngineMetrics>

  /**
   * Start the subscription engine
   * @returns Promise resolving when engine is started
   */
  start(): Promise<void>

  /**
   * Stop the subscription engine
   * @returns Promise resolving when engine is stopped
   */
  stop(): Promise<void>

  /**
   * Check if engine is running
   * @returns True if engine is running
   */
  isRunning(): boolean
}

// ============================================================================
// Supporting Interfaces
// ============================================================================

export interface EngineHealth {
  status: 'healthy' | 'degraded' | 'unhealthy'
  uptime: number // milliseconds
  subscriptionCount: number
  connectionCount: number
  memoryUsage: number // bytes
  lastError?: {
    message: string
    timestamp: Date
    stack?: string
  }
  checks: HealthCheck[]
}

export interface HealthCheck {
  name: string
  status: 'pass' | 'fail' | 'warn'
  message?: string
  duration: number // milliseconds
  timestamp: Date
}

export interface EngineMetrics {
  // Performance metrics
  subscriptionsCreated: number
  subscriptionsDestroyed: number
  messagesProcessed: number
  averageProcessingTime: number // milliseconds

  // Error metrics
  errors: number
  timeouts: number

  // Resource metrics
  memoryUsage: number // bytes
  cpuUsage: number // percentage

  // Time period
  periodStart: Date
  periodEnd: Date

  // Detailed metrics
  subscriptionsByStatus: Map<string, number>
  messagesByType: Map<string, number>
  errorsByType: Map<string, number>
}