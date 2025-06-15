/**
 * Raft State Machine
 * Integrates collection operations with Raft consensus protocol
 */

import { EventEmitter } from 'events'
import {
  IRaftStateMachine,
  RaftLogEntry,
  RaftCommand,
  LogIndex,
  RaftError
} from './types'
import { WALDatabase } from '../../core/wal/WALDatabase'

export interface RaftStateMachineConfig {
  nodeId: string
  dataPath: string
  enableSnapshots: boolean
  snapshotInterval: number // Number of applied entries before snapshot
}

export interface StateMachineState {
  lastAppliedIndex: LogIndex
  lastAppliedTerm: number
  appliedEntriesCount: number
  snapshotCount: number
}

export class RaftStateMachine extends EventEmitter implements IRaftStateMachine {
  private config: RaftStateMachineConfig
  private database: WALDatabase
  private state: StateMachineState
  private collections: Map<string, any> = new Map()

  constructor(config: RaftStateMachineConfig) {
    super()
    this.config = config
    this.state = {
      lastAppliedIndex: 0,
      lastAppliedTerm: 0,
      appliedEntriesCount: 0,
      snapshotCount: 0
    }

    // Initialize WAL database
    this.database = new WALDatabase(config.dataPath, 'raft-state-machine', {
      enableTransactions: true,
      globalWAL: true
    })
  }

  async initialize(): Promise<void> {
    try {
      await this.database.connect()
      await this.database.load()
      this.emit('initialized', { nodeId: this.config.nodeId })
    } catch (error: any) {
      throw new RaftError(`Failed to initialize state machine: ${error.message}`, 'STATE_MACHINE_ERROR')
    }
  }

  // Apply committed log entry to state machine
  async apply(entry: RaftLogEntry): Promise<any> {
    try {
      // Validate entry
      if (entry.index <= this.state.lastAppliedIndex) {
        throw new RaftError(
          `Entry index ${entry.index} is not greater than last applied ${this.state.lastAppliedIndex}`,
          'INVALID_ENTRY_INDEX'
        )
      }

      // Apply command based on type
      const result = await this.applyCommand(entry.command)

      // Update state
      this.state.lastAppliedIndex = entry.index
      this.state.lastAppliedTerm = entry.term
      this.state.appliedEntriesCount++

      // Check if snapshot is needed
      if (this.config.enableSnapshots &&
          this.state.appliedEntriesCount % this.config.snapshotInterval === 0) {
        await this.triggerSnapshot()
      }

      this.emit('entry_applied', {
        index: entry.index,
        term: entry.term,
        command: entry.command,
        result
      })

      return result

    } catch (error: any) {
      this.emit('apply_error', {
        index: entry.index,
        command: entry.command,
        error: error.message
      })
      throw error
    }
  }

  // Apply individual command to collections
  private async applyCommand(command: RaftCommand): Promise<any> {
    const { type, collectionName, data, transactionId } = command

    // Get or create collection
    let collection = this.collections.get(collectionName)
    if (!collection) {
      collection = await this.database.createCollection(collectionName)
      this.collections.set(collectionName, collection)
    }

    switch (type) {
      case 'CREATE':
        return await this.applyCreate(collection, data)

      case 'UPDATE':
        return await this.applyUpdate(collection, data)

      case 'DELETE':
        return await this.applyDelete(collection, data)

      case 'TRANSACTION_BEGIN':
        return await this.applyTransactionBegin(transactionId!)

      case 'TRANSACTION_COMMIT':
        return await this.applyTransactionCommit(transactionId!)

      case 'TRANSACTION_ROLLBACK':
        return await this.applyTransactionRollback(transactionId!)

      default:
        throw new RaftError(`Unknown command type: ${type}`, 'UNKNOWN_COMMAND')
    }
  }

  private async applyCreate(collection: any, data: any): Promise<any> {
    try {
      const result = await collection.create(data)

      this.emit('command_applied', {
        type: 'CREATE',
        collection: collection.name,
        data,
        result
      })

      return result
    } catch (error: any) {
      throw new RaftError(`Create operation failed: ${error.message}`, 'CREATE_FAILED')
    }
  }

  private async applyUpdate(collection: any, data: any): Promise<any> {
    try {
      const { id, updates } = data
      const result = await collection.updateWithId(id, updates)

      this.emit('command_applied', {
        type: 'UPDATE',
        collection: collection.name,
        data,
        result
      })

      return result
    } catch (error: any) {
      throw new RaftError(`Update operation failed: ${error.message}`, 'UPDATE_FAILED')
    }
  }

  private async applyDelete(collection: any, data: any): Promise<any> {
    try {
      const { id } = data
      const result = await collection.removeWithId(id)

      this.emit('command_applied', {
        type: 'DELETE',
        collection: collection.name,
        data,
        result
      })

      return result
    } catch (error: any) {
      throw new RaftError(`Delete operation failed: ${error.message}`, 'DELETE_FAILED')
    }
  }

  private async applyTransactionBegin(transactionId: string): Promise<any> {
    try {
      const actualTransactionId = await this.database.beginGlobalTransaction()

      this.emit('command_applied', {
        type: 'TRANSACTION_BEGIN',
        transactionId,
        result: { transactionId: actualTransactionId }
      })

      return { transactionId: actualTransactionId }
    } catch (error: any) {
      throw new RaftError(`Transaction begin failed: ${error.message}`, 'TRANSACTION_BEGIN_FAILED')
    }
  }

  private async applyTransactionCommit(transactionId: string): Promise<any> {
    try {
      await this.database.commitGlobalTransaction(transactionId)

      this.emit('command_applied', {
        type: 'TRANSACTION_COMMIT',
        transactionId,
        result: { committed: true }
      })

      return { committed: true }
    } catch (error: any) {
      throw new RaftError(`Transaction commit failed: ${error.message}`, 'TRANSACTION_COMMIT_FAILED')
    }
  }

  private async applyTransactionRollback(transactionId: string): Promise<any> {
    try {
      await this.database.rollbackGlobalTransaction(transactionId)

      this.emit('command_applied', {
        type: 'TRANSACTION_ROLLBACK',
        transactionId,
        result: { rolledBack: true }
      })

      return { rolledBack: true }
    } catch (error: any) {
      throw new RaftError(`Transaction rollback failed: ${error.message}`, 'TRANSACTION_ROLLBACK_FAILED')
    }
  }

  // Snapshot operations
  async createSnapshot(): Promise<Buffer> {
    try {
      const snapshot = {
        lastAppliedIndex: this.state.lastAppliedIndex,
        lastAppliedTerm: this.state.lastAppliedTerm,
        appliedEntriesCount: this.state.appliedEntriesCount,
        collections: await this.serializeCollections(),
        timestamp: Date.now(),
        nodeId: this.config.nodeId
      }

      const snapshotBuffer = Buffer.from(JSON.stringify(snapshot), 'utf8')

      this.state.snapshotCount++

      this.emit('snapshot_created', {
        lastAppliedIndex: this.state.lastAppliedIndex,
        size: snapshotBuffer.length,
        snapshotCount: this.state.snapshotCount
      })

      return snapshotBuffer

    } catch (error: any) {
      throw new RaftError(`Snapshot creation failed: ${error.message}`, 'SNAPSHOT_CREATE_FAILED')
    }
  }

  async restoreSnapshot(data: Buffer): Promise<void> {
    try {
      const snapshot = JSON.parse(data.toString('utf8'))

      // Validate snapshot
      if (!snapshot.lastAppliedIndex || !snapshot.collections) {
        throw new RaftError('Invalid snapshot format', 'INVALID_SNAPSHOT')
      }

      // Restore state
      this.state.lastAppliedIndex = snapshot.lastAppliedIndex
      this.state.lastAppliedTerm = snapshot.lastAppliedTerm
      this.state.appliedEntriesCount = snapshot.appliedEntriesCount || 0

      // Restore collections
      await this.deserializeCollections(snapshot.collections)

      this.emit('snapshot_restored', {
        lastAppliedIndex: this.state.lastAppliedIndex,
        collectionsCount: Object.keys(snapshot.collections).length
      })

    } catch (error: any) {
      throw new RaftError(`Snapshot restoration failed: ${error.message}`, 'SNAPSHOT_RESTORE_FAILED')
    }
  }

  // State queries
  async getLastAppliedIndex(): Promise<LogIndex> {
    return this.state.lastAppliedIndex
  }

  async setLastAppliedIndex(index: LogIndex): Promise<void> {
    if (index < this.state.lastAppliedIndex) {
      throw new RaftError(
        `Cannot decrease last applied index from ${this.state.lastAppliedIndex} to ${index}`,
        'INVALID_INDEX_DECREASE'
      )
    }

    this.state.lastAppliedIndex = index
  }

  // Read operations (for read consistency)
  async read(collectionName: string, query: any): Promise<any> {
    try {
      const collection = this.collections.get(collectionName)
      if (!collection) {
        throw new RaftError(`Collection ${collectionName} not found`, 'COLLECTION_NOT_FOUND')
      }

      // For read consistency, we could add linearizable read support here
      const result = await collection.find(query)

      this.emit('read_operation', {
        collection: collectionName,
        query,
        resultCount: Array.isArray(result) ? result.length : 1
      })

      return result

    } catch (error: any) {
      throw new RaftError(`Read operation failed: ${error.message}`, 'READ_FAILED')
    }
  }

  // Collection serialization for snapshots
  private async serializeCollections(): Promise<any> {
    const serialized: any = {}

    for (const [name, collection] of this.collections) {
      try {
        // Get all data from collection
        const data = await collection.find({})
        serialized[name] = {
          name,
          data,
          metadata: {
            count: data.length,
            lastModified: Date.now()
          }
        }
      } catch (error: any) {
        console.warn(`Failed to serialize collection ${name}:`, error.message)
      }
    }

    return serialized
  }

  private async deserializeCollections(serializedCollections: any): Promise<void> {
    // Clear existing collections
    this.collections.clear()

    for (const [name, collectionData] of Object.entries(serializedCollections)) {
      try {
        const collection = await this.database.createCollection(name)

        // Clear existing data
        await collection.remove({}) // Remove all items

        // Restore data
        const data = (collectionData as any).data
        if (Array.isArray(data) && data.length > 0) {
          for (const item of data) {
            await collection.create(item)
          }
        }

        this.collections.set(name, collection)

      } catch (error: any) {
        console.warn(`Failed to deserialize collection ${name}:`, error.message)
      }
    }
  }

  private async triggerSnapshot(): Promise<void> {
    try {
      await this.createSnapshot()
    } catch (error: any) {
      this.emit('snapshot_error', {
        error: error.message,
        lastAppliedIndex: this.state.lastAppliedIndex
      })
    }
  }

  // Get state machine metrics
  getMetrics() {
    return {
      lastAppliedIndex: this.state.lastAppliedIndex,
      lastAppliedTerm: this.state.lastAppliedTerm,
      appliedEntriesCount: this.state.appliedEntriesCount,
      snapshotCount: this.state.snapshotCount,
      collectionsCount: this.collections.size,
      collectionsNames: Array.from(this.collections.keys())
    }
  }

  // Cleanup
  async close(): Promise<void> {
    try {
      await this.database.close()
      this.collections.clear()
      this.removeAllListeners()
    } catch (error: any) {
      throw new RaftError(`Failed to close state machine: ${error.message}`, 'CLOSE_FAILED')
    }
  }

  // For testing
  async reset(): Promise<void> {
    this.state = {
      lastAppliedIndex: 0,
      lastAppliedTerm: 0,
      appliedEntriesCount: 0,
      snapshotCount: 0
    }
    this.collections.clear()
  }
}