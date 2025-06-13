/**
 * File ID Generator - Collision-Resistant Implementation
 * Phase 4: File Storage System - ID Generation
 *
 * Implements collision-resistant ID generation for high-load scenarios
 * Following DEVELOPMENT_RULES.md guidelines for ID generation
 */

import * as crypto from 'crypto'

export interface FileIdGeneratorConfig {
  strategy: 'uuid' | 'timestamp_counter' | 'hybrid' | 'custom'
  nodeId?: string
  customGenerator?: () => string
}

export interface IFileIdGenerator {
  generateId(): string
  generateBatch(count: number): string[]
  validateId(id: string): boolean
  getIdInfo(id: string): IdInfo | null
}

export interface IdInfo {
  timestamp?: number
  nodeId?: string
  counter?: number
  strategy: string
  generatedAt: Date
}

export class FileIdGenerator implements IFileIdGenerator {
  private strategy: string
  private nodeId: string
  private counter = 0
  private lastTimestamp = 0
  private customGenerator?: () => string

  constructor(config: FileIdGeneratorConfig = { strategy: 'hybrid' }) {
    this.strategy = config.strategy
    this.nodeId = config.nodeId || this.generateNodeId()
    this.customGenerator = config.customGenerator
  }

  generateId(): string {
    switch (this.strategy) {
      case 'uuid':
        return this.generateUUID()

      case 'timestamp_counter':
        return this.generateTimestampCounter()

      case 'hybrid':
        return this.generateHybrid()

      case 'custom':
        if (!this.customGenerator) {
          throw new Error('Custom generator function not provided')
        }
        return this.customGenerator()

      default:
        throw new Error(`Unknown ID generation strategy: ${this.strategy}`)
    }
  }

  generateBatch(count: number): string[] {
    const ids: string[] = []

    for (let i = 0; i < count; i++) {
      ids.push(this.generateId())
    }

    return ids
  }

  validateId(id: string): boolean {
    if (!id || typeof id !== 'string') {
      return false
    }

    switch (this.strategy) {
      case 'uuid':
        return this.validateUUID(id)

      case 'timestamp_counter':
        return this.validateTimestampCounter(id)

      case 'hybrid':
        return this.validateHybrid(id)

      case 'custom':
        // For custom strategy, just check if it's a non-empty string
        return id.length > 0

      default:
        return false
    }
  }

  getIdInfo(id: string): IdInfo | null {
    if (!this.validateId(id)) {
      return null
    }

    switch (this.strategy) {
      case 'uuid':
        return {
          strategy: 'uuid',
          generatedAt: new Date() // UUID doesn't contain timestamp info
        }

      case 'timestamp_counter':
        return this.parseTimestampCounter(id)

      case 'hybrid':
        return this.parseHybrid(id)

      case 'custom':
        return {
          strategy: 'custom',
          generatedAt: new Date()
        }

      default:
        return null
    }
  }

  // UUID v4 generation (fully random, collision-resistant)
  private generateUUID(): string {
    return crypto.randomUUID()
  }

  private validateUUID(id: string): boolean {
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
    return uuidRegex.test(id)
  }

  // Timestamp + Counter (sortable, collision-resistant within same millisecond)
  private generateTimestampCounter(): string {
    const timestamp = Date.now()

    // If in the same millisecond, increment counter
    if (timestamp === this.lastTimestamp) {
      this.counter++
    } else {
      this.counter = 0
      this.lastTimestamp = timestamp
    }

    // Format: timestamp(13)-nodeId(8)-counter(6)
    const timestampHex = timestamp.toString(16).padStart(13, '0')
    const nodeIdHex = this.nodeId.substring(0, 8)
    const counterHex = this.counter.toString(16).padStart(6, '0')

    return `${timestampHex}-${nodeIdHex}-${counterHex}`
  }

  private validateTimestampCounter(id: string): boolean {
    const parts = id.split('-')
    return parts.length === 3 &&
           parts[0].length === 13 &&
           parts[1].length === 8 &&
           parts[2].length === 6 &&
           /^[0-9a-f]+$/i.test(parts[0]) &&
           /^[0-9a-f]+$/i.test(parts[2])
  }

  private parseTimestampCounter(id: string): IdInfo | null {
    const parts = id.split('-')
    if (parts.length !== 3) return null

    try {
      const timestamp = parseInt(parts[0], 16)
      const nodeId = parts[1]
      const counter = parseInt(parts[2], 16)

      return {
        timestamp,
        nodeId,
        counter,
        strategy: 'timestamp_counter',
        generatedAt: new Date(timestamp)
      }
    } catch {
      return null
    }
  }

  // Hybrid approach: timestamp + random + counter (best of both worlds)
  private generateHybrid(): string {
    const timestamp = Date.now()

    // If in the same millisecond, increment counter
    if (timestamp === this.lastTimestamp) {
      this.counter++
    } else {
      this.counter = 0
      this.lastTimestamp = timestamp
    }

    // Format: timestamp(13)-random(8)-nodeId(4)-counter(4)
    const timestampHex = timestamp.toString(16).padStart(13, '0')
    const randomHex = crypto.randomBytes(4).toString('hex')
    const nodeIdHex = this.nodeId.substring(0, 4)
    const counterHex = this.counter.toString(16).padStart(4, '0')

    return `${timestampHex}-${randomHex}-${nodeIdHex}-${counterHex}`
  }

  private validateHybrid(id: string): boolean {
    const parts = id.split('-')
    return parts.length === 4 &&
           parts[0].length === 13 &&
           parts[1].length === 8 &&
           parts[2].length === 4 &&
           parts[3].length === 4 &&
           /^[0-9a-f]+$/i.test(parts[0]) &&
           /^[0-9a-f]+$/i.test(parts[1]) &&
           /^[0-9a-f]+$/i.test(parts[3])
  }

  private parseHybrid(id: string): IdInfo | null {
    const parts = id.split('-')
    if (parts.length !== 4) return null

    try {
      const timestamp = parseInt(parts[0], 16)
      const nodeId = parts[2]
      const counter = parseInt(parts[3], 16)

      return {
        timestamp,
        nodeId,
        counter,
        strategy: 'hybrid',
        generatedAt: new Date(timestamp)
      }
    } catch {
      return null
    }
  }

  // Generate a unique node ID based on system characteristics
  private generateNodeId(): string {
    const hostname = process.env.HOSTNAME || 'unknown'
    const pid = process.pid.toString()
    const random = crypto.randomBytes(2).toString('hex')

    // Create a hash of hostname + pid + random
    const hash = crypto.createHash('sha256')
    hash.update(hostname + pid + random)

    // Return hex string without dashes
    return hash.digest('hex').substring(0, 8).replace(/-/g, '')
  }
}

// Singleton instance for global use
let globalGenerator: FileIdGenerator | null = null

export function getGlobalFileIdGenerator(): FileIdGenerator {
  if (!globalGenerator) {
    globalGenerator = new FileIdGenerator({
      strategy: 'hybrid', // Best balance of performance and collision resistance
      nodeId: process.env.NODE_ID // Allow override via environment
    })
  }
  return globalGenerator
}

export function setGlobalFileIdGenerator(generator: FileIdGenerator): void {
  globalGenerator = generator
}

// Utility functions for common use cases
export function generateFileId(): string {
  return getGlobalFileIdGenerator().generateId()
}

export function generateFileIds(count: number): string[] {
  return getGlobalFileIdGenerator().generateBatch(count)
}

export function validateFileId(id: string): boolean {
  return getGlobalFileIdGenerator().validateId(id)
}

export function getFileIdInfo(id: string): IdInfo | null {
  return getGlobalFileIdGenerator().getIdInfo(id)
}