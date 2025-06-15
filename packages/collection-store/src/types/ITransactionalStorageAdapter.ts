/**
 * Transactional Storage Adapter Interface
 * Расширенный интерфейс для адаптеров хранения с поддержкой транзакций
 */

import { IStorageAdapter } from './IStorageAdapter'
import { ITransactionResource } from '../transactions/TransactionManager'
import { StoredData } from './StoredData'
import { Item } from './Item'
import { WALEntry } from '../wal/WALTypes'

export interface ITransactionalStorageAdapter<T extends Item>
  extends IStorageAdapter<T>, ITransactionResource {

  /**
   * Write WAL entry to storage
   */
  writeWALEntry(entry: WALEntry): Promise<void>

  /**
   * Read WAL entries from storage
   */
  readWALEntries(fromSequence?: number): Promise<WALEntry[]>

  /**
   * Store data within transaction context
   */
  store_in_transaction(transactionId: string, name?: string): Promise<void>

  /**
   * Restore data within transaction context
   */
  restore_in_transaction(transactionId: string, name?: string): Promise<StoredData<T>>

  /**
   * Create checkpoint for recovery
   */
  createCheckpoint(transactionId: string): Promise<string>

  /**
   * Restore from checkpoint
   */
  restoreFromCheckpoint(checkpointId: string): Promise<void>

  /**
   * Check if adapter supports transactions
   */
  isTransactional(): boolean
}