/**
 * Phase 5: Client Integration - Cache Manager
 *
 * Менеджер кэширования для клиента
 */

import { ICacheManager } from '../interfaces/IClientSDK'
import { CacheConfig } from '../interfaces/types'

/**
 * Элемент кэша
 */
interface CacheItem<T = any> {
  value: T
  expiresAt: number
  accessCount: number
  lastAccessed: number
}

/**
 * Менеджер кэша
 */
export class CacheManager implements ICacheManager {
  private cache: Map<string, CacheItem> = new Map()
  private config: CacheConfig
  private stats = {
    hits: 0,
    misses: 0,
    sets: 0,
    deletes: 0
  }

  constructor(config: CacheConfig) {
    this.config = {
      enabled: true,
      maxSize: 100,
      ttl: 300000, // 5 minutes
      strategy: 'lru',
      compression: false,
      ...config
    }

    // Периодическая очистка истекших элементов
    setInterval(() => {
      this.cleanupExpired()
    }, 60000) // каждую минуту
  }

  /**
   * Получение данных из кэша
   */
  async get<T = any>(key: string): Promise<T | null> {
    if (!this.config.enabled) {
      return null
    }

    const item = this.cache.get(key)

    if (!item) {
      this.stats.misses++
      return null
    }

    // Проверка истечения
    if (Date.now() > item.expiresAt) {
      this.cache.delete(key)
      this.stats.misses++
      return null
    }

    // Обновление статистики доступа
    item.accessCount++
    item.lastAccessed = Date.now()
    this.stats.hits++

    return item.value as T
  }

  /**
   * Сохранение данных в кэш
   */
  async set<T = any>(key: string, value: T, ttl?: number): Promise<void> {
    if (!this.config.enabled) {
      return
    }

    const expirationTime = ttl || this.config.ttl
    const expiresAt = Date.now() + expirationTime

    // Проверка размера кэша
    if (this.cache.size >= this.config.maxSize) {
      this.evictItems()
    }

    const item: CacheItem<T> = {
      value,
      expiresAt,
      accessCount: 0,
      lastAccessed: Date.now()
    }

    this.cache.set(key, item)
    this.stats.sets++
  }

  /**
   * Удаление данных из кэша
   */
  async delete(key: string): Promise<boolean> {
    const deleted = this.cache.delete(key)
    if (deleted) {
      this.stats.deletes++
    }
    return deleted
  }

  /**
   * Очистка кэша
   */
  async clear(): Promise<void> {
    this.cache.clear()
    this.stats = {
      hits: 0,
      misses: 0,
      sets: 0,
      deletes: 0
    }
  }

  /**
   * Получение статистики кэша
   */
  async getStats(): Promise<{
    size: number
    hits: number
    misses: number
    hitRate: number
  }> {
    const totalRequests = this.stats.hits + this.stats.misses
    const hitRate = totalRequests > 0 ? this.stats.hits / totalRequests : 0

    return {
      size: this.cache.size,
      hits: this.stats.hits,
      misses: this.stats.misses,
      hitRate
    }
  }

  /**
   * Проверка существования ключа
   */
  async has(key: string): Promise<boolean> {
    if (!this.config.enabled) {
      return false
    }

    const item = this.cache.get(key)
    if (!item) {
      return false
    }

    // Проверка истечения
    if (Date.now() > item.expiresAt) {
      this.cache.delete(key)
      return false
    }

    return true
  }

  /**
   * Получение всех ключей
   */
  async keys(): Promise<string[]> {
    return Array.from(this.cache.keys())
  }

  /**
   * Получение размера кэша
   */
  async size(): Promise<number> {
    return this.cache.size
  }

  /**
   * Обновление конфигурации
   */
  updateConfig(config: Partial<CacheConfig>): void {
    this.config = { ...this.config, ...config }
  }

  /**
   * Приватные методы
   */

  private cleanupExpired(): void {
    const now = Date.now()
    const expiredKeys: string[] = []

    for (const [key, item] of this.cache.entries()) {
      if (now > item.expiresAt) {
        expiredKeys.push(key)
      }
    }

    for (const key of expiredKeys) {
      this.cache.delete(key)
    }
  }

  private evictItems(): void {
    const itemsToEvict = Math.max(1, Math.floor(this.config.maxSize * 0.1)) // Удаляем 10%

    switch (this.config.strategy) {
      case 'lru':
        this.evictLRU(itemsToEvict)
        break
      case 'lfu':
        this.evictLFU(itemsToEvict)
        break
      case 'fifo':
        this.evictFIFO(itemsToEvict)
        break
      default:
        this.evictLRU(itemsToEvict)
    }
  }

  private evictLRU(count: number): void {
    const entries = Array.from(this.cache.entries())
    entries.sort((a, b) => a[1].lastAccessed - b[1].lastAccessed)

    for (let i = 0; i < count && i < entries.length; i++) {
      this.cache.delete(entries[i][0])
    }
  }

  private evictLFU(count: number): void {
    const entries = Array.from(this.cache.entries())
    entries.sort((a, b) => a[1].accessCount - b[1].accessCount)

    for (let i = 0; i < count && i < entries.length; i++) {
      this.cache.delete(entries[i][0])
    }
  }

  private evictFIFO(count: number): void {
    const keys = Array.from(this.cache.keys())
    for (let i = 0; i < count && i < keys.length; i++) {
      this.cache.delete(keys[i])
    }
  }
}