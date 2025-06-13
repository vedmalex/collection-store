/**
 * Raft Network RPC Layer
 * Enhanced network layer with Raft-specific RPC messages, timeout handling and partition detection
 */

import { EventEmitter } from 'events'
import {
  NodeId,
  RequestVoteRequest,
  RequestVoteResponse,
  AppendEntriesRequest,
  AppendEntriesResponse,
  InstallSnapshotRequest,
  InstallSnapshotResponse,
  RaftNetworkError
} from './types'

export interface RaftNetworkConfig {
  nodeId: NodeId
  peers: Map<NodeId, PeerConfig>

  // Timeout configuration
  requestTimeout: number      // 1000ms - RPC request timeout
  connectionTimeout: number   // 5000ms - Connection establishment timeout
  heartbeatTimeout: number    // 150ms - Heartbeat timeout

  // Retry configuration
  maxRetries: number          // 3 - Maximum retry attempts
  retryBaseDelay: number      // 100ms - Base delay for exponential backoff
  retryMaxDelay: number       // 5000ms - Maximum retry delay

  // Network partition detection
  partitionDetectionEnabled: boolean
  partitionThreshold: number  // 3 - Failed requests before considering partition
  partitionRecoveryDelay: number // 10000ms - Delay before retry after partition
}

export interface PeerConfig {
  nodeId: NodeId
  host: string
  port: number
  protocol: 'http' | 'https' | 'tcp'
}

export interface NetworkMetrics {
  totalRequests: number
  successfulRequests: number
  failedRequests: number
  timeoutRequests: number
  retryAttempts: number

  // Per-peer metrics
  peerMetrics: Map<NodeId, PeerMetrics>

  // Partition detection
  suspectedPartitions: Set<NodeId>
  recoveredPartitions: Set<NodeId>

  // Performance metrics
  averageLatency: number
  maxLatency: number
  minLatency: number
}

export interface PeerMetrics {
  nodeId: NodeId
  totalRequests: number
  successfulRequests: number
  failedRequests: number
  consecutiveFailures: number
  lastSuccessTime: number
  lastFailureTime: number
  averageLatency: number
  isPartitioned: boolean
}

export interface RaftRPCRequest {
  type: 'RequestVote' | 'AppendEntries' | 'InstallSnapshot'
  requestId: string
  sourceNodeId: NodeId
  targetNodeId: NodeId
  timestamp: number
  data: any // Generic data field to avoid type conflicts
}

export interface RaftRPCResponse {
  type: 'RequestVote' | 'AppendEntries' | 'InstallSnapshot'
  requestId: string
  sourceNodeId: NodeId
  targetNodeId: NodeId
  timestamp: number
  success: boolean
  data?: any // Generic data field
  error?: string
}

export class RaftNetworkLayer extends EventEmitter {
  private config: RaftNetworkConfig
  private metrics: NetworkMetrics
  private activeRequests = new Map<string, NodeJS.Timeout>()
  private retryQueues = new Map<NodeId, Array<() => Promise<void>>>()
  private partitionRecoveryTimers = new Map<NodeId, NodeJS.Timeout>()

  constructor(config: RaftNetworkConfig) {
    super()
    this.config = config
    this.metrics = this.initializeMetrics()
  }

  private initializeMetrics(): NetworkMetrics {
    const peerMetrics = new Map<NodeId, PeerMetrics>()

    for (const [nodeId] of this.config.peers) {
      peerMetrics.set(nodeId, {
        nodeId,
        totalRequests: 0,
        successfulRequests: 0,
        failedRequests: 0,
        consecutiveFailures: 0,
        lastSuccessTime: 0,
        lastFailureTime: 0,
        averageLatency: 0,
        isPartitioned: false
      })
    }

    return {
      totalRequests: 0,
      successfulRequests: 0,
      failedRequests: 0,
      timeoutRequests: 0,
      retryAttempts: 0,
      peerMetrics,
      suspectedPartitions: new Set(),
      recoveredPartitions: new Set(),
      averageLatency: 0,
      maxLatency: 0,
      minLatency: Infinity
    }
  }

  // RequestVote RPC
  async sendRequestVote(targetNodeId: NodeId, request: RequestVoteRequest): Promise<RequestVoteResponse> {
    return this.sendRPCRequest<RequestVoteRequest, RequestVoteResponse>(
      targetNodeId,
      'RequestVote',
      request
    )
  }

  // AppendEntries RPC
  async sendAppendEntries(targetNodeId: NodeId, request: AppendEntriesRequest): Promise<AppendEntriesResponse> {
    return this.sendRPCRequest<AppendEntriesRequest, AppendEntriesResponse>(
      targetNodeId,
      'AppendEntries',
      request
    )
  }

  // InstallSnapshot RPC
  async sendInstallSnapshot(targetNodeId: NodeId, request: InstallSnapshotRequest): Promise<InstallSnapshotResponse> {
    return this.sendRPCRequest<InstallSnapshotRequest, InstallSnapshotResponse>(
      targetNodeId,
      'InstallSnapshot',
      request
    )
  }

  // Generic RPC request with timeout, retry and partition detection
  private async sendRPCRequest<TRequest, TResponse>(
    targetNodeId: NodeId,
    type: 'RequestVote' | 'AppendEntries' | 'InstallSnapshot',
    requestData: TRequest
  ): Promise<TResponse> {
    const requestId = this.generateRequestId()
    const startTime = Date.now()

    try {
      // Check if peer is partitioned
      if (this.isPeerPartitioned(targetNodeId)) {
        throw new RaftNetworkError(`Peer ${targetNodeId} is partitioned`)
      }

      const request: RaftRPCRequest = {
        type,
        requestId,
        sourceNodeId: this.config.nodeId,
        targetNodeId,
        timestamp: startTime,
        data: requestData
      }

      // Send request with timeout
      const response = await this.sendWithTimeout(request)

      // Update metrics on success
      this.updateMetricsOnSuccess(targetNodeId, Date.now() - startTime)

      this.emit('rpc_success', {
        type,
        targetNodeId,
        requestId,
        latency: Date.now() - startTime
      })

      return response.data as TResponse

    } catch (error: any) {
      // Update metrics on failure
      this.updateMetricsOnFailure(targetNodeId, error)

      // Check for partition
      if (this.config.partitionDetectionEnabled) {
        this.checkForPartition(targetNodeId, error)
      }

      this.emit('rpc_failure', {
        type,
        targetNodeId,
        requestId,
        error: error.message,
        latency: Date.now() - startTime
      })

      throw error
    }
  }

  // Send request with timeout handling
  private async sendWithTimeout(request: RaftRPCRequest): Promise<RaftRPCResponse> {
    return new Promise<RaftRPCResponse>((resolve, reject) => {
      const timeout = setTimeout(() => {
        this.activeRequests.delete(request.requestId)
        this.metrics.timeoutRequests++
        reject(new RaftNetworkError(`Request timeout for ${request.targetNodeId}`))
      }, this.config.requestTimeout)

      this.activeRequests.set(request.requestId, timeout)

      // Simulate network request (in real implementation, this would be HTTP/TCP)
      this.performNetworkRequest(request)
        .then(response => {
          clearTimeout(timeout)
          this.activeRequests.delete(request.requestId)
          resolve(response)
        })
        .catch(error => {
          clearTimeout(timeout)
          this.activeRequests.delete(request.requestId)
          reject(error)
        })
    })
  }

  // Simulate network request (placeholder for actual implementation)
  private async performNetworkRequest(request: RaftRPCRequest): Promise<RaftRPCResponse> {
    const peerConfig = this.config.peers.get(request.targetNodeId)
    if (!peerConfig) {
      throw new RaftNetworkError(`Peer configuration not found for ${request.targetNodeId}`)
    }

    // Check if peer is simulated as failed
    const peerMetrics = this.metrics.peerMetrics.get(request.targetNodeId)
    if (peerMetrics?.isPartitioned) {
      throw new RaftNetworkError(`Network error to ${request.targetNodeId}`)
    }

    // Simulate network delay
    await new Promise(resolve => setTimeout(resolve, Math.random() * 10))

    // Simulate network failures (for testing) - reduced rate
    if (Math.random() < 0.05) { // 5% failure rate
      throw new RaftNetworkError(`Network error to ${request.targetNodeId}`)
    }

    // Mock response based on request type
    const response: RaftRPCResponse = {
      type: request.type,
      requestId: request.requestId,
      sourceNodeId: request.targetNodeId,
      targetNodeId: request.sourceNodeId,
      timestamp: Date.now(),
      success: true,
      data: this.createMockResponse(request)
    }

    return response
  }

  // Create mock response for testing
  private createMockResponse(request: RaftRPCRequest): any {
    switch (request.type) {
      case 'RequestVote':
        return {
          term: (request.data as RequestVoteRequest).term,
          voteGranted: Math.random() > 0.5
        }

      case 'AppendEntries':
        return {
          term: (request.data as AppendEntriesRequest).term,
          success: Math.random() > 0.2,
          matchIndex: (request.data as AppendEntriesRequest).prevLogIndex
        }

      case 'InstallSnapshot':
        return {
          term: (request.data as InstallSnapshotRequest).term
        }

      default:
        throw new RaftNetworkError(`Unknown request type: ${request.type}`)
    }
  }

  // Partition detection
  private checkForPartition(targetNodeId: NodeId, error: Error): void {
    const peerMetrics = this.metrics.peerMetrics.get(targetNodeId)
    if (!peerMetrics) return

    peerMetrics.consecutiveFailures++
    peerMetrics.lastFailureTime = Date.now()

    // Check if we should consider this peer partitioned
    if (peerMetrics.consecutiveFailures >= this.config.partitionThreshold && !peerMetrics.isPartitioned) {
      peerMetrics.isPartitioned = true
      this.metrics.suspectedPartitions.add(targetNodeId)

      this.emit('partition_detected', {
        nodeId: targetNodeId,
        consecutiveFailures: peerMetrics.consecutiveFailures,
        error: error.message
      })

      // Schedule partition recovery check
      this.schedulePartitionRecovery(targetNodeId)
    }
  }

  // Schedule partition recovery attempt
  private schedulePartitionRecovery(targetNodeId: NodeId): void {
    // Clear existing timer
    const existingTimer = this.partitionRecoveryTimers.get(targetNodeId)
    if (existingTimer) {
      clearTimeout(existingTimer)
    }

    const timer = setTimeout(async () => {
      await this.attemptPartitionRecovery(targetNodeId)
    }, this.config.partitionRecoveryDelay)

    this.partitionRecoveryTimers.set(targetNodeId, timer)
  }

  // Attempt to recover from partition
  private async attemptPartitionRecovery(targetNodeId: NodeId): Promise<void> {
    try {
      // Send a simple heartbeat to test connectivity
      const heartbeatRequest: AppendEntriesRequest = {
        term: 1,
        leaderId: this.config.nodeId,
        prevLogIndex: 0,
        prevLogTerm: 0,
        entries: [],
        leaderCommit: 0
      }

      await this.sendWithTimeout({
        type: 'AppendEntries',
        requestId: this.generateRequestId(),
        sourceNodeId: this.config.nodeId,
        targetNodeId,
        timestamp: Date.now(),
        data: heartbeatRequest
      })

      // Recovery successful
      const peerMetrics = this.metrics.peerMetrics.get(targetNodeId)
      if (peerMetrics) {
        peerMetrics.isPartitioned = false
        peerMetrics.consecutiveFailures = 0
      }

      this.metrics.suspectedPartitions.delete(targetNodeId)
      this.metrics.recoveredPartitions.add(targetNodeId)

      this.emit('partition_recovered', {
        nodeId: targetNodeId
      })

    } catch (error: any) {
      // Recovery failed, schedule another attempt
      this.emit('partition_recovery_failed', {
        nodeId: targetNodeId,
        error: error.message
      })

      this.schedulePartitionRecovery(targetNodeId)
    }
  }

  // Retry mechanism with exponential backoff
  async sendWithRetry<TRequest, TResponse>(
    targetNodeId: NodeId,
    type: 'RequestVote' | 'AppendEntries' | 'InstallSnapshot',
    requestData: TRequest,
    maxRetries: number = this.config.maxRetries
  ): Promise<TResponse> {
    let lastError: Error

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        if (attempt > 0) {
          this.metrics.retryAttempts++

          // Exponential backoff
          const delay = Math.min(
            this.config.retryBaseDelay * Math.pow(2, attempt - 1),
            this.config.retryMaxDelay
          )

          await new Promise(resolve => setTimeout(resolve, delay))

          this.emit('rpc_retry', {
            type,
            targetNodeId,
            attempt,
            delay
          })
        }

        return await this.sendRPCRequest<TRequest, TResponse>(targetNodeId, type, requestData)

      } catch (error: any) {
        lastError = error

        // Don't retry on certain errors
        if (error.message.includes('partitioned') || attempt === maxRetries) {
          break
        }
      }
    }

    throw lastError!
  }

  // Broadcast to all peers
  async broadcastToAll<TRequest, TResponse>(
    type: 'RequestVote' | 'AppendEntries' | 'InstallSnapshot',
    requestData: TRequest,
    requireMajority: boolean = false
  ): Promise<Map<NodeId, TResponse | Error>> {
    const results = new Map<NodeId, TResponse | Error>()
    const promises: Promise<void>[] = []

    for (const [nodeId] of this.config.peers) {
      const promise = this.sendRPCRequest<TRequest, TResponse>(nodeId, type, requestData)
        .then(response => {
          results.set(nodeId, response)
        })
        .catch(error => {
          results.set(nodeId, error)
        })

      promises.push(promise)
    }

    await Promise.allSettled(promises)

    // Check majority requirement
    if (requireMajority) {
      const successCount = Array.from(results.values()).filter(result => !(result instanceof Error)).length
      const majorityCount = Math.floor(this.config.peers.size / 2) + 1

      if (successCount < majorityCount) {
        throw new RaftNetworkError(`Failed to achieve majority: ${successCount}/${this.config.peers.size}`)
      }
    }

    this.emit('broadcast_completed', {
      type,
      totalPeers: this.config.peers.size,
      successCount: Array.from(results.values()).filter(result => !(result instanceof Error)).length,
      results
    })

    return results
  }

  // Utility methods
  private generateRequestId(): string {
    return `${this.config.nodeId}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
  }

  private isPeerPartitioned(nodeId: NodeId): boolean {
    const peerMetrics = this.metrics.peerMetrics.get(nodeId)
    return peerMetrics?.isPartitioned || false
  }

  private updateMetricsOnSuccess(nodeId: NodeId, latency: number): void {
    this.metrics.totalRequests++
    this.metrics.successfulRequests++

    // Update latency metrics
    this.metrics.averageLatency = (this.metrics.averageLatency * (this.metrics.successfulRequests - 1) + latency) / this.metrics.successfulRequests
    this.metrics.maxLatency = Math.max(this.metrics.maxLatency, latency)
    this.metrics.minLatency = Math.min(this.metrics.minLatency, latency)

    // Update peer metrics
    const peerMetrics = this.metrics.peerMetrics.get(nodeId)
    if (peerMetrics) {
      peerMetrics.totalRequests++
      peerMetrics.successfulRequests++
      peerMetrics.consecutiveFailures = 0
      peerMetrics.lastSuccessTime = Date.now()
      peerMetrics.averageLatency = (peerMetrics.averageLatency * (peerMetrics.successfulRequests - 1) + latency) / peerMetrics.successfulRequests
    }
  }

  private updateMetricsOnFailure(nodeId: NodeId, error: Error): void {
    this.metrics.totalRequests++
    this.metrics.failedRequests++

    const peerMetrics = this.metrics.peerMetrics.get(nodeId)
    if (peerMetrics) {
      peerMetrics.totalRequests++
      peerMetrics.failedRequests++
      peerMetrics.lastFailureTime = Date.now()
    }
  }

  // Public API
  getMetrics(): NetworkMetrics {
    return { ...this.metrics }
  }

  getPeerMetrics(nodeId: NodeId): PeerMetrics | undefined {
    const metrics = this.metrics.peerMetrics.get(nodeId)
    return metrics ? { ...metrics } : undefined
  }

  isHealthy(): boolean {
    const healthyPeers = Array.from(this.metrics.peerMetrics.values())
      .filter(peer => !peer.isPartitioned).length

    // For a cluster of N nodes, we need (N+1)/2 nodes to be healthy (including self)
    const totalNodes = this.config.peers.size + 1 // Include self
    const majorityCount = Math.floor(totalNodes / 2) + 1
    const healthyNodes = healthyPeers + 1 // Include self as healthy

    return healthyNodes >= majorityCount
  }

  // Cleanup
  close(): void {
    // Clear all active requests
    for (const [, timeout] of this.activeRequests) {
      clearTimeout(timeout)
    }
    this.activeRequests.clear()

    // Clear partition recovery timers
    for (const [, timer] of this.partitionRecoveryTimers) {
      clearTimeout(timer)
    }
    this.partitionRecoveryTimers.clear()

    // Clear retry queues
    this.retryQueues.clear()

    this.removeAllListeners()
  }

  // For testing
  async reset(): Promise<void> {
    this.close()
    this.metrics = this.initializeMetrics()
  }

  // Mock network failure for testing
  simulateNetworkFailure(nodeId: NodeId, duration: number): void {
    const peerMetrics = this.metrics.peerMetrics.get(nodeId)
    if (peerMetrics) {
      peerMetrics.isPartitioned = true
      this.metrics.suspectedPartitions.add(nodeId)

      setTimeout(() => {
        peerMetrics.isPartitioned = false
        this.metrics.suspectedPartitions.delete(nodeId)
        this.metrics.recoveredPartitions.add(nodeId)
      }, duration)
    }
  }
}