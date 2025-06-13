/**
 * Cross-Tab Synchronizer for Real-time Subscriptions
 * Phase 3: Real-time Subscriptions & Notifications - Priority 2 Fix
 */

import { EventEmitter } from 'events'
import type {
  ICrossTabSynchronizer,
  DataUpdate,
  CrossTabMessage,
  TabInfo,
  Subscription
} from '../interfaces/types'

export class CrossTabSynchronizer extends EventEmitter implements ICrossTabSynchronizer {
  private channel: any // BroadcastChannel (browser API)
  private tabId: string
  private userId?: string
  private activeSubscriptions = new Map<string, Subscription>()
  private dataCache = new Map<string, any>()
  private activeTabs = new Map<string, TabInfo>()
  private heartbeatInterval?: NodeJS.Timeout
  private cleanupInterval?: NodeJS.Timeout

  constructor() {
    super()
    this.tabId = this.generateTabId()

    // Initialize BroadcastChannel if available (browser environment)
    if (typeof BroadcastChannel !== 'undefined') {
      this.channel = new (BroadcastChannel as any)('collection-store-sync')
      this.setupMessageHandlers()
    } else {
      // Fallback for non-browser environments
      this.channel = null
    }

    this.startHeartbeat()
    this.startCleanup()
  }

  /**
   * Register this tab for cross-tab coordination
   */
  registerTab(tabId: string, userId: string): void {
    this.tabId = tabId
    this.userId = userId

    const tabInfo: TabInfo = {
      id: this.tabId,
      userId,
      registeredAt: new Date(),
      lastActivity: new Date(),
      subscriptions: Array.from(this.activeSubscriptions.keys())
    }

    this.activeTabs.set(this.tabId, tabInfo)

    this.broadcastMessage({
      type: 'tab_registered',
      data: tabInfo,
      sourceTabId: this.tabId,
      timestamp: Date.now()
    })

    this.emit('tab_registered', tabInfo)
  }

  /**
   * Unregister this tab
   */
  unregisterTab(tabId: string): void {
    this.activeTabs.delete(tabId)

    this.broadcastMessage({
      type: 'tab_closed',
      data: { tabId },
      sourceTabId: this.tabId,
      timestamp: Date.now()
    })

    this.emit('tab_unregistered', tabId)
  }

  /**
   * Broadcast data update to other tabs
   */
  broadcastUpdate(update: DataUpdate): void {
    // Add source tab ID
    update.sourceTabId = this.tabId

    this.broadcastMessage({
      type: 'data_update',
      data: update,
      sourceTabId: this.tabId,
      timestamp: Date.now()
    })

    // Update local cache
    this.updateLocalCache(update)
  }

  /**
   * Coordinate subscriptions across tabs to avoid duplicates
   */
  coordinateSubscriptions(userId: string): void {
    if (this.userId !== userId) {
      return
    }

    const subscriptionSummary = Array.from(this.activeSubscriptions.values()).map(sub => ({
      id: sub.id,
      collection: sub.query.collection,
      userId: sub.userId,
      tabId: this.tabId
    }))

    this.broadcastMessage({
      type: 'subscription_coordination',
      data: {
        userId,
        subscriptions: subscriptionSummary,
        tabId: this.tabId
      },
      sourceTabId: this.tabId,
      timestamp: Date.now()
    })
  }

  /**
   * Set up update handler
   */
  onUpdate(handler: (update: DataUpdate) => void): void {
    this.on('data_update', handler)
  }

  /**
   * Get active tabs for user
   */
  getActiveTabsForUser(userId: string): string[] {
    return Array.from(this.activeTabs.values())
      .filter(tab => tab.userId === userId)
      .map(tab => tab.id)
  }

  /**
   * Add subscription to this tab
   */
  addSubscription(subscription: Subscription): void {
    this.activeSubscriptions.set(subscription.id, subscription)

    // Update tab info
    const tabInfo = this.activeTabs.get(this.tabId)
    if (tabInfo) {
      tabInfo.subscriptions = Array.from(this.activeSubscriptions.keys())
      tabInfo.lastActivity = new Date()
    }

    // Coordinate with other tabs
    if (this.userId) {
      this.coordinateSubscriptions(this.userId)
    }
  }

  /**
   * Remove subscription from this tab
   */
  removeSubscription(subscriptionId: string): void {
    this.activeSubscriptions.delete(subscriptionId)

    // Update tab info
    const tabInfo = this.activeTabs.get(this.tabId)
    if (tabInfo) {
      tabInfo.subscriptions = Array.from(this.activeSubscriptions.keys())
      tabInfo.lastActivity = new Date()
    }

    // Coordinate with other tabs
    if (this.userId) {
      this.coordinateSubscriptions(this.userId)
    }
  }

  /**
   * Get cached data for collection
   */
  getCachedData(collection: string, documentId?: string): any {
    if (documentId) {
      return this.dataCache.get(`${collection}:${documentId}`)
    }

    // Return all data for collection
    const collectionData: any[] = []
    for (const [key, value] of this.dataCache.entries()) {
      if (key.startsWith(`${collection}:`)) {
        collectionData.push(value)
      }
    }
    return collectionData
  }

  /**
   * Check if subscription exists in other tabs
   */
  isSubscriptionDuplicated(subscription: Subscription): boolean {
    for (const tab of this.activeTabs.values()) {
      if (tab.id !== this.tabId && tab.userId === subscription.userId) {
        // Check if other tab has similar subscription
        const hasSimilar = tab.subscriptions.some(subId => {
          const otherSub = this.activeSubscriptions.get(subId)
          return otherSub && this.areSubscriptionsSimilar(subscription, otherSub)
        })

        if (hasSimilar) {
          return true
        }
      }
    }

    return false
  }

  /**
   * Cleanup and close
   */
  destroy(): void {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval)
    }

    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval)
    }

    this.unregisterTab(this.tabId)

    if (this.channel && typeof this.channel.close === 'function') {
      this.channel.close()
    }

    this.removeAllListeners()
  }

  // ============================================================================
  // Private Methods
  // ============================================================================

  private setupMessageHandlers(): void {
    if (!this.channel) {
      return
    }

    this.channel.onmessage = (event: any) => {
      const message: CrossTabMessage = event.data

      // Ignore messages from same tab
      if (message.sourceTabId === this.tabId) {
        return
      }

      switch (message.type) {
        case 'data_update':
          this.handleDataUpdate(message.data as DataUpdate)
          break
        case 'subscription_coordination':
          this.handleSubscriptionCoordination(message.data)
          break
        case 'tab_registered':
          this.handleTabRegistered(message.data as TabInfo)
          break
        case 'tab_closed':
          this.handleTabClosed(message.data)
          break
      }
    }
  }

  private broadcastMessage(message: CrossTabMessage): void {
    if (!this.channel) {
      return
    }

    try {
      this.channel.postMessage(message)
    } catch (error) {
      console.error('Failed to broadcast message:', error)
    }
  }

  private handleDataUpdate(update: DataUpdate): void {
    // Update local cache
    this.updateLocalCache(update)

    // Emit event for local subscribers
    this.emit('data_update', update)

    // Notify local subscriptions
    this.notifyLocalSubscribers(update)
  }

  private handleSubscriptionCoordination(data: any): void {
    const { userId, subscriptions, tabId } = data

    // Update tab info with subscription list
    const tabInfo = this.activeTabs.get(tabId)
    if (tabInfo) {
      tabInfo.subscriptions = subscriptions.map((sub: any) => sub.id)
      tabInfo.lastActivity = new Date()
    }

    this.emit('subscription_coordination', data)
  }

  private handleTabRegistered(tabInfo: TabInfo): void {
    this.activeTabs.set(tabInfo.id, tabInfo)
    this.emit('tab_registered', tabInfo)
  }

  private handleTabClosed(data: any): void {
    const { tabId } = data
    this.activeTabs.delete(tabId)
    this.emit('tab_closed', tabId)
  }

  private updateLocalCache(update: DataUpdate): void {
    const cacheKey = `${update.collection}:${update.documentId}`

    switch (update.type) {
      case 'insert':
      case 'update':
        this.dataCache.set(cacheKey, update.data)
        break
      case 'delete':
        this.dataCache.delete(cacheKey)
        break
      case 'cache_update':
        if (update.changes) {
          for (const change of update.changes) {
            const changeKey = `${update.collection}:${change.documentId}`
            if (change.type === 'delete') {
              this.dataCache.delete(changeKey)
            } else {
              this.dataCache.set(changeKey, change.data)
            }
          }
        }
        break
    }
  }

  private notifyLocalSubscribers(update: DataUpdate): void {
    for (const subscription of this.activeSubscriptions.values()) {
      if (this.subscriptionMatches(subscription, update)) {
        this.emit('subscription_update', subscription, update)
      }
    }
  }

  private subscriptionMatches(subscription: Subscription, update: DataUpdate): boolean {
    const query = subscription.query

    // Check collection match
    if (query.collection && query.collection !== update.collection) {
      return false
    }

    // Check document match
    if (query.documentId && query.documentId !== update.documentId) {
      return false
    }

    // TODO: Add more sophisticated matching logic based on filters
    return true
  }

  private areSubscriptionsSimilar(sub1: Subscription, sub2: Subscription): boolean {
    const query1 = sub1.query
    const query2 = sub2.query

    return (
      query1.collection === query2.collection &&
      query1.documentId === query2.documentId &&
      query1.resourceType === query2.resourceType
    )
  }

  private generateTabId(): string {
    return `tab_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
  }

  private startHeartbeat(): void {
    this.heartbeatInterval = setInterval(() => {
      // Update last activity for this tab
      const tabInfo = this.activeTabs.get(this.tabId)
      if (tabInfo) {
        tabInfo.lastActivity = new Date()
      }

      // Send heartbeat to other tabs
      this.broadcastMessage({
        type: 'tab_registered', // Reuse tab_registered as heartbeat
        data: tabInfo,
        sourceTabId: this.tabId,
        timestamp: Date.now()
      })
    }, 30000) // 30 seconds
  }

  private startCleanup(): void {
    this.cleanupInterval = setInterval(() => {
      const now = Date.now()
      const timeout = 60000 // 1 minute timeout

      // Remove inactive tabs
      for (const [tabId, tabInfo] of this.activeTabs.entries()) {
        if (now - tabInfo.lastActivity.getTime() > timeout) {
          this.activeTabs.delete(tabId)
          this.emit('tab_timeout', tabId)
        }
      }
    }, 30000) // Check every 30 seconds
  }
}