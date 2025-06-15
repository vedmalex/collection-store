/**
 * Integration tests for CSDatabase transaction functionality
 * Tests the integration between CSDatabase and TransactionManager
 */

import { describe, it, expect, beforeEach, afterEach } from 'bun:test'
import { CSDatabase } from '../../core/Database'
import { ChangeRecord } from '../TransactionManager'
import fs from 'node:fs'
import path from 'node:path'

describe('CSDatabase Transaction Integration', () => {
  let database: CSDatabase
  let testRoot: string

  beforeEach(async () => {
    testRoot = path.join(process.cwd(), 'test-data', `db-${Date.now()}`)
    database = new CSDatabase(testRoot, 'test-db')
    await database.connect()
  })

  afterEach(async () => {
    await database.close()
    // Cleanup test directory
    if (fs.existsSync(testRoot)) {
      fs.rmSync(testRoot, { recursive: true, force: true })
    }
  })

  describe('Basic Transaction Lifecycle', () => {
    it('should start and commit transaction', async () => {
      expect(database.getCurrentTransactionId()).toBeUndefined()
      expect(database.activeTransactionCount).toBe(0)

      await database.startTransaction()

      expect(database.getCurrentTransactionId()).toBeDefined()
      expect(database.activeTransactionCount).toBe(1)

      await database.commitTransaction()

      expect(database.getCurrentTransactionId()).toBeUndefined()
      expect(database.activeTransactionCount).toBe(0)
    })

    it('should start and abort transaction', async () => {
      await database.startTransaction()

      const txId = database.getCurrentTransactionId()
      expect(txId).toBeDefined()

      await database.abortTransaction()

      expect(database.getCurrentTransactionId()).toBeUndefined()
      expect(database.activeTransactionCount).toBe(0)
    })

    it('should handle session lifecycle', async () => {
      const session = await database.startSession()
      expect(session).toBe(database)

      await session.startTransaction()
      expect(database.getCurrentTransactionId()).toBeDefined()

      await session.endSession()
      expect(database.getCurrentTransactionId()).toBeUndefined()
    })
  })

  describe('Transaction State Management', () => {
    it('should prevent starting multiple transactions', async () => {
      await database.startTransaction()

      await expect(database.startTransaction()).rejects.toThrow(
        'Transaction already active'
      )
    })

    it('should prevent commit without active transaction', async () => {
      await expect(database.commitTransaction()).rejects.toThrow(
        'No active transaction to commit'
      )
    })

    it('should prevent abort without active transaction', async () => {
      await expect(database.abortTransaction()).rejects.toThrow(
        'No active transaction to abort'
      )
    })

    it('should get current transaction details', async () => {
      await database.startTransaction({ timeout: 5000 })

      const transaction = database.getCurrentTransaction()
      expect(transaction).toBeDefined()
      expect(transaction!.status).toBe('ACTIVE')
      expect(transaction!.options.timeout).toBe(5000)
    })
  })

  describe('Transaction Options', () => {
    it('should accept transaction options', async () => {
      await database.startTransaction({
        timeout: 10000,
        isolationLevel: 'READ_COMMITTED'
      })

      const transaction = database.getCurrentTransaction()
      expect(transaction!.options.timeout).toBe(10000)
      expect(transaction!.options.isolationLevel).toBe('READ_COMMITTED')
    })

    it('should use default options', async () => {
      await database.startTransaction()

      const transaction = database.getCurrentTransaction()
      expect(transaction!.options.timeout).toBe(30000)
      expect(transaction!.options.isolationLevel).toBe('SNAPSHOT_ISOLATION')
    })
  })

  describe('Change Notifications', () => {
    it('should register and receive change notifications', async () => {
      const receivedChanges: ChangeRecord[] = []

      const listener = (changes: readonly ChangeRecord[]) => {
        receivedChanges.push(...changes)
      }

      database.addChangeListener(listener)

      await database.startTransaction()
      const transaction = database.getCurrentTransaction()!

      // Simulate a change
      transaction.recordChange({
        type: 'insert',
        collection: 'users',
        key: 'user1',
        newValue: { name: 'Alice' },
        timestamp: Date.now()
      })

      await database.commitTransaction()

      expect(receivedChanges).toHaveLength(1)
      expect(receivedChanges[0].type).toBe('insert')
      expect(receivedChanges[0].collection).toBe('users')

      database.removeChangeListener(listener)
    })

    it('should not notify on rollback', async () => {
      const receivedChanges: ChangeRecord[] = []

      const listener = (changes: readonly ChangeRecord[]) => {
        receivedChanges.push(...changes)
      }

      database.addChangeListener(listener)

      await database.startTransaction()
      const transaction = database.getCurrentTransaction()!

      transaction.recordChange({
        type: 'insert',
        collection: 'users',
        key: 'user1',
        newValue: { name: 'Alice' },
        timestamp: Date.now()
      })

      await database.abortTransaction()

      expect(receivedChanges).toHaveLength(0)

      database.removeChangeListener(listener)
    })
  })

  describe('Error Handling', () => {
    it('should handle endSession with active transaction', async () => {
      await database.startTransaction()
      expect(database.getCurrentTransactionId()).toBeDefined()

      // endSession should rollback active transaction
      await database.endSession()
      expect(database.getCurrentTransactionId()).toBeUndefined()
    })

    it('should cleanup expired transactions', async () => {
      await database.startTransaction({ timeout: 50 })
      expect(database.activeTransactionCount).toBe(1)

      // Wait for transaction to expire
      await new Promise(resolve => setTimeout(resolve, 100))

      await database.cleanupTransactions()
      expect(database.activeTransactionCount).toBe(0)
    })
  })

  describe('Collection Operations with Transactions', () => {
    it('should create collection within transaction', async () => {
      await database.startTransaction()

      const collection = await database.createCollection('users')
      expect(collection).toBeDefined()
      expect(collection.name).toBe('users')

      await database.commitTransaction()

      // Collection should still exist after commit
      const retrievedCollection = database.collection('users')
      expect(retrievedCollection).toBeDefined()
    })

    it('should rollback collection creation', async () => {
      await database.startTransaction()

      await database.createCollection('temp-users')
      expect(database.collection('temp-users')).toBeDefined()

      await database.abortTransaction()

      // Collection should still exist (creation is not transactional yet)
      // This will be improved in Phase 2
      expect(database.collection('temp-users')).toBeDefined()
    })
  })

  describe('Concurrent Transaction Handling', () => {
    it('should handle multiple databases independently', async () => {
      const db2Path = path.join(process.cwd(), 'test-data', `db2-${Date.now()}`)
      const database2 = new CSDatabase(db2Path, 'test-db2')
      await database2.connect()

      try {
        await database.startTransaction()
        await database2.startTransaction()

        expect(database.activeTransactionCount).toBe(1)
        expect(database2.activeTransactionCount).toBe(1)

        await database.commitTransaction()
        await database2.commitTransaction()

        expect(database.activeTransactionCount).toBe(0)
        expect(database2.activeTransactionCount).toBe(0)
      } finally {
        await database2.close()
        // Clean up the test directory
        if (fs.existsSync(db2Path)) {
          fs.rmSync(db2Path, { recursive: true, force: true })
        }
      }
    })
  })
})