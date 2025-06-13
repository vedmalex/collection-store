import { beforeEach, afterEach } from 'bun:test'
import { MikroORM } from '../src/index'
import { CollectionStoreDriver } from '../src/Driver'
import { CollectionStoreEntityRepository } from '../src/EntityRepository'
import { rmSync } from 'fs'
import { join } from 'path'

export let orm: MikroORM

export const TEST_DB_PATH = './test-data'

export async function initTestORM(entities: any[], dbName = 'test-db') {
  orm = await MikroORM.init({
    entities,
    dbName,
    driver: CollectionStoreDriver,
    clientUrl: TEST_DB_PATH,
    debug: false,
    entityRepository: CollectionStoreEntityRepository,
  })

  await orm.schema.refreshDatabase()

  // Force clean up any existing transaction state
  const connection = orm.em.getConnection()
  const db = connection.getDb()

  // Force reset transaction state
  try {
    await db.forceResetTransactionState()
  } catch (error) {
    // Ignore cleanup errors
  }

  return orm
}

export async function closeTestORM() {
  if (orm) {
    // Clean up transaction state before closing
    const connection = orm.em.getConnection()
    try {
      await connection.getDb().endSession()
      await connection.getDb().cleanupTransactions()
    } catch (error) {
      // Ignore cleanup errors
    }
    await orm.close()
  }
}

export function cleanupTestData() {
  try {
    rmSync(TEST_DB_PATH, { recursive: true, force: true })
  } catch (error) {
    // Ignore cleanup errors
  }
}

// Global test hooks
beforeEach(() => {
  cleanupTestData()
})

afterEach(async () => {
  await closeTestORM()
  cleanupTestData()
})