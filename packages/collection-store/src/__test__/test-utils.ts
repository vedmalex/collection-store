import fs from 'fs-extra'
import path from 'path'

/**
 * Utility function to clean up test directories
 * Ensures test-data directories are properly removed after tests
 */
export async function cleanupTestDirectory(dirPath: string): Promise<void> {
  try {
    if (await fs.pathExists(dirPath)) {
      await fs.remove(dirPath)
    }
  } catch (error) {
    console.warn(`Warning: Failed to cleanup test directory ${dirPath}:`, error)
  }
}

/**
 * Utility function to clean up multiple test directories
 */
export async function cleanupTestDirectories(dirPaths: string[]): Promise<void> {
  await Promise.all(dirPaths.map(dir => cleanupTestDirectory(dir)))
}

/**
 * Creates a unique test directory path to avoid conflicts
 */
export function createTestDir(baseName: string): string {
  return path.join('./test-data', `${baseName}-${Date.now()}-${Math.random().toString(36).substring(2)}`)
}

/**
 * Cleanup all test-data directories in the project root
 */
export async function cleanupAllTestData(): Promise<void> {
  const projectRoot = process.cwd()
  const testDataDirs = [
    path.join(projectRoot, 'test-data'),
    path.join(projectRoot, 'test-data-2'),
    path.join(projectRoot, 'test-data-users'),
    path.join(projectRoot, 'test-data-products'),
    path.join(projectRoot, 'test-data-main'),
    path.join(projectRoot, 'test-data-strict'),
    path.join(projectRoot, 'test-data-queries-1'),
    path.join(projectRoot, 'test-data-queries-2'),
    path.join(projectRoot, 'test-data-queries-3'),
    path.join(projectRoot, 'test-data-queries-4'),
    path.join(projectRoot, 'test-data-validation'),
    path.join(projectRoot, 'test-data-performance'),
    path.join(projectRoot, 'test-data-users-updates'),
    path.join(projectRoot, 'test-data-products-updates'),
    path.join(projectRoot, 'test-data-mul'),
    path.join(projectRoot, 'test-data-bulk-1'),
    path.join(projectRoot, 'test-data-bulk-2'),
    path.join(projectRoot, 'test-data-upsert')
  ]

  await cleanupTestDirectories(testDataDirs)
}