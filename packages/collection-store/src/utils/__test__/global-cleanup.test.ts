/**
 * Global cleanup test - runs after all other tests to clean up test data
 * This ensures no test-data directories are left behind
 */

import { describe, it, expect, afterAll } from 'bun:test'
import { cleanupAllTestData } from '../test-utils'

describe('Global Cleanup', () => {
  it('should be the last test to run', () => {
    // This test does nothing but ensures the afterAll hook runs
    expect(true).toBe(true)
  })

  afterAll(async () => {
    console.log('🧹 Running global cleanup of test data...')
    await cleanupAllTestData()
    console.log('✅ Global cleanup completed')
  })
})