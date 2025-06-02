/**
 * Replicated WAL Collection
 * Коллекция с enterprise-grade репликацией и WAL
 */

import { EventEmitter } from 'events'
import { WALCollection } from '../../WALCollection'
import { ReplicatedWALManager, ReplicatedWALOptions } from '../wal/ReplicatedWALManager'
import { NetworkManager } from '../network/NetworkManager'
import { ClusterConfig } from '../types/ReplicationTypes'
import { Item } from '../../types/Item'

export interface ReplicatedCollectionOptions<T extends Item> {
  name: string
  root: string
  cluster: ClusterConfig
  enableTransactions?: boolean
  walOptions?: Partial<ReplicatedWALOptions>
}

export class ReplicatedWALCollection<T extends Item> extends EventEmitter {
  private walCollection: WALCollection<T>
  private replicatedWALManager: ReplicatedWALManager
  private networkManager: NetworkManager
  private clusterConfig: ClusterConfig
  private isInitialized = false

  constructor(options: ReplicatedCollectionOptions<T>) {
    super()
    this.clusterConfig = options.cluster

    // Initialize network manager
    this.networkManager = new NetworkManager(
      options.cluster.nodeId,
      options.cluster.port
    )

    // Setup WAL options with replication
    const walOptions: ReplicatedWALOptions = {
      walPath: `${options.root}/${options.name}.wal`,
      flushInterval: 1000,
      maxBufferSize: 100,
      enableCompression: false,
      enableChecksums: true,
      ...options.walOptions,
      replication: {
        enabled: true,
        networkManager: this.networkManager,
        config: options.cluster.replication,
        role: 'FOLLOWER' // Start as follower, will be promoted by consensus
      }
    }

    // Initialize replicated WAL manager
    this.replicatedWALManager = new ReplicatedWALManager(walOptions)

    // Initialize WAL collection with replicated WAL manager
    this.walCollection = WALCollection.create<T>({
      name: options.name,
      root: options.root,
      enableTransactions: options.enableTransactions ?? true,
      walOptions: {
        ...walOptions,
        walPath: walOptions.walPath
      }
    })

    this.setupEventHandlers()
  }

  private setupEventHandlers(): void {
    // Forward replication events
    this.replicatedWALManager.onEntryReplicated((entry) => {
      this.emit('entryReplicated', entry)
    })

    this.replicatedWALManager.onEntryReceived((entry, sourceNode) => {
      this.emit('entryReceived', entry, sourceNode)
    })

    this.replicatedWALManager.onReplicationError((error, entry) => {
      this.emit('replicationError', error, entry)
    })

    this.replicatedWALManager.onRoleChanged((role) => {
      this.emit('roleChanged', role)
    })

    // Forward network events
    this.networkManager.on('nodeConnected', (nodeId) => {
      this.emit('nodeConnected', nodeId)
    })

    this.networkManager.on('nodeDisconnected', (nodeId) => {
      this.emit('nodeDisconnected', nodeId)
    })

    this.networkManager.on('error', (error) => {
      this.emit('networkError', error)
    })
  }

  async initialize(): Promise<void> {
    if (this.isInitialized) {
      return
    }

    console.log(`Initializing replicated collection ${this.walCollection.name} on node ${this.clusterConfig.nodeId}`)

    // Connect to other nodes in the cluster
    for (const node of this.clusterConfig.nodes) {
      if (node.id !== this.clusterConfig.nodeId) {
        try {
          await this.networkManager.connect(node.id, node.address, node.port)
          console.log(`Connected to node ${node.id}`)
        } catch (error) {
          console.warn(`Failed to connect to node ${node.id}:`, error)
        }
      }
    }

    // Wait for initial connections
    await new Promise(resolve => setTimeout(resolve, 500))

    // Sync with cluster if we're a follower
    if (this.replicatedWALManager.getRole() === 'FOLLOWER') {
      await this.replicatedWALManager.syncWithCluster()
    }

    this.isInitialized = true
    console.log(`Replicated collection ${this.walCollection.name} initialized successfully`)
  }

  // Delegate all collection methods to WALCollection
  async insert(item: T): Promise<T> {
    const result = await this.walCollection.create(item)
    if (!result) {
      throw new Error('Failed to insert item')
    }
    return result
  }

  async update(id: any, updates: Partial<T>): Promise<T | undefined> {
    return this.walCollection.updateWithId(id, updates)
  }

  async delete(id: any): Promise<boolean> {
    const result = await this.walCollection.removeWithId(id)
    return !!result
  }

  async find(query?: any): Promise<T[]> {
    return this.walCollection.find(query)
  }

  async findOne(query?: any): Promise<T | undefined> {
    return this.walCollection.findFirst(query)
  }

  async findById(id: any): Promise<T | undefined> {
    return this.walCollection.findById(id)
  }

  async count(query?: any): Promise<number> {
    const results = await this.walCollection.find(query)
    return results.length
  }

  async clear(): Promise<void> {
    await this.walCollection.reset()
  }

  // Transaction methods
  async beginTransaction(): Promise<string> {
    return this.walCollection.beginTransaction()
  }

  async commitTransaction(transactionId: string): Promise<void> {
    return this.walCollection.commitTransaction(transactionId)
  }

  async rollbackTransaction(transactionId: string): Promise<void> {
    return this.walCollection.rollbackTransaction(transactionId)
  }

  // Replication-specific methods
  async promoteToLeader(): Promise<void> {
    await this.replicatedWALManager.promoteToLeader()
    console.log(`Node ${this.clusterConfig.nodeId} promoted to LEADER`)
  }

  async demoteToFollower(): Promise<void> {
    await this.replicatedWALManager.demoteToFollower()
    console.log(`Node ${this.clusterConfig.nodeId} demoted to FOLLOWER`)
  }

  getRole(): 'LEADER' | 'FOLLOWER' | 'CANDIDATE' {
    return this.replicatedWALManager.getRole()
  }

  getReplicationStatus() {
    return this.replicatedWALManager.getReplicationStatus()
  }

  getClusterStatus() {
    const connectedNodes = this.networkManager.getConnectedNodes()
    const replicationStatus = this.getReplicationStatus()

    return {
      nodeId: this.clusterConfig.nodeId,
      role: this.getRole(),
      connectedNodes: connectedNodes.length,
      totalNodes: this.clusterConfig.nodes.length,
      connectedNodeIds: connectedNodes,
      replicationStatus,
      networkMetrics: this.networkManager.getMetrics()
    }
  }

  async syncWithCluster(): Promise<void> {
    await this.replicatedWALManager.syncWithCluster()
  }

  async createCheckpoint(): Promise<void> {
    await this.replicatedWALManager.createCheckpoint()
  }

  async close(): Promise<void> {
    console.log(`Closing replicated collection ${this.walCollection.name}`)

    // WALCollection doesn't have close method, just close replication components
    await this.replicatedWALManager.close()
    await this.networkManager.close()

    this.removeAllListeners()
    console.log(`Replicated collection ${this.walCollection.name} closed`)
  }

  // Event handler methods
  onEntryReplicated(handler: (entry: any) => void): void {
    this.on('entryReplicated', handler)
  }

  onEntryReceived(handler: (entry: any, sourceNode: string) => void): void {
    this.on('entryReceived', handler)
  }

  onReplicationError(handler: (error: Error, entry?: any) => void): void {
    this.on('replicationError', handler)
  }

  onRoleChanged(handler: (role: 'LEADER' | 'FOLLOWER' | 'CANDIDATE') => void): void {
    this.on('roleChanged', handler)
  }

  onNodeConnected(handler: (nodeId: string) => void): void {
    this.on('nodeConnected', handler)
  }

  onNodeDisconnected(handler: (nodeId: string) => void): void {
    this.on('nodeDisconnected', handler)
  }

  onNetworkError(handler: (error: Error) => void): void {
    this.on('networkError', handler)
  }

  // Getter for underlying collection (for advanced use cases)
  get collection(): WALCollection<T> {
    return this.walCollection
  }

  get name(): string {
    return this.walCollection.name
  }
}