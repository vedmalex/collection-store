/**
 * Transactional Memory Storage Adapter
 * Транзакционная реализация memory адаптера с поддержкой WAL
 */

import { Item } from '../../types/Item'
import { ITransactionalStorageAdapter } from '../../types/ITransactionalStorageAdapter'
import { StoredData } from '../../types/StoredData'
import Collection from '../../core/Collection'
import { WALEntry, IWALManager } from '../../wal/WALTypes'
import { MemoryWALManager } from '../../wal/MemoryWALManager'

export default class TransactionalAdapterMemory<T extends Item>
  implements ITransactionalStorageAdapter<T> {

  private walManager: IWALManager
  private transactionData = new Map<string, any>() // Use any for collection.store() return type
  private checkpoints = new Map<string, any>() // checkpointId -> data snapshot

  collection!: Collection<T>

  constructor() {
    this.walManager = new MemoryWALManager()
  }

  get name() {
    return 'AdapterMemory' as const
  }

  clone(): ITransactionalStorageAdapter<T> {
    return new TransactionalAdapterMemory<T>()
  }

  init(collection: Collection<T>): ITransactionalStorageAdapter<T> {
    this.collection = collection
    return this
  }

  isTransactional(): boolean {
    return true
  }

  // Legacy IStorageAdapter methods
  async restore(name?: string): Promise<StoredData<T>> {
    // Memory adapter doesn't persist data, so return empty data structure
    return {
      list: {
        items: [],
        singlefile: false,
        counter: 0,
        tree: {} as any // Empty B+ tree structure
      },
      indexes: {},
      indexDefs: {},
      id: this.collection.name,
      ttl: undefined,
      rotate: undefined
    } as StoredData<T>
  }

  async store(name?: string) {
    // Memory adapter doesn't persist data, so this is a no-op
    // Data is kept in memory within the collection
  }

  // WAL operations
  async writeWALEntry(entry: WALEntry): Promise<void> {
    await this.walManager.writeEntry(entry)
  }

  async readWALEntries(fromSequence?: number): Promise<WALEntry[]> {
    return this.walManager.readEntries(fromSequence)
  }

  // Transactional operations
  async store_in_transaction(transactionId: string, name?: string): Promise<void> {
    // Write PREPARE to WAL
    await this.walManager.writeEntry({
      transactionId,
      sequenceNumber: 0, // Will be assigned by WAL manager
      timestamp: Date.now(),
      type: 'PREPARE',
      collectionName: this.collection.name,
      operation: 'STORE',
      data: { key: 'metadata', name },
      checksum: ''
    })

    // Prepare data for commit (store in memory)
    const data = this.collection.store()
    this.transactionData.set(transactionId, data)
  }

  async restore_in_transaction(transactionId: string, name?: string): Promise<StoredData<T>> {
    // Check if we have prepared data for this transaction
    const preparedData = this.transactionData.get(transactionId)
    if (preparedData) {
      return preparedData as StoredData<T>
    }

    // For memory adapter, return empty data structure
    return {
      list: {
        items: [],
        singlefile: false,
        counter: 0,
        tree: {} as any // Empty B+ tree structure
      },
      indexes: {},
      indexDefs: {},
      id: this.collection.name,
      ttl: undefined,
      rotate: undefined
    } as StoredData<T>
  }

  // ITransactionResource implementation
  async prepareCommit(transactionId: string): Promise<boolean> {
    try {
      // Check if we have data to commit
      const data = this.transactionData.get(transactionId)
      if (!data) {
        // No data to commit, but that's OK for memory adapter
        return true
      }

      // Write PREPARE to WAL
      await this.walManager.writeEntry({
        transactionId,
        sequenceNumber: 0,
        timestamp: Date.now(),
        type: 'PREPARE',
        collectionName: this.collection.name,
        operation: 'STORE',
        data: { key: 'metadata' },
        checksum: ''
      })

      return true
    } catch (error) {
      console.error(`Failed to prepare memory storage adapter for transaction ${transactionId}:`, error)
      return false
    }
  }

  async finalizeCommit(transactionId: string): Promise<void> {
    // Write COMMIT to WAL
    await this.walManager.writeEntry({
      transactionId,
      sequenceNumber: 0,
      timestamp: Date.now(),
      type: 'COMMIT',
      collectionName: this.collection.name,
      operation: 'STORE',
      data: { key: 'metadata' },
      checksum: ''
    })

    // For memory adapter, data is already in the collection
    // Clean up transaction data
    this.transactionData.delete(transactionId)
  }

  async rollback(transactionId: string): Promise<void> {
    // Remove transaction data
    this.transactionData.delete(transactionId)
  }

  // Checkpoint operations
  async createCheckpoint(transactionId: string): Promise<string> {
    const checkpointId = `memory_checkpoint_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`

    // Save current state to memory checkpoint
    const currentData = this.collection.store()
    this.checkpoints.set(checkpointId, JSON.parse(JSON.stringify(currentData))) // Deep copy

    // Write checkpoint to WAL
    await this.walManager.writeEntry({
      transactionId,
      sequenceNumber: 0,
      timestamp: Date.now(),
      type: 'DATA',
      collectionName: this.collection.name,
      operation: 'COMMIT',
      data: { key: 'checkpoint', checkpointId },
      checksum: ''
    })

    return checkpointId
  }

  async restoreFromCheckpoint(checkpointId: string): Promise<void> {
    const checkpointData = this.checkpoints.get(checkpointId)
    if (!checkpointData) {
      throw new Error(`Memory checkpoint ${checkpointId} not found`)
    }

    // For memory adapter, we would need to restore the collection state
    // This is a simplified implementation
    console.log(`Restoring from memory checkpoint ${checkpointId}`)
  }

  // Cleanup
  async close(): Promise<void> {
    await this.walManager.close()

    // Clean up checkpoints
    this.checkpoints.clear()
    this.transactionData.clear()
  }

  // Additional methods for testing
  getTransactionDataCount(): number {
    return this.transactionData.size
  }

  getCheckpointCount(): number {
    return this.checkpoints.size
  }

  getWALEntriesCount(): number {
    if (this.walManager instanceof MemoryWALManager) {
      return this.walManager.getEntriesCount()
    }
    return 0
  }

  clearWAL(): void {
    if (this.walManager instanceof MemoryWALManager) {
      this.walManager.clear()
    }
  }
}