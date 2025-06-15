/**
 * Transactional File Storage Adapter
 * Транзакционная реализация файлового адаптера с поддержкой WAL
 */

import pathLib from 'path'
import fs from 'fs-extra'
import crypto from 'crypto'
import { Item } from '../../types/Item'
import { ITransactionalStorageAdapter } from '../../types/ITransactionalStorageAdapter'
import { StoredData } from '../../types/StoredData'
import Collection from '../../core/Collection'
import { WALEntry, IWALManager } from '../../wal/WALTypes'
import { FileWALManager } from '../../wal/FileWALManager'

export default class TransactionalAdapterFile<T extends Item>
  implements ITransactionalStorageAdapter<T> {

  private walManager: IWALManager
  private transactionData = new Map<string, any>() // Use any for collection.store() return type
  private checkpoints = new Map<string, string>() // checkpointId -> file path

  collection!: Collection<T>

  constructor(walPath?: string) {
    this.walManager = new FileWALManager({
      walPath: walPath || './data/wal.log'
    })
  }

  get name() {
    return 'AdapterFile' as const
  }

  get file(): string {
    if (this.collection.list.singlefile) {
      return pathLib.join(this.collection.root, `${this.collection.name}.json`)
    }
    return pathLib.join(this.collection.root, this.collection.name, 'metadata.json')
  }

  clone() {
    return new TransactionalAdapterFile<T>()
  }

  init(collection: Collection<T>) {
    this.collection = collection
    return this
  }

  isTransactional(): boolean {
    return true
  }

  // Legacy IStorageAdapter methods
  async restore(name?: string) {
    let path = this.file
    if (name) {
      const p = { ...pathLib.parse(this.file) } as Partial<pathLib.ParsedPath>
      p.name = name
      delete p.base
      path = pathLib.format(p)
    }
    if (fs.pathExistsSync(path)) {
      return fs.readJSON(path)
    }
    return false
  }

  async store(name?: string) {
    let path = this.file
    if (name) {
      const p = { ...pathLib.parse(this.file) } as Partial<pathLib.ParsedPath>
      p.name = name
      delete p.base
      path = pathLib.format(p)
    }
    await fs.ensureFile(path)

    await fs.writeJSON(path, this.collection.store(), {
      spaces: 2,
    })
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

    // Prepare data for commit (store in memory for now)
    const data = this.collection.store()
    this.transactionData.set(transactionId, data)
  }

  async restore_in_transaction(transactionId: string, name?: string): Promise<StoredData<T>> {
    // Check if we have prepared data for this transaction
    const preparedData = this.transactionData.get(transactionId)
    if (preparedData) {
      return preparedData as StoredData<T>
    }

    // Otherwise, restore from file
    return this.restore(name) as Promise<StoredData<T>>
  }

  // ITransactionResource implementation
  async prepareCommit(transactionId: string): Promise<boolean> {
    try {
      // Check if we have data to commit
      const data = this.transactionData.get(transactionId)
      if (!data) {
        // No data to commit, but that's OK
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
      console.error(`Failed to prepare storage adapter for transaction ${transactionId}:`, error)
      return false
    }
  }

  async finalizeCommit(transactionId: string): Promise<void> {
    const data = this.transactionData.get(transactionId)
    if (!data) {
      // No data to commit, write COMMIT to WAL anyway
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
      return
    }

    try {
      // Write actual data to file
      await this.writeDataToFile(data)

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

      // Clean up transaction data
      this.transactionData.delete(transactionId)
    } catch (error) {
      throw new Error(`Failed to commit storage for transaction ${transactionId}: ${error}`)
    }
  }

  async rollback(transactionId: string): Promise<void> {
    // Write ROLLBACK to WAL
    await this.walManager.writeEntry({
      transactionId,
      sequenceNumber: 0,
      timestamp: Date.now(),
      type: 'ROLLBACK',
      collectionName: this.collection.name,
      operation: 'STORE',
      data: { key: 'metadata' },
      checksum: ''
    })

    // Clean up prepared data
    this.transactionData.delete(transactionId)
  }

  // Checkpoint operations
  async createCheckpoint(transactionId: string): Promise<string> {
    const checkpointId = crypto.randomUUID()
    const checkpointPath = pathLib.join(
      pathLib.dirname(this.file),
      `checkpoint_${checkpointId}.json`
    )

    // Save current state to checkpoint file
    const currentData = this.collection.store()
    await fs.ensureFile(checkpointPath)
    await fs.writeJSON(checkpointPath, currentData, { spaces: 2 })

    this.checkpoints.set(checkpointId, checkpointPath)

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
    const checkpointPath = this.checkpoints.get(checkpointId)
    if (!checkpointPath) {
      throw new Error(`Checkpoint ${checkpointId} not found`)
    }

    if (!(await fs.pathExists(checkpointPath))) {
      throw new Error(`Checkpoint file ${checkpointPath} does not exist`)
    }

    // Restore data from checkpoint
    const checkpointData = await fs.readJSON(checkpointPath)

    // Write restored data to main file
    await this.writeDataToFile(checkpointData)
  }

  private async writeDataToFile(data: any): Promise<void> {
    await fs.ensureFile(this.file)
    await fs.writeJSON(this.file, data, { spaces: 2 })
  }

  // Cleanup
  async close(): Promise<void> {
    await this.walManager.close()

    // Clean up checkpoint files
    for (const checkpointPath of this.checkpoints.values()) {
      try {
        await fs.remove(checkpointPath)
      } catch (error) {
        console.warn(`Failed to remove checkpoint file ${checkpointPath}:`, error)
      }
    }
    this.checkpoints.clear()
  }
}