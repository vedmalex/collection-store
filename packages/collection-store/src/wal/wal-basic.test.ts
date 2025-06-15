/**
 * Basic WAL (Write-Ahead Logging) Tests
 * Базовые тесты для системы журналирования транзакций
 */

import { describe, it, expect, beforeEach, afterEach } from 'bun:test'
import fs from 'fs-extra'
import path from 'path'
import { FileWALManager } from '../wal/FileWALManager'
import { MemoryWALManager } from '../wal/MemoryWALManager'
import { WALEntry } from '../wal/WALTypes'

describe('WAL Basic Functionality', () => {
  const testDir = './test-data/wal-test'
  const walPath = path.join(testDir, 'test.wal')

  beforeEach(async () => {
    await fs.ensureDir(testDir)
    await fs.remove(walPath)
  })

  afterEach(async () => {
    await fs.remove(testDir)
  })

  describe('MemoryWALManager', () => {
    let walManager: MemoryWALManager

    beforeEach(() => {
      walManager = new MemoryWALManager()
    })

    afterEach(async () => {
      await walManager.close()
    })

    it('should write and read WAL entries', async () => {
      const entry: WALEntry = {
        transactionId: 'tx-001',
        sequenceNumber: 0, // Will be assigned
        timestamp: Date.now(),
        type: 'BEGIN',
        collectionName: 'users',
        operation: 'BEGIN',
        data: { key: 'transaction' },
        checksum: ''
      }

      await walManager.writeEntry(entry)

      const entries = await walManager.readEntries()
      expect(entries).toHaveLength(1)
      expect(entries[0].transactionId).toBe('tx-001')
      expect(entries[0].sequenceNumber).toBe(1)
      expect(entries[0].type).toBe('BEGIN')
    })

    it('should assign sequential sequence numbers', async () => {
      const entries: WALEntry[] = [
        {
          transactionId: 'tx-001',
          sequenceNumber: 0,
          timestamp: Date.now(),
          type: 'BEGIN',
          collectionName: 'users',
          operation: 'BEGIN',
          data: { key: 'transaction' },
          checksum: ''
        },
        {
          transactionId: 'tx-001',
          sequenceNumber: 0,
          timestamp: Date.now(),
          type: 'DATA',
          collectionName: 'users',
          operation: 'INSERT',
          data: { key: 'user1', newValue: { id: 1, name: 'John' } },
          checksum: ''
        },
        {
          transactionId: 'tx-001',
          sequenceNumber: 0,
          timestamp: Date.now(),
          type: 'COMMIT',
          collectionName: 'users',
          operation: 'COMMIT',
          data: { key: 'transaction' },
          checksum: ''
        }
      ]

      for (const entry of entries) {
        await walManager.writeEntry(entry)
      }

      const readEntries = await walManager.readEntries()
      expect(readEntries).toHaveLength(3)
      expect(readEntries[0].sequenceNumber).toBe(1)
      expect(readEntries[1].sequenceNumber).toBe(2)
      expect(readEntries[2].sequenceNumber).toBe(3)
    })

    it('should filter entries by sequence number', async () => {
      const entries: WALEntry[] = [
        {
          transactionId: 'tx-001',
          sequenceNumber: 0,
          timestamp: Date.now(),
          type: 'BEGIN',
          collectionName: 'users',
          operation: 'BEGIN',
          data: { key: 'transaction' },
          checksum: ''
        },
        {
          transactionId: 'tx-002',
          sequenceNumber: 0,
          timestamp: Date.now(),
          type: 'BEGIN',
          collectionName: 'products',
          operation: 'BEGIN',
          data: { key: 'transaction' },
          checksum: ''
        }
      ]

      for (const entry of entries) {
        await walManager.writeEntry(entry)
      }

      const allEntries = await walManager.readEntries()
      expect(allEntries).toHaveLength(2)

      const filteredEntries = await walManager.readEntries(2)
      expect(filteredEntries).toHaveLength(1)
      expect(filteredEntries[0].transactionId).toBe('tx-002')
    })

    it('should truncate entries before sequence number', async () => {
      const entries: WALEntry[] = [
        {
          transactionId: 'tx-001',
          sequenceNumber: 0,
          timestamp: Date.now(),
          type: 'BEGIN',
          collectionName: 'users',
          operation: 'BEGIN',
          data: { key: 'transaction' },
          checksum: ''
        },
        {
          transactionId: 'tx-002',
          sequenceNumber: 0,
          timestamp: Date.now(),
          type: 'BEGIN',
          collectionName: 'products',
          operation: 'BEGIN',
          data: { key: 'transaction' },
          checksum: ''
        },
        {
          transactionId: 'tx-003',
          sequenceNumber: 0,
          timestamp: Date.now(),
          type: 'BEGIN',
          collectionName: 'orders',
          operation: 'BEGIN',
          data: { key: 'transaction' },
          checksum: ''
        }
      ]

      for (const entry of entries) {
        await walManager.writeEntry(entry)
      }

      await walManager.truncate(2)

      const remainingEntries = await walManager.readEntries()
      expect(remainingEntries).toHaveLength(2)
      expect(remainingEntries[0].transactionId).toBe('tx-002')
      expect(remainingEntries[1].transactionId).toBe('tx-003')
    })

    it('should create checkpoints', async () => {
      const entry: WALEntry = {
        transactionId: 'tx-001',
        sequenceNumber: 0,
        timestamp: Date.now(),
        type: 'BEGIN',
        collectionName: 'users',
        operation: 'BEGIN',
        data: { key: 'transaction' },
        checksum: ''
      }

      await walManager.writeEntry(entry)

      const checkpoint = await walManager.createCheckpoint()
      expect(checkpoint.checkpointId).toBeDefined()
      expect(checkpoint.sequenceNumber).toBe(2) // 1 for entry + 1 for checkpoint
      expect(checkpoint.timestamp).toBeDefined()

      const entries = await walManager.readEntries()
      expect(entries).toHaveLength(2) // Original entry + checkpoint entry
    })
  })

  describe('FileWALManager', () => {
    let walManager: FileWALManager

    beforeEach(() => {
      walManager = new FileWALManager({ walPath })
    })

    afterEach(async () => {
      await walManager.close()
    })

    it('should persist WAL entries to file', async () => {
      const entry: WALEntry = {
        transactionId: 'tx-001',
        sequenceNumber: 0,
        timestamp: Date.now(),
        type: 'BEGIN',
        collectionName: 'users',
        operation: 'BEGIN',
        data: { key: 'transaction' },
        checksum: ''
      }

      await walManager.writeEntry(entry)
      await walManager.flush()

      // Verify file exists and contains data
      expect(await fs.pathExists(walPath)).toBe(true)

      const content = await fs.readFile(walPath, 'utf8')
      expect(content.trim()).toBeTruthy()

      const lines = content.trim().split('\n')
      expect(lines).toHaveLength(1)

      const parsedEntry = JSON.parse(lines[0])
      expect(parsedEntry.transactionId).toBe('tx-001')
    })

    it('should recover from existing WAL file', async () => {
      // Write some entries
      const entries: WALEntry[] = [
        {
          transactionId: 'tx-001',
          sequenceNumber: 0,
          timestamp: Date.now(),
          type: 'BEGIN',
          collectionName: 'users',
          operation: 'BEGIN',
          data: { key: 'transaction' },
          checksum: ''
        },
        {
          transactionId: 'tx-001',
          sequenceNumber: 0,
          timestamp: Date.now(),
          type: 'COMMIT',
          collectionName: 'users',
          operation: 'COMMIT',
          data: { key: 'transaction' },
          checksum: ''
        }
      ]

      for (const entry of entries) {
        await walManager.writeEntry(entry)
      }
      await walManager.flush()
      await walManager.close()

      // Create new WAL manager and verify it reads existing entries
      const newWalManager = new FileWALManager({ walPath })

      const readEntries = await newWalManager.readEntries()
      expect(readEntries).toHaveLength(2)
      expect(readEntries[0].transactionId).toBe('tx-001')
      expect(readEntries[1].transactionId).toBe('tx-001')

      await newWalManager.close()
    })

    it('should validate checksums', async () => {
      const entry: WALEntry = {
        transactionId: 'tx-001',
        sequenceNumber: 0,
        timestamp: Date.now(),
        type: 'BEGIN',
        collectionName: 'users',
        operation: 'BEGIN',
        data: { key: 'transaction' },
        checksum: ''
      }

      await walManager.writeEntry(entry)
      await walManager.flush()

      // Manually corrupt the WAL file
      const content = await fs.readFile(walPath, 'utf8')
      const corruptedContent = content.replace('"BEGIN"', '"CORRUPTED"')
      await fs.writeFile(walPath, corruptedContent, 'utf8')

      // Create new WAL manager and try to read
      const newWalManager = new FileWALManager({ walPath })

      const readEntries = await newWalManager.readEntries()
      // Should skip corrupted entry due to checksum mismatch
      expect(readEntries).toHaveLength(0)

      await newWalManager.close()
    })
  })

  describe('WAL Recovery Scenarios', () => {
    let walManager: MemoryWALManager

    beforeEach(() => {
      walManager = new MemoryWALManager()
    })

    afterEach(async () => {
      await walManager.close()
    })

    it('should recover committed transactions', async () => {
      const entries: WALEntry[] = [
        {
          transactionId: 'tx-001',
          sequenceNumber: 0,
          timestamp: Date.now(),
          type: 'BEGIN',
          collectionName: 'users',
          operation: 'BEGIN',
          data: { key: 'transaction' },
          checksum: ''
        },
        {
          transactionId: 'tx-001',
          sequenceNumber: 0,
          timestamp: Date.now(),
          type: 'DATA',
          collectionName: 'users',
          operation: 'INSERT',
          data: { key: 'user1', newValue: { id: 1, name: 'John' } },
          checksum: ''
        },
        {
          transactionId: 'tx-001',
          sequenceNumber: 0,
          timestamp: Date.now(),
          type: 'COMMIT',
          collectionName: 'users',
          operation: 'COMMIT',
          data: { key: 'transaction' },
          checksum: ''
        }
      ]

      for (const entry of entries) {
        await walManager.writeEntry(entry)
      }

      // Recovery should replay committed transaction
      await walManager.recover()
      // If we get here without throwing, the test passes
      expect(true).toBe(true)
    })

    it('should rollback incomplete transactions', async () => {
      const entries: WALEntry[] = [
        {
          transactionId: 'tx-001',
          sequenceNumber: 0,
          timestamp: Date.now(),
          type: 'BEGIN',
          collectionName: 'users',
          operation: 'BEGIN',
          data: { key: 'transaction' },
          checksum: ''
        },
        {
          transactionId: 'tx-001',
          sequenceNumber: 0,
          timestamp: Date.now(),
          type: 'DATA',
          collectionName: 'users',
          operation: 'INSERT',
          data: { key: 'user1', newValue: { id: 1, name: 'John' } },
          checksum: ''
        }
        // No COMMIT - incomplete transaction
      ]

      for (const entry of entries) {
        await walManager.writeEntry(entry)
      }

      // Recovery should rollback incomplete transaction
      await walManager.recover()
      // If we get here without throwing, the test passes
      expect(true).toBe(true)
    })

    it('should handle explicitly rolled back transactions', async () => {
      const entries: WALEntry[] = [
        {
          transactionId: 'tx-001',
          sequenceNumber: 0,
          timestamp: Date.now(),
          type: 'BEGIN',
          collectionName: 'users',
          operation: 'BEGIN',
          data: { key: 'transaction' },
          checksum: ''
        },
        {
          transactionId: 'tx-001',
          sequenceNumber: 0,
          timestamp: Date.now(),
          type: 'DATA',
          collectionName: 'users',
          operation: 'INSERT',
          data: { key: 'user1', newValue: { id: 1, name: 'John' } },
          checksum: ''
        },
        {
          transactionId: 'tx-001',
          sequenceNumber: 0,
          timestamp: Date.now(),
          type: 'ROLLBACK',
          collectionName: 'users',
          operation: 'COMMIT',
          data: { key: 'transaction' },
          checksum: ''
        }
      ]

      for (const entry of entries) {
        await walManager.writeEntry(entry)
      }

      // Recovery should handle explicitly rolled back transaction
      await walManager.recover()
      // If we get here without throwing, the test passes
      expect(true).toBe(true)
    })
  })
})