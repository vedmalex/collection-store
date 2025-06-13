/**
 * Phase 5: Client Integration - State Manager
 *
 * Менеджер для управления состоянием клиента с синхронизацией и персистентностью
 */

import { EventEmitter } from 'events'
import { IStateManager } from '../interfaces/ISession'
import {
  ClientState,
  SessionInfo,
  StateSyncOptions,
  StateSyncResult,
  ConnectionInfo
} from '../interfaces/types'

/**
 * Внутреннее состояние с метаданными
 */
interface InternalClientState extends ClientState {
  version: number
  lastModified: Date
  checksum: string
  compressed: boolean
  encrypted: boolean
}

/**
 * Менеджер состояния клиента
 */
export class StateManager extends EventEmitter implements IStateManager {
  private states: Map<string, InternalClientState> = new Map()
  private stateChangeHandlers: Map<string, Set<(state: ClientState) => void>> = new Map()
  private syncInProgress: Set<string> = new Set()
  private persistenceEnabled: boolean = true
  private compressionThreshold: number = 1024 * 10 // 10KB
  private maxStateSize: number = 1024 * 1024 * 5 // 5MB

  constructor(options?: {
    persistenceEnabled?: boolean
    compressionThreshold?: number
    maxStateSize?: number
  }) {
    super()

    if (options) {
      this.persistenceEnabled = options.persistenceEnabled ?? true
      this.compressionThreshold = options.compressionThreshold ?? this.compressionThreshold
      this.maxStateSize = options.maxStateSize ?? this.maxStateSize
    }
  }

  /**
   * Получение состояния клиента
   */
  async getState(sessionId: string): Promise<ClientState | null> {
    const internalState = this.states.get(sessionId)

    if (!internalState) {
      // Попытка восстановления из персистентного хранилища
      if (this.persistenceEnabled) {
        const restoredState = await this.loadStateFromStorage(sessionId)
        if (restoredState) {
          this.states.set(sessionId, restoredState)
          return this.toClientState(restoredState)
        }
      }
      return null
    }

    return this.toClientState(internalState)
  }

  /**
   * Обновление состояния клиента
   */
  async updateState(sessionId: string, updates: Partial<ClientState>): Promise<void> {
    let currentState = this.states.get(sessionId)

    if (!currentState) {
      // Создание нового состояния
      currentState = await this.createInitialState(sessionId)
    }

    // Проверка размера обновлений
    const updatesSize = this.calculateStateSize(updates)
    if (updatesSize > this.maxStateSize) {
      throw new Error(`State update too large: ${updatesSize} bytes (max: ${this.maxStateSize})`)
    }

    // Применение обновлений
    const updatedState: InternalClientState = {
      ...currentState,
      ...updates,
      version: currentState.version + 1,
      lastModified: new Date(),
      checksum: this.calculateChecksum({ ...currentState, ...updates })
    }

    // Проверка общего размера состояния
    const totalSize = this.calculateStateSize(updatedState)
    if (totalSize > this.maxStateSize) {
      throw new Error(`Total state size too large: ${totalSize} bytes (max: ${this.maxStateSize})`)
    }

    this.states.set(sessionId, updatedState)

    // Автоматическое сжатие при превышении порога
    if (totalSize > this.compressionThreshold && !updatedState.compressed) {
      await this.compressState(sessionId)
    }

    // Автоматическое сохранение
    if (this.persistenceEnabled) {
      await this.saveStateToStorage(sessionId, updatedState)
    }

    // Уведомление об изменениях
    this.notifyStateChange(sessionId, this.toClientState(updatedState))
  }

  /**
   * Синхронизация состояния
   */
  async syncState(sessionId: string, options: StateSyncOptions): Promise<StateSyncResult> {
    if (this.syncInProgress.has(sessionId)) {
      throw new Error(`State sync already in progress for session ${sessionId}`)
    }

    this.syncInProgress.add(sessionId)
    const startTime = performance.now()

    try {
      const currentState = this.states.get(sessionId)
      if (!currentState) {
        throw new Error(`No state found for session ${sessionId}`)
      }

      let conflictsResolved = 0
      let dataSize = 0

      // Подготовка данных для синхронизации
      const syncData = await this.prepareSyncData(sessionId, currentState, options)
      dataSize = this.calculateStateSize(syncData)

      // Сжатие данных если требуется
      let compressionRatio: number | undefined
      if (options.compression && dataSize > this.compressionThreshold) {
        const compressedData = await this.compressData(syncData)
        compressionRatio = dataSize / compressedData.length
        dataSize = compressedData.length
      }

      // Шифрование данных если требуется
      if (options.encryption) {
        // Заглушка для шифрования - в реальной реализации использовать crypto API
        console.log('Encrypting sync data...')
      }

      // Симуляция отправки данных на сервер
      if (options.immediate) {
        await this.sendSyncDataImmediate(sessionId, syncData)
      } else {
        this.scheduleSyncData(sessionId, syncData)
      }

      // Обновление метаданных синхронизации
      currentState.lastSyncAt = new Date()

      const result: StateSyncResult = {
        success: true,
        syncedAt: new Date(),
        conflictsResolved,
        dataSize,
        compressionRatio
      }

      this.emit('stateSynced', { sessionId, result })
      return result

    } catch (error) {
      const result: StateSyncResult = {
        success: false,
        syncedAt: new Date(),
        conflictsResolved: 0,
        dataSize: 0,
        error: error as Error
      }

      this.emit('syncError', { sessionId, error })
      return result

    } finally {
      this.syncInProgress.delete(sessionId)
    }
  }

  /**
   * Сохранение состояния
   */
  async persistState(sessionId: string): Promise<void> {
    const state = this.states.get(sessionId)
    if (!state) {
      throw new Error(`No state found for session ${sessionId}`)
    }

    if (!this.persistenceEnabled) {
      throw new Error('Persistence is disabled')
    }

    await this.saveStateToStorage(sessionId, state)
    this.emit('statePersisted', { sessionId })
  }

  /**
   * Восстановление состояния
   */
  async restoreState(sessionId: string): Promise<ClientState | null> {
    if (!this.persistenceEnabled) {
      return null
    }

    try {
      const restoredState = await this.loadStateFromStorage(sessionId)
      if (restoredState) {
        this.states.set(sessionId, restoredState)
        this.emit('stateRestored', { sessionId })
        return this.toClientState(restoredState)
      }
      return null
    } catch (error) {
      this.emit('restoreError', { sessionId, error })
      return null
    }
  }

  /**
   * Очистка состояния
   */
  async clearState(sessionId: string): Promise<void> {
    // Удаление из памяти
    this.states.delete(sessionId)

    // Очистка обработчиков
    this.stateChangeHandlers.delete(sessionId)

    // Удаление из персистентного хранилища
    if (this.persistenceEnabled) {
      await this.removeStateFromStorage(sessionId)
    }

    this.emit('stateCleared', { sessionId })
  }

  /**
   * Подписка на изменения состояния
   */
  onStateChange(sessionId: string, callback: (state: ClientState) => void): () => void {
    if (!this.stateChangeHandlers.has(sessionId)) {
      this.stateChangeHandlers.set(sessionId, new Set())
    }

    this.stateChangeHandlers.get(sessionId)!.add(callback)

    return () => {
      const handlers = this.stateChangeHandlers.get(sessionId)
      if (handlers) {
        handlers.delete(callback)
        if (handlers.size === 0) {
          this.stateChangeHandlers.delete(sessionId)
        }
      }
    }
  }

  /**
   * Получение размера состояния
   */
  async getStateSize(sessionId: string): Promise<number> {
    const state = this.states.get(sessionId)
    if (!state) {
      return 0
    }

    return this.calculateStateSize(state)
  }

  /**
   * Сжатие состояния
   */
  async compressState(sessionId: string): Promise<void> {
    const state = this.states.get(sessionId)
    if (!state || state.compressed) {
      return
    }

    try {
      // Сжатие основных данных
      const compressedUserData = await this.compressData(state.userData)
      const compressedCache = await this.compressData(state.cache)
      const compressedPreferences = await this.compressData(state.preferences)

      // Обновление состояния
      state.userData = compressedUserData
      state.cache = compressedCache
      state.preferences = compressedPreferences
      state.compressed = true
      state.lastModified = new Date()
      state.version++

      this.emit('stateCompressed', { sessionId })
    } catch (error) {
      this.emit('compressionError', { sessionId, error })
      throw error
    }
  }

  /**
   * Декомпрессия состояния
   */
  async decompressState(sessionId: string): Promise<void> {
    const state = this.states.get(sessionId)
    if (!state || !state.compressed) {
      return
    }

    try {
      // Декомпрессия данных
      const decompressedUserData = await this.decompressData(state.userData)
      const decompressedCache = await this.decompressData(state.cache)
      const decompressedPreferences = await this.decompressData(state.preferences)

      // Обновление состояния
      state.userData = decompressedUserData
      state.cache = decompressedCache
      state.preferences = decompressedPreferences
      state.compressed = false
      state.lastModified = new Date()
      state.version++

      this.emit('stateDecompressed', { sessionId })
    } catch (error) {
      this.emit('decompressionError', { sessionId, error })
      throw error
    }
  }

  /**
   * Получение метаданных состояния
   */
  getStateMetadata(sessionId: string): {
    version: number
    lastModified: Date
    checksum: string
    compressed: boolean
    encrypted: boolean
    size: number
  } | null {
    const state = this.states.get(sessionId)
    if (!state) {
      return null
    }

    return {
      version: state.version,
      lastModified: state.lastModified,
      checksum: state.checksum,
      compressed: state.compressed,
      encrypted: state.encrypted,
      size: this.calculateStateSize(state)
    }
  }

  /**
   * Приватные методы
   */

  private async createInitialState(sessionId: string): Promise<InternalClientState> {
    const now = new Date()

    const initialState: InternalClientState = {
      sessionInfo: {
        sessionId,
        state: 'active',
        createdAt: now,
        lastActiveAt: now,
        expiresAt: new Date(now.getTime() + 3600000), // 1 hour
        connectionState: 'disconnected',
        metadata: {}
      },
      connectionInfo: {
        type: 'websocket',
        state: 'disconnected',
        url: '',
        reconnectAttempts: 0
      },
      userData: {},
      preferences: {},
      cache: {},
      subscriptions: [],
      lastSyncAt: now,
      version: 1,
      lastModified: now,
      checksum: '',
      compressed: false,
      encrypted: false
    }

    initialState.checksum = this.calculateChecksum(initialState)
    this.states.set(sessionId, initialState)

    return initialState
  }

  private toClientState(internalState: InternalClientState): ClientState {
    const { version, lastModified, checksum, compressed, encrypted, ...clientState } = internalState
    return clientState
  }

  private calculateStateSize(state: any): number {
    return JSON.stringify(state).length
  }

  private calculateChecksum(state: any): string {
    // Простая реализация checksum - в продакшене использовать crypto.subtle
    const str = JSON.stringify(state)
    let hash = 0
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i)
      hash = ((hash << 5) - hash) + char
      hash = hash & hash // Convert to 32-bit integer
    }
    return hash.toString(16)
  }

  private async prepareSyncData(sessionId: string, state: InternalClientState, options: StateSyncOptions): Promise<any> {
    const syncData: any = {
      sessionId,
      version: state.version,
      lastModified: state.lastModified,
      checksum: state.checksum
    }

    if (options.includeCache) {
      syncData.cache = state.cache
    }

    if (options.includePreferences) {
      syncData.preferences = state.preferences
    }

    if (options.includeSubscriptions) {
      syncData.subscriptions = state.subscriptions
    }

    // Всегда включаем основные данные пользователя
    syncData.userData = state.userData
    syncData.sessionInfo = state.sessionInfo
    syncData.connectionInfo = state.connectionInfo

    return syncData
  }

  private async compressData(data: any): Promise<any> {
    // Заглушка для сжатия - в реальной реализации использовать compression API
    const jsonString = JSON.stringify(data)

    // Простая симуляция сжатия
    if (jsonString.length > this.compressionThreshold) {
      return {
        compressed: true,
        data: jsonString, // В реальности здесь были бы сжатые данные
        originalSize: jsonString.length,
        compressedSize: Math.floor(jsonString.length * 0.7) // Симуляция 30% сжатия
      }
    }

    return data
  }

  private async decompressData(data: any): Promise<any> {
    // Заглушка для декомпрессии
    if (data && typeof data === 'object' && data.compressed) {
      return JSON.parse(data.data)
    }

    return data
  }

  private async sendSyncDataImmediate(sessionId: string, data: any): Promise<void> {
    // Заглушка для немедленной отправки данных
    console.log(`Syncing state immediately for session ${sessionId}`)

    // Симуляция сетевой задержки
    await new Promise(resolve => setTimeout(resolve, 100))
  }

  private scheduleSyncData(sessionId: string, data: any): void {
    // Заглушка для отложенной синхронизации
    console.log(`Scheduling state sync for session ${sessionId}`)

    setTimeout(() => {
      this.sendSyncDataImmediate(sessionId, data)
    }, 5000) // Синхронизация через 5 секунд
  }

  private async saveStateToStorage(sessionId: string, state: InternalClientState): Promise<void> {
    // Заглушка для сохранения в localStorage/IndexedDB
    try {
      const stateData = JSON.stringify(state)

      if (typeof localStorage !== 'undefined') {
        localStorage.setItem(`session_state_${sessionId}`, stateData)
      }

      console.log(`State saved for session ${sessionId}`)
    } catch (error) {
      console.error(`Failed to save state for session ${sessionId}:`, error)
      throw error
    }
  }

  private async loadStateFromStorage(sessionId: string): Promise<InternalClientState | null> {
    // Заглушка для загрузки из localStorage/IndexedDB
    try {
      if (typeof localStorage !== 'undefined') {
        const stateData = localStorage.getItem(`session_state_${sessionId}`)
        if (stateData) {
          const state = JSON.parse(stateData) as InternalClientState
          console.log(`State loaded for session ${sessionId}`)
          return state
        }
      }

      return null
    } catch (error) {
      console.error(`Failed to load state for session ${sessionId}:`, error)
      return null
    }
  }

  private async removeStateFromStorage(sessionId: string): Promise<void> {
    // Заглушка для удаления из localStorage/IndexedDB
    try {
      if (typeof localStorage !== 'undefined') {
        localStorage.removeItem(`session_state_${sessionId}`)
      }

      console.log(`State removed for session ${sessionId}`)
    } catch (error) {
      console.error(`Failed to remove state for session ${sessionId}:`, error)
      throw error
    }
  }

  private notifyStateChange(sessionId: string, state: ClientState): void {
    const handlers = this.stateChangeHandlers.get(sessionId)
    if (handlers) {
      handlers.forEach(handler => {
        try {
          handler(state)
        } catch (error) {
          console.error(`Error in state change handler for ${sessionId}:`, error)
        }
      })
    }

    this.emit('stateChanged', { sessionId, state })
  }
}