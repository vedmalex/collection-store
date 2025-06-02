/**
 * WAL-Enhanced Collection
 * Расширенная Collection с интеграцией WAL транзакций
 */

import Collection from './collection'
import { Item } from './types/Item'
import { ICollectionConfig } from './ICollectionConfig'
import { WALTransactionManager, WALTransactionOptions } from './WALTransactionManager'
import { ITransactionalStorageAdapter } from './ITransactionalStorageAdapter'
import TransactionalAdapterFile from './TransactionalAdapterFile'
import TransactionalAdapterMemory from './TransactionalAdapterMemory'
import { IStorageAdapter } from './IStorageAdapter'
import { TraverseCondition } from './types/TraverseCondition'
import { ValueType } from 'b-pl-tree'
import { Paths } from './types/Paths'
import { IndexDef } from './types/IndexDef'

export interface WALCollectionConfig<T extends Item> extends ICollectionConfig<T> {
  walOptions?: WALTransactionOptions
  enableTransactions?: boolean
}

export class WALCollection<T extends Item> {
  // Delegate to internal collection
  private collection: Collection<T>
  private walTransactionManager?: WALTransactionManager
  private transactionalAdapter?: ITransactionalStorageAdapter<T>
  private walOptions: WALTransactionOptions
  private enableTransactions: boolean
  private currentTransactionId?: string // Track current transaction

  private constructor(collection: Collection<T>) {
    this.collection = collection
  }

  static create<T extends Item>(config: WALCollectionConfig<T>): WALCollection<T> {
    // Extract WAL-specific options
    const {
      walOptions = {},
      enableTransactions = true,
      ...baseConfig
    } = config

    // Create base collection
    const baseCollection = Collection.create(baseConfig)
    const walCollection = new WALCollection(baseCollection)

    // Set WAL-specific properties
    walCollection.walOptions = walOptions
    walCollection.enableTransactions = enableTransactions

    // Initialize WAL components if transactions are enabled
    if (enableTransactions) {
      walCollection.initializeWAL()
    }

    return walCollection
  }

  private initializeWAL(): void {
    // Create WAL Transaction Manager
    this.walTransactionManager = new WALTransactionManager({
      ...this.walOptions,
      walPath: this.walOptions.walPath || `${this.collection.root}/${this.collection.name}.wal`
    })

    // Convert storage adapter to transactional if needed
    this.convertToTransactionalAdapter()

    // Register adapter with transaction manager
    if (this.transactionalAdapter) {
      this.walTransactionManager.registerStorageAdapter(this.transactionalAdapter)
    }
  }

  private convertToTransactionalAdapter(): void {
    if (!this.collection.storage) {
      return
    }

    // Check if adapter is already transactional
    if (this.isTransactionalAdapter(this.collection.storage)) {
      this.transactionalAdapter = this.collection.storage as ITransactionalStorageAdapter<T>
      return
    }

    // Convert to transactional adapter based on type
    if (this.collection.storage.name === 'AdapterFile') {
      const walPath = this.walOptions.walPath || `${this.collection.root}/${this.collection.name}.wal`
      this.transactionalAdapter = new TransactionalAdapterFile<T>(walPath)
      this.transactionalAdapter.init(this.collection)
      this.collection.storage = this.transactionalAdapter
    } else if (this.collection.storage.name === 'AdapterMemory') {
      this.transactionalAdapter = new TransactionalAdapterMemory<T>()
      this.transactionalAdapter.init(this.collection)
      this.collection.storage = this.transactionalAdapter
    } else {
      console.warn(`Unknown adapter type: ${this.collection.storage.name}. Transactions may not work properly.`)
    }
  }

  private isTransactionalAdapter(adapter: IStorageAdapter<T>): boolean {
    return 'prepareCommit' in adapter &&
           'finalizeCommit' in adapter &&
           'rollback' in adapter &&
           'writeWALEntry' in adapter
  }

  /**
   * Enhanced persist method with transaction support
   */
  async persist(name?: string): Promise<void> {
    if (!this.enableTransactions || !this.walTransactionManager) {
      // Fallback to regular persist
      return this.collection.persist(name)
    }

    // Check if we're in a transaction
    const currentTxId = this.getCurrentTransactionId()

    if (currentTxId) {
      // We're in a transaction - use transactional persist
      await this.persistInTransaction(currentTxId, name)
    } else {
      // Not in transaction - create implicit transaction
      await this.persistWithImplicitTransaction(name)
    }
  }

  private async persistInTransaction(transactionId: string, name?: string): Promise<void> {
    if (!this.transactionalAdapter) {
      throw new Error('Transactional adapter not available')
    }

    // Store data in transaction context
    await this.transactionalAdapter.store_in_transaction(transactionId, name)
  }

  private async persistWithImplicitTransaction(name?: string): Promise<void> {
    if (!this.walTransactionManager) {
      throw new Error('WAL Transaction Manager not available')
    }

    // Create implicit transaction for persist operation
    const txId = await this.walTransactionManager.beginTransaction({
      timeout: 10000, // 10 seconds for persist operation
      isolationLevel: 'SNAPSHOT_ISOLATION'
    })

    try {
      await this.persistInTransaction(txId, name)
      await this.walTransactionManager.commitTransaction(txId)
    } catch (error) {
      await this.walTransactionManager.rollbackTransaction(txId)
      throw error
    }
  }

  /**
   * Begin transaction for this collection
   */
  async beginTransaction(options?: WALTransactionOptions): Promise<string> {
    if (!this.enableTransactions || !this.walTransactionManager) {
      throw new Error('Transactions are not enabled for this collection')
    }

    const txId = await this.walTransactionManager.beginTransaction(options)
    this.currentTransactionId = txId
    return txId
  }

  /**
   * Commit transaction
   */
  async commitTransaction(transactionId: string): Promise<void> {
    if (!this.walTransactionManager) {
      throw new Error('WAL Transaction Manager not available')
    }

    await this.walTransactionManager.commitTransaction(transactionId)

    // Clear current transaction if it matches
    if (this.currentTransactionId === transactionId) {
      this.currentTransactionId = undefined
    }
  }

  /**
   * Rollback transaction
   */
  async rollbackTransaction(transactionId: string): Promise<void> {
    if (!this.walTransactionManager) {
      throw new Error('WAL Transaction Manager not available')
    }

    await this.walTransactionManager.rollbackTransaction(transactionId)

    // Clear current transaction if it matches
    if (this.currentTransactionId === transactionId) {
      this.currentTransactionId = undefined
    }
  }

  /**
   * Get current transaction ID
   */
  getCurrentTransactionId(): string | undefined {
    return this.currentTransactionId
  }

  /**
   * Enhanced create method with transaction awareness
   */
  async create(item: T): Promise<T | undefined> {
    const result = await this.collection.create(item)

    // If we're in a transaction and have a transactional adapter, log the operation
    const txId = this.getCurrentTransactionId()
    if (txId && this.walTransactionManager && result) {
      await this.walTransactionManager.writeWALEntry({
        transactionId: txId,
        timestamp: Date.now(),
        type: 'DATA',
        collectionName: this.collection.name,
        operation: 'INSERT',
        data: {
          key: result[this.collection.id],
          newValue: result
        }
      })
    }

    return result
  }

  /**
   * Enhanced update method with transaction awareness
   */
  async updateWithId(
    id: ValueType,
    update: Partial<T>,
    merge: boolean = true
  ): Promise<T | undefined> {
    const oldItem = await this.collection.findById(id)
    const result = await this.collection.updateWithId(id, update, merge)

    // Log update operation if in transaction
    const txId = this.getCurrentTransactionId()
    if (txId && this.walTransactionManager && result) {
      await this.walTransactionManager.writeWALEntry({
        transactionId: txId,
        timestamp: Date.now(),
        type: 'DATA',
        collectionName: this.collection.name,
        operation: 'UPDATE',
        data: {
          key: id,
          oldValue: oldItem,
          newValue: result
        }
      })
    }

    return result
  }

  /**
   * Enhanced remove method with transaction awareness
   */
  async removeWithId(id: ValueType): Promise<T | undefined> {
    const oldItem = await this.collection.findById(id)
    const result = await this.collection.removeWithId(id)

    // Log delete operation if in transaction
    const txId = this.getCurrentTransactionId()
    if (txId && this.walTransactionManager && result) {
      await this.walTransactionManager.writeWALEntry({
        transactionId: txId,
        timestamp: Date.now(),
        type: 'DATA',
        collectionName: this.collection.name,
        operation: 'DELETE',
        data: {
          key: id,
          oldValue: oldItem
        }
      })
    }

    return result
  }

  /**
   * Create checkpoint for current state
   */
  async createCheckpoint(): Promise<string> {
    if (!this.walTransactionManager) {
      throw new Error('WAL Transaction Manager not available')
    }

    return this.walTransactionManager.createCheckpoint()
  }

  /**
   * Perform WAL recovery
   */
  async performRecovery(): Promise<void> {
    if (!this.walTransactionManager) {
      throw new Error('WAL Transaction Manager not available')
    }

    await this.walTransactionManager.performRecovery()
  }

  /**
   * Get WAL entries for debugging
   */
  async getWALEntries(fromSequence?: number): Promise<any[]> {
    if (!this.walTransactionManager) {
      return []
    }

    return this.walTransactionManager.getWALEntries(fromSequence)
  }

  /**
   * Check if transactions are enabled
   */
  isTransactionsEnabled(): boolean {
    return this.enableTransactions && !!this.walTransactionManager
  }

  /**
   * Get transaction manager
   */
  getTransactionManager(): WALTransactionManager | undefined {
    return this.walTransactionManager
  }

  /**
   * Get underlying collection
   */
  getCollection(): Collection<T> {
    return this.collection
  }

  /**
   * Cleanup WAL resources
   */
  async reset(): Promise<void> {
    if (this.walTransactionManager) {
      await this.walTransactionManager.cleanup()
    }

    await this.collection.reset()
  }

  // Delegate common collection methods
  get name(): string { return this.collection.name }
  get id(): string { return this.collection.id }
  get root(): string { return this.collection.root }
  get ttl(): number | undefined { return this.collection.ttl }
  get config() { return this.collection.config }

  async findById(id: ValueType): Promise<T | undefined> {
    return this.collection.findById(id)
  }

  async findBy(key: Paths<T>, id: ValueType): Promise<Array<T>> {
    return this.collection.findBy(key, id)
  }

  async findFirstBy(key: Paths<T>, id: ValueType): Promise<T | undefined> {
    return this.collection.findFirstBy(key, id)
  }

  async findLastBy(key: Paths<T>, id: ValueType): Promise<T | undefined> {
    return this.collection.findLastBy(key, id)
  }

  async find(condition: TraverseCondition<T>): Promise<Array<T>> {
    return this.collection.find(condition)
  }

  async findFirst(condition: TraverseCondition<T>): Promise<T | undefined> {
    return this.collection.findFirst(condition)
  }

  async findLast(condition: TraverseCondition<T>): Promise<T | undefined> {
    return this.collection.findLast(condition)
  }

  async first(): Promise<T> {
    return this.collection.first()
  }

  async last(): Promise<T> {
    return this.collection.last()
  }

  async oldest(): Promise<T | undefined> {
    return this.collection.oldest()
  }

  async latest(): Promise<T | undefined> {
    return this.collection.latest()
  }

  async lowest(key: Paths<T>): Promise<T | undefined> {
    return this.collection.lowest(key)
  }

  async greatest(key: Paths<T>): Promise<T | undefined> {
    return this.collection.greatest(key)
  }

  async push(item: T): Promise<T | undefined> {
    const result = await this.collection.push(item)

    // Log push operation if in transaction
    const txId = this.getCurrentTransactionId()
    if (txId && this.walTransactionManager && result) {
      await this.walTransactionManager.writeWALEntry({
        transactionId: txId,
        timestamp: Date.now(),
        type: 'DATA',
        collectionName: this.collection.name,
        operation: 'INSERT',
        data: {
          key: result[this.collection.id],
          newValue: result
        }
      })
    }

    return result
  }

  async save(item: T): Promise<T | undefined> {
    const oldItem = await this.collection.findById(item[this.collection.id])
    const result = await this.collection.save(item)

    // Log save operation if in transaction
    const txId = this.getCurrentTransactionId()
    if (txId && this.walTransactionManager && result) {
      await this.walTransactionManager.writeWALEntry({
        transactionId: txId,
        timestamp: Date.now(),
        type: 'DATA',
        collectionName: this.collection.name,
        operation: 'UPDATE',
        data: {
          key: result[this.collection.id],
          oldValue: oldItem,
          newValue: result
        }
      })
    }

    return result
  }

  async update(
    condition: TraverseCondition<T>,
    update: Partial<T>,
    merge: boolean = true
  ): Promise<Array<T>> {
    return this.collection.update(condition, update, merge)
  }

  async updateFirst(
    condition: TraverseCondition<T>,
    update: Partial<T>,
    merge: boolean = true
  ): Promise<T | undefined> {
    return this.collection.updateFirst(condition, update, merge)
  }

  async updateLast(
    condition: TraverseCondition<T>,
    update: Partial<T>,
    merge: boolean = true
  ): Promise<T | undefined> {
    return this.collection.updateLast(condition, update, merge)
  }

  async remove(condition: TraverseCondition<T>): Promise<Array<T | undefined>> {
    return this.collection.remove(condition)
  }

  async removeFirst(condition: TraverseCondition<T>): Promise<T | undefined> {
    return this.collection.removeFirst(condition)
  }

  async removeLast(condition: TraverseCondition<T>): Promise<T | undefined> {
    return this.collection.removeLast(condition)
  }

  listIndexes(name: string): Array<{ name: string; key: { [key: string]: any } }> {
    return this.collection.listIndexes(name)
  }

  dropIndex(name: string): any {
    return this.collection.dropIndex(name)
  }

  async load(name?: string): Promise<void> {
    return this.collection.load(name)
  }

  async createIndex(name: string, config: IndexDef<T>): Promise<void> {
    return this.collection.createIndex(name, config)
  }
}