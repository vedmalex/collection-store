/**
 * Phase 5: Client Integration - SDK Index
 *
 * Главный экспорт для Client SDK
 */

// Основные интерфейсы
export * from './interfaces/IClientSDK'
export * from './interfaces/types'

// Основная реализация SDK
export { ClientSDK } from './core/ClientSDK'

// Менеджеры
export { CollectionManager } from './core/CollectionManager'
export { FileManager } from './core/FileManager'
export { SubscriptionManager } from './core/SubscriptionManager'
export { CacheManager } from './core/CacheManager'

// Фабричная функция для создания SDK
export function createClientSDK(config?: Partial<import('./interfaces/IClientSDK').ClientSDKConfig>) {
  return new ClientSDK(config)
}