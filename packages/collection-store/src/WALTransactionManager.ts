/**
 * WAL-Enhanced Transaction Manager
 * Расширенный TransactionManager с интеграцией Write-Ahead Logging
 */

import { TransactionManager, TransactionOptions, CollectionStoreTransaction, ITransactionResource } from './TransactionManager'
import { IWALManager, WALEntry } from './wal/WALTypes'
import { FileWALManager } from './wal/FileWALManager'
import { ITransactionalStorageAdapter } from './ITransactionalStorageAdapter'
import { Item } from './types/Item'

export interface WALTransactionOptions extends TransactionOptions {
  walPath?: string
  enableWAL?: boolean
  autoRecovery?: boolean
}

export class WALTransactionManager extends TransactionManager {
  private walManager: IWALManager
  private storageAdapters = new Set<ITransactionalStorageAdapter<any>>()
  private options: Required<WALTransactionOptions>

  constructor(options: WALTransactionOptions = {}) {
    super()

    this.options = {
      timeout: options.timeout || 30000,
      isolationLevel: options.isolationLevel || 'SNAPSHOT_ISOLATION',
      walPath: options.walPath || './data/wal.log',
      enableWAL: options.enableWAL !== false, // Default to true
      autoRecovery: options.autoRecovery !== false // Default to true
    }

    this.walManager = new FileWALManager({
      walPath: this.options.walPath
    })

    // Auto-recovery on startup if enabled
    if (this.options.autoRecovery) {
      this.performRecovery().catch(error => {
        console.error('WAL recovery failed during initialization:', error)
      })
    }
  }

  override async beginTransaction(options: TransactionOptions = {}): Promise<string> {
    const transactionId = await super.beginTransaction(options)

    if (this.options.enableWAL) {
      // Write BEGIN to WAL
      await this.walManager.writeEntry({
        transactionId,
        sequenceNumber: 0, // Will be assigned by WAL manager
        timestamp: Date.now(),
        type: 'BEGIN',
        collectionName: '*',
        operation: 'BEGIN',
        data: { key: 'transaction', options },
        checksum: ''
      })
    }

    return transactionId
  }

  override async commitTransaction(transactionId: string): Promise<void> {
    const transaction = this.getTransactionSafe(transactionId)
    if (!transaction) {
      throw new Error(`Transaction ${transactionId} not found`)
    }

    try {
      // Phase 1: Prepare all resources (including storage adapters)
      const allResources = [
        ...Array.from(transaction.affectedResources),
        ...Array.from(this.storageAdapters)
      ]

      // Write PREPARE to WAL for each resource
      if (this.options.enableWAL) {
        for (const resource of allResources) {
          await this.walManager.writeEntry({
            transactionId,
            sequenceNumber: 0,
            timestamp: Date.now(),
            type: 'DATA',
            collectionName: this.getResourceName(resource),
            operation: 'STORE',
            data: { key: 'resource', resourceType: resource.constructor.name, phase: 'prepare' },
            checksum: ''
          })
        }
      }

      // Prepare all resources
      const prepareResults = await Promise.all(
        allResources.map(resource => resource.prepareCommit(transactionId))
      )

      if (!prepareResults.every(result => result)) {
        await this.rollbackTransaction(transactionId)
        throw new Error(`Transaction ${transactionId} failed to prepare`)
      }

      // Phase 2: Commit all resources
      await Promise.all(
        allResources.map(resource => resource.finalizeCommit(transactionId))
      )

      // Write final COMMIT to WAL
      if (this.options.enableWAL) {
        await this.walManager.writeEntry({
          transactionId,
          sequenceNumber: 0,
          timestamp: Date.now(),
          type: 'COMMIT',
          collectionName: '*',
          operation: 'COMMIT',
          data: {
            key: 'transaction',
            resourceCount: allResources.length,
            changeCount: transaction.changes.length
          },
          checksum: ''
        })

        await this.walManager.flush()
      }

      // Call parent commit to update transaction status
      await super.commitTransaction(transactionId)

    } catch (error) {
      await this.rollbackTransaction(transactionId)
      throw error
    }
  }

  override async rollbackTransaction(transactionId: string): Promise<void> {
    const transaction = this.getTransactionSafe(transactionId)
    if (!transaction) {
      throw new Error(`Transaction ${transactionId} not found`)
    }

    try {
      // Write ROLLBACK to WAL
      if (this.options.enableWAL) {
        await this.walManager.writeEntry({
          transactionId,
          sequenceNumber: 0,
          timestamp: Date.now(),
          type: 'ROLLBACK',
          collectionName: '*',
          operation: 'COMMIT',
          data: {
            key: 'transaction',
            reason: 'explicit_rollback'
          },
          checksum: ''
        })
      }

      // Rollback all resources (including storage adapters)
      const allResources = [
        ...Array.from(transaction.affectedResources),
        ...Array.from(this.storageAdapters)
      ]

      await Promise.all(
        allResources.map(resource => resource.rollback(transactionId))
      )

      // Call parent rollback to update transaction status
      await super.rollbackTransaction(transactionId)

    } catch (error) {
      console.error(`Error during rollback of transaction ${transactionId}:`, error)
      throw error
    }
  }

  /**
   * Register storage adapter to participate in transactions
   */
  registerStorageAdapter<T extends Item>(adapter: ITransactionalStorageAdapter<T>): void {
    this.storageAdapters.add(adapter)
  }

  /**
   * Unregister storage adapter
   */
  unregisterStorageAdapter<T extends Item>(adapter: ITransactionalStorageAdapter<T>): void {
    this.storageAdapters.delete(adapter)
  }

  /**
   * Write custom WAL entry
   */
  async writeWALEntry(entry: Omit<WALEntry, 'sequenceNumber' | 'checksum'>): Promise<void> {
    if (!this.options.enableWAL) {
      return
    }

    await this.walManager.writeEntry({
      ...entry,
      sequenceNumber: 0, // Will be assigned
      checksum: ''
    })
  }

  /**
   * Perform WAL recovery
   */
  async performRecovery(): Promise<void> {
    if (!this.options.enableWAL) {
      console.log('WAL is disabled, skipping recovery')
      return
    }

    console.log('Starting WAL-based transaction recovery...')

    try {
      await this.walManager.recover()
      console.log('WAL recovery completed successfully')
    } catch (error) {
      console.error('WAL recovery failed:', error)
      throw error
    }
  }

  /**
   * Create checkpoint and truncate old WAL entries
   */
  async createCheckpoint(): Promise<string> {
    if (!this.options.enableWAL) {
      throw new Error('WAL is disabled, cannot create checkpoint')
    }

    const checkpoint = await this.walManager.createCheckpoint()

    // Optionally truncate old entries (keep last 1000 for safety)
    const currentSequence = this.walManager.getCurrentSequence()
    if (currentSequence > 1000) {
      await this.walManager.truncate(currentSequence - 1000)
    }

    return checkpoint.checkpointId
  }

  /**
   * Get WAL entries for debugging/monitoring
   */
  async getWALEntries(fromSequence?: number): Promise<WALEntry[]> {
    if (!this.options.enableWAL) {
      return []
    }

    return this.walManager.readEntries(fromSequence)
  }

  /**
   * Get current WAL sequence number
   */
  getCurrentWALSequence(): number {
    if (!this.options.enableWAL) {
      return 0
    }

    return this.walManager.getCurrentSequence()
  }

  /**
   * Flush WAL to storage
   */
  async flushWAL(): Promise<void> {
    if (!this.options.enableWAL) {
      return
    }

    await this.walManager.flush()
  }

  /**
   * Get transaction by ID (override parent method)
   */
  override getTransaction(transactionId: string): CollectionStoreTransaction {
    return super.getTransaction(transactionId)
  }

  /**
   * Get transaction by ID safely (returns undefined if not found)
   */
  getTransactionSafe(transactionId: string): CollectionStoreTransaction | undefined {
    try {
      return this.getTransaction(transactionId)
    } catch {
      return undefined
    }
  }

  override async cleanup(): Promise<void> {
    // Close WAL manager
    if (this.walManager) {
      await this.walManager.close()
    }

    // Clear storage adapters
    this.storageAdapters.clear()

    // Call parent cleanup
    await super.cleanup()
  }

  /**
   * Get resource name for WAL logging
   */
  private getResourceName(resource: ITransactionResource): string {
    if ('collection' in resource && resource.collection) {
      return (resource.collection as any).name || 'unknown'
    }
    return resource.constructor.name
  }

  /**
   * Get registered storage adapters count
   */
  get storageAdapterCount(): number {
    return this.storageAdapters.size
  }

  /**
   * Check if WAL is enabled
   */
  get isWALEnabled(): boolean {
    return this.options.enableWAL
  }

  /**
   * Get active transaction IDs
   */
  override getActiveTransactionIds(): string[] {
    // Access parent's activeTransactionCount to get active transactions
    // This is a workaround since _activeTransactions is private
    const count = this.activeTransactionCount
    if (count === 0) {
      return []
    }

    // For now, return empty array since we can't access private _activeTransactions
    // In a real implementation, we'd need to modify the parent class
    return []
  }
}