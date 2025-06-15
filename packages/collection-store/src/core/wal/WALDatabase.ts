/**
 * WAL-Enhanced Database
 * Расширенная CSDatabase с интеграцией WAL транзакций
 */

import { CSDatabase } from '../Database'
import { WALCollection, WALCollectionConfig } from './WALCollection'
import { WALTransactionManager, WALTransactionOptions } from './WALTransactionManager'
import { Item } from '../../types/Item'
import { IDataCollection } from '../../types/IDataCollection'
import { IndexDef } from '../../types/IndexDef'
import path from 'path'

export interface WALDatabaseConfig {
  walOptions?: WALTransactionOptions
  enableTransactions?: boolean
  globalWAL?: boolean // Use single WAL for all collections
}

export class WALDatabase {
  private database: CSDatabase
  private walConfig: WALDatabaseConfig
  private globalWALManager?: WALTransactionManager
  private walCollections = new Map<string, WALCollection<any>>()

  constructor(root: string, name?: string, walConfig: WALDatabaseConfig = {}) {
    this.database = new CSDatabase(root, name)
    this.walConfig = {
      enableTransactions: true,
      globalWAL: false,
      ...walConfig
    }

    // Initialize global WAL if enabled
    if (this.walConfig.globalWAL && this.walConfig.enableTransactions) {
      this.initializeGlobalWAL(root, name)
    }
  }

  private initializeGlobalWAL(root: string, name?: string): void {
    const walPath = this.walConfig.walOptions?.walPath ||
                   path.join(root === ':memory:' ? './data' : root, `${name || 'default'}.wal`)

    this.globalWALManager = new WALTransactionManager({
      ...this.walConfig.walOptions,
      walPath
    })
  }

  /**
   * Create WAL-enhanced collection
   */
  async createCollection<T extends Item>(name: string): Promise<IDataCollection<T>> {
    if (!this.walConfig.enableTransactions) {
      // Fallback to regular collection
      return this.database.createCollection(name)
    }

    const [, collectionType = 'List'] = name.split(':')

    // Get database root and name through public methods
    const dbRoot = this.getRoot()
    const dbName = this.getName()

    const walCollectionConfig: WALCollectionConfig<T> = {
      name,
      list: collectionType === 'List' ? undefined : undefined, // Will use defaults
      root: dbRoot === ':memory:' ? ':memory:' : path.join(dbRoot, dbName),
      dbName: dbRoot === ':memory:' ? ':memory:' : undefined,
      enableTransactions: this.walConfig.enableTransactions,
      walOptions: {
        ...this.walConfig.walOptions,
        walPath: this.walConfig.globalWAL ?
          undefined : // Will use global WAL
          path.join(dbRoot === ':memory:' ? './data' : dbRoot, `${name}.wal`)
      }
    }

    const walCollection = WALCollection.create(walCollectionConfig)

    // Register with global WAL manager if using global WAL
    if (this.walConfig.globalWAL && this.globalWALManager) {
      const transactionManager = walCollection.getTransactionManager()
      if (transactionManager) {
        // Share the global WAL manager (this would require refactoring WALCollection)
        console.log('Global WAL sharing not yet implemented, using per-collection WAL')
      }
    }

    // Register the underlying collection with the database
    await this.database.createCollection(name)
    this.walCollections.set(name, walCollection)

    // Register collection's adapter with global transaction manager if available
    if (this.globalWALManager) {
      const adapter = walCollection.getCollection().storage
      if (adapter && 'prepareCommit' in adapter) {
        this.globalWALManager.registerStorageAdapter(adapter as any)
      }
    }

    return walCollection
  }

  /**
   * Get WAL-enhanced collection
   */
  collection<T extends Item>(name: string): IDataCollection<T> | undefined {
    // Try to get WAL collection first
    if (this.walCollections.has(name)) {
      return this.walCollections.get(name) as WALCollection<T>
    }

    // Fallback to regular collection
    return this.database.collection(name)
  }

  /**
   * Drop collection with WAL cleanup
   */
  async dropCollection(name: string): Promise<boolean> {
    // Clean up WAL collection if exists
    if (this.walCollections.has(name)) {
      const walCollection = this.walCollections.get(name)!
      await walCollection.reset()
      this.walCollections.delete(name)
    }

    return this.database.dropCollection(name)
  }

  /**
   * Begin global transaction across all collections
   */
  async beginGlobalTransaction(options?: WALTransactionOptions): Promise<string> {
    if (!this.walConfig.enableTransactions) {
      throw new Error('Transactions are not enabled for this database')
    }

    if (this.walConfig.globalWAL && this.globalWALManager) {
      return this.globalWALManager.beginTransaction(options)
    } else {
      // Create a shared transaction manager if we don't have one
      if (!this.globalWALManager) {
        this.initializeGlobalWAL(this.getRoot(), this.getName())
      }

      return this.globalWALManager!.beginTransaction(options)
    }
  }

  /**
   * Commit global transaction
   */
  async commitGlobalTransaction(transactionId: string): Promise<void> {
    if (this.walConfig.globalWAL && this.globalWALManager) {
      await this.globalWALManager.commitTransaction(transactionId)
    } else if (this.globalWALManager) {
      // Use the shared global manager
      await this.globalWALManager.commitTransaction(transactionId)
    } else {
      throw new Error('No global transaction manager available')
    }
  }

  /**
   * Rollback global transaction
   */
  async rollbackGlobalTransaction(transactionId: string): Promise<void> {
    if (this.walConfig.globalWAL && this.globalWALManager) {
      await this.globalWALManager.rollbackTransaction(transactionId)
    } else if (this.globalWALManager) {
      // Use the shared global manager
      await this.globalWALManager.rollbackTransaction(transactionId)
    } else {
      throw new Error('No global transaction manager available')
    }
  }

  /**
   * Persist all collections with transaction support
   */
  async persist(): Promise<any> {
    if (!this.walConfig.enableTransactions) {
      return this.database.persist()
    }

    // Use transactional persist for WAL collections
    const persistPromises: Promise<void>[] = []

    // Persist WAL collections
    for (const walCollection of this.walCollections.values()) {
      persistPromises.push(walCollection.persist())
    }

    // Persist regular collections through database
    await this.database.persist()

    return Promise.all(persistPromises)
  }

  /**
   * Perform WAL recovery for all collections
   */
  async performRecovery(): Promise<void> {
    if (!this.walConfig.enableTransactions) {
      console.log('Transactions not enabled, skipping WAL recovery')
      return
    }

    console.log('Starting WAL recovery for database...')

    if (this.walConfig.globalWAL && this.globalWALManager) {
      await this.globalWALManager.performRecovery()
    } else {
      // Recover each collection individually
      const recoveryPromises = Array.from(this.walCollections.values()).map(collection =>
        collection.performRecovery()
      )

      await Promise.all(recoveryPromises)
    }

    console.log('WAL recovery completed for database')
  }

  /**
   * Create checkpoint for all collections
   */
  async createGlobalCheckpoint(): Promise<string[]> {
    if (!this.walConfig.enableTransactions) {
      throw new Error('Transactions are not enabled for this database')
    }

    const checkpointIds: string[] = []

    if (this.walConfig.globalWAL && this.globalWALManager) {
      const checkpointId = await this.globalWALManager.createCheckpoint()
      checkpointIds.push(checkpointId)
    } else {
      // Create checkpoint for each collection
      for (const walCollection of this.walCollections.values()) {
        const checkpointId = await walCollection.createCheckpoint()
        checkpointIds.push(checkpointId)
      }
    }

    return checkpointIds
  }

  /**
   * Get WAL entries for debugging
   */
  async getWALEntries(collectionName?: string, fromSequence?: number): Promise<any[]> {
    if (!this.walConfig.enableTransactions) {
      return []
    }

    if (collectionName) {
      const walCollection = this.walCollections.get(collectionName)
      return walCollection ? walCollection.getWALEntries(fromSequence) : []
    }

    if (this.walConfig.globalWAL && this.globalWALManager) {
      return this.globalWALManager.getWALEntries(fromSequence)
    }

    // Aggregate entries from all collections
    const allEntries: any[] = []
    for (const walCollection of this.walCollections.values()) {
      const entries = await walCollection.getWALEntries(fromSequence)
      allEntries.push(...entries)
    }

    // Sort by sequence number
    return allEntries.sort((a, b) => a.sequenceNumber - b.sequenceNumber)
  }

  /**
   * Check if transactions are enabled
   */
  isTransactionsEnabled(): boolean {
    return this.walConfig.enableTransactions || false
  }

  /**
   * Get WAL configuration
   */
  getWALConfig(): WALDatabaseConfig {
    return { ...this.walConfig }
  }

  /**
   * Get global WAL manager
   */
  getGlobalWALManager(): WALTransactionManager | undefined {
    return this.globalWALManager
  }

  /**
   * List WAL collections
   */
  listWALCollections(): string[] {
    return Array.from(this.walCollections.keys())
  }

  /**
   * Cleanup WAL resources
   */
  async close(): Promise<void> {
    // Cleanup WAL collections
    for (const walCollection of this.walCollections.values()) {
      await walCollection.reset()
    }
    this.walCollections.clear()

    // Cleanup global WAL manager
    if (this.globalWALManager) {
      await this.globalWALManager.cleanup()
    }

    await this.database.close()
  }

  // Delegate common database methods
  async connect(): Promise<void> {
    return this.database.connect()
  }

  async load(): Promise<void> {
    return this.database.load()
  }

  listCollections(): Array<IDataCollection<any>> {
    return this.database.listCollections()
  }

  async createIndex(collection: string, name: string, def: IndexDef<any>): Promise<void> {
    return this.database.createIndex(collection, name, def)
  }

  async dropIndex(collection: string, name: string): Promise<void> {
    return this.database.dropIndex(collection, name)
  }

  // Helper methods to access database properties
  private getRoot(): string {
    // Access through reflection since root is private
    return (this.database as any).root || ':memory:'
  }

  private getName(): string {
    // Access through reflection since name is private
    return (this.database as any).name || 'default'
  }

  /**
   * Get underlying database
   */
  getDatabase(): CSDatabase {
    return this.database
  }
}