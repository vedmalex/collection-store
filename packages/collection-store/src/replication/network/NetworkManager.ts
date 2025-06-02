/**
 * Network Manager for Replication
 * WebSocket-based communication между узлами кластера
 */

import { EventEmitter } from 'events'
import WebSocket, { WebSocketServer } from 'ws'
import crypto from 'crypto'
import { INetworkManager, ReplicationMessage, ReplicationMetrics } from '../types/ReplicationTypes'

export class NetworkManager extends EventEmitter implements INetworkManager {
  readonly nodeId: string
  private port: number
  private server?: WebSocketServer
  private connections = new Map<string, WebSocket>()
  private connectionAttempts = new Map<string, number>()
  private maxRetries = 5
  private retryDelay = 1000
  private metrics: ReplicationMetrics
  private closed = false

  constructor(nodeId: string, port: number) {
    super()
    this.nodeId = nodeId
    this.port = port
    this.metrics = {
      totalMessages: 0,
      successfulReplications: 0,
      failedReplications: 0,
      averageLatency: 0,
      throughput: 0,
      lastUpdate: Date.now()
    }

    this.startServer()
  }

  private startServer(): void {
    try {
      this.server = new WebSocketServer({
        port: this.port,
        perMessageDeflate: false // Disable compression for better performance
      })

      this.server.on('connection', (ws, req) => {
        const nodeId = this.extractNodeId(req)
        if (!nodeId) {
          console.warn('Connection rejected: no node ID provided')
          ws.close()
          return
        }

        console.log(`Node ${nodeId} connected to ${this.nodeId}`)
        this.setupConnection(nodeId, ws)
      })

      this.server.on('error', (error) => {
        console.error(`WebSocket server error on node ${this.nodeId}:`, error)
        this.emit('error', error)
      })

      console.log(`NetworkManager started on node ${this.nodeId}, port ${this.port}`)
    } catch (error) {
      console.error(`Failed to start WebSocket server on port ${this.port}:`, error)
      throw error
    }
  }

  private setupConnection(nodeId: string, ws: WebSocket): void {
    // Store connection
    this.connections.set(nodeId, ws)
    this.connectionAttempts.delete(nodeId) // Reset retry counter

    // Setup message handler
    ws.on('message', (data) => {
      try {
        const message = JSON.parse(data.toString()) as ReplicationMessage

        // Validate message
        if (!this.validateMessage(message)) {
          console.warn(`Invalid message from ${nodeId}:`, message)
          return
        }

        // Update metrics
        this.metrics.totalMessages++
        this.metrics.lastUpdate = Date.now()

        // Emit message event
        this.emit('message', message)
      } catch (error) {
        console.error(`Failed to parse message from ${nodeId}:`, error)
      }
    })

    // Setup connection handlers
    ws.on('close', () => {
      console.log(`Node ${nodeId} disconnected from ${this.nodeId}`)
      this.connections.delete(nodeId)
      this.emit('nodeDisconnected', nodeId)
    })

    ws.on('error', (error) => {
      console.error(`Connection error with node ${nodeId}:`, error)
      this.connections.delete(nodeId)
      this.emit('nodeError', nodeId, error)
    })

    // Setup ping/pong for connection health
    ws.on('pong', () => {
      // Connection is alive
    })

    // Send periodic pings
    const pingInterval = setInterval(() => {
      if (ws.readyState === WebSocket.OPEN) {
        ws.ping()
      } else {
        clearInterval(pingInterval)
      }
    }, 30000) // 30 seconds

    this.emit('nodeConnected', nodeId)
  }

  private extractNodeId(req: any): string | undefined {
    // Extract node ID from URL query parameters
    const url = new URL(req.url || '', `http://${req.headers.host}`)
    return url.searchParams.get('nodeId') || undefined
  }

  private validateMessage(message: ReplicationMessage): boolean {
    if (!message.type || !message.sourceNodeId || !message.timestamp || !message.messageId) {
      return false
    }

    // Validate checksum
    const expectedChecksum = this.calculateChecksum(message)
    return message.checksum === expectedChecksum
  }

  private calculateChecksum(message: ReplicationMessage): string {
    const messageForChecksum = { ...message, checksum: '' }
    const data = JSON.stringify(messageForChecksum)
    return crypto.createHash('sha256').update(data).digest('hex')
  }

  async sendMessage(nodeId: string, message: ReplicationMessage): Promise<void> {
    if (this.closed) {
      throw new Error('NetworkManager is closed')
    }

    const connection = this.connections.get(nodeId)
    if (!connection || connection.readyState !== WebSocket.OPEN) {
      throw new Error(`No active connection to node ${nodeId}`)
    }

    try {
      // Prepare message
      message.sourceNodeId = this.nodeId
      message.timestamp = Date.now()
      message.messageId = crypto.randomUUID()
      message.checksum = this.calculateChecksum(message)

      // Send message
      const startTime = Date.now()
      connection.send(JSON.stringify(message))

      // Update metrics
      this.metrics.successfulReplications++
      const latency = Date.now() - startTime
      this.updateLatencyMetrics(latency)

    } catch (error) {
      this.metrics.failedReplications++
      console.error(`Failed to send message to ${nodeId}:`, error)
      throw error
    }
  }

  async broadcastMessage(message: ReplicationMessage): Promise<void> {
    if (this.closed) {
      throw new Error('NetworkManager is closed')
    }

    const connectedNodes = Array.from(this.connections.keys())
    const promises = connectedNodes.map(nodeId =>
      this.sendMessage(nodeId, { ...message }).catch(error => {
        console.warn(`Failed to broadcast to ${nodeId}:`, error)
        return error
      })
    )

    const results = await Promise.allSettled(promises)
    const failures = results.filter(r => r.status === 'rejected').length

    if (failures > 0) {
      console.warn(`Broadcast completed with ${failures} failures out of ${connectedNodes.length} nodes`)
    }
  }

  async connect(nodeId: string, address: string, port: number): Promise<void> {
    if (this.closed) {
      throw new Error('NetworkManager is closed')
    }

    if (this.connections.has(nodeId)) {
      console.log(`Already connected to node ${nodeId}`)
      return
    }

    const attempts = this.connectionAttempts.get(nodeId) || 0
    if (attempts >= this.maxRetries) {
      throw new Error(`Max connection attempts reached for node ${nodeId}`)
    }

    try {
      const wsUrl = `ws://${address}:${port}?nodeId=${this.nodeId}`
      const ws = new WebSocket(wsUrl)

      await new Promise<void>((resolve, reject) => {
        const timeout = setTimeout(() => {
          ws.close()
          reject(new Error(`Connection timeout to ${nodeId}`))
        }, 10000) // 10 second timeout

        ws.on('open', () => {
          clearTimeout(timeout)
          console.log(`Connected to node ${nodeId} at ${address}:${port}`)
          this.setupConnection(nodeId, ws)
          resolve()
        })

        ws.on('error', (error) => {
          clearTimeout(timeout)
          reject(error)
        })
      })

      // Reset retry counter on successful connection
      this.connectionAttempts.delete(nodeId)

    } catch (error) {
      // Increment retry counter
      this.connectionAttempts.set(nodeId, attempts + 1)

      console.error(`Failed to connect to node ${nodeId} (attempt ${attempts + 1}):`, error)

      // Retry with exponential backoff
      if (attempts < this.maxRetries - 1) {
        const delay = this.retryDelay * Math.pow(2, attempts)
        console.log(`Retrying connection to ${nodeId} in ${delay}ms`)

        setTimeout(() => {
          this.connect(nodeId, address, port).catch(retryError => {
            console.error(`Retry failed for node ${nodeId}:`, retryError)
          })
        }, delay)
      }

      throw error
    }
  }

  async disconnect(nodeId: string): Promise<void> {
    const connection = this.connections.get(nodeId)
    if (connection) {
      connection.close()
      this.connections.delete(nodeId)
      console.log(`Disconnected from node ${nodeId}`)
    }
  }

  getConnectedNodes(): string[] {
    return Array.from(this.connections.keys())
  }

  isConnected(nodeId: string): boolean {
    const connection = this.connections.get(nodeId)
    return connection ? connection.readyState === WebSocket.OPEN : false
  }

  onMessage(handler: (message: ReplicationMessage) => void): void {
    this.on('message', handler)
  }

  getMetrics(): ReplicationMetrics {
    // Calculate throughput (messages per second)
    const now = Date.now()
    const timeDiff = (now - this.metrics.lastUpdate) / 1000
    this.metrics.throughput = timeDiff > 0 ? this.metrics.totalMessages / timeDiff : 0

    return { ...this.metrics }
  }

  private updateLatencyMetrics(latency: number): void {
    // Simple moving average for latency
    const alpha = 0.1 // Smoothing factor
    this.metrics.averageLatency = this.metrics.averageLatency * (1 - alpha) + latency * alpha
  }

  async close(): Promise<void> {
    if (this.closed) {
      return
    }

    this.closed = true
    console.log(`Closing NetworkManager for node ${this.nodeId}`)

    // Close all connections
    for (const [nodeId, connection] of this.connections) {
      try {
        connection.close()
      } catch (error) {
        console.warn(`Error closing connection to ${nodeId}:`, error)
      }
    }
    this.connections.clear()

    // Close server
    if (this.server) {
      await new Promise<void>((resolve) => {
        this.server!.close(() => {
          console.log(`WebSocket server closed for node ${this.nodeId}`)
          resolve()
        })
      })
    }

    this.removeAllListeners()
  }
}