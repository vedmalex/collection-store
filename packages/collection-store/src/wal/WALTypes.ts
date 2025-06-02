/**
 * WAL (Write-Ahead Logging) Types
 * Базовые типы для системы журналирования транзакций
 */

export interface WALEntry {
  transactionId: string
  sequenceNumber: number
  timestamp: number
  type: 'BEGIN' | 'PREPARE' | 'COMMIT' | 'ROLLBACK' | 'DATA'
  collectionName: string
  operation: 'INSERT' | 'UPDATE' | 'DELETE' | 'INDEX_CHANGE' | 'STORE' | 'BEGIN' | 'COMMIT'
  data: {
    key: any
    oldValue?: any
    newValue?: any
    indexName?: string
    checkpointId?: string
    [key: string]: any // Allow additional properties
  }
  checksum: string
}

export interface WALCheckpoint {
  checkpointId: string
  timestamp: number
  sequenceNumber: number
  transactionIds: string[]
}

export interface IWALManager {
  /**
   * Write entry to WAL
   */
  writeEntry(entry: WALEntry): Promise<void>

  /**
   * Read entries from WAL starting from sequence number
   */
  readEntries(fromSequence?: number): Promise<WALEntry[]>

  /**
   * Truncate WAL before specified sequence number
   */
  truncate(beforeSequence: number): Promise<void>

  /**
   * Flush pending writes to storage
   */
  flush(): Promise<void>

  /**
   * Recover from WAL after crash
   */
  recover(): Promise<void>

  /**
   * Create checkpoint
   */
  createCheckpoint(): Promise<WALCheckpoint>

  /**
   * Get current sequence number
   */
  getCurrentSequence(): number

  /**
   * Close WAL manager
   */
  close(): Promise<void>
}

export interface WALManagerOptions {
  walPath?: string
  flushInterval?: number
  maxBufferSize?: number
  enableCompression?: boolean
  enableChecksums?: boolean
}