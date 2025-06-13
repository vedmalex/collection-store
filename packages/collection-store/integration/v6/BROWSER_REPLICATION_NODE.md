# 🌐 Browser as Replication Node v6.0

## Концепция браузерной репликации

### Браузер как равноправный участник
В Collection Store v6.0 браузерные клиенты могут выступать как полноценные ноды репликации, участвуя в распределенной системе наравне с серверными нодами.

### Условная активация
Браузер автоматически активируется как нода репликации, если:
- Не сконфигурированы подписки на внешние источники данных
- Включена опция `browser.autoActivateAsNode` в конфигурации
- Браузер поддерживает необходимые API (WebRTC, IndexedDB, Service Workers)

## Архитектура браузерной репликации

### Основные компоненты

```typescript
// @/src/replication/browser/BrowserReplicationNode.ts
export class BrowserReplicationNode implements ReplicationNode {
  private nodeId: string
  private webrtcManager: WebRTCManager
  private indexedDBAdapter: IndexedDBAdapter
  private serviceWorkerManager: ServiceWorkerManager
  private p2pConnections: Map<string, RTCPeerConnection> = new Map()
  private replicationState: ReplicationState

  constructor(config: BrowserReplicationConfig) {
    this.nodeId = config.nodeId || this.generateNodeId()
    this.webrtcManager = new WebRTCManager(config.webrtc)
    this.indexedDBAdapter = new IndexedDBAdapter(config.storage)
    this.serviceWorkerManager = new ServiceWorkerManager()
    this.replicationState = new ReplicationState()
  }

  async initialize(): Promise<void> {
    // Проверяем условия активации
    if (!this.shouldActivateAsNode()) {
      console.log('Browser replication node not activated - conditions not met')
      return
    }

    console.log(`Activating browser as replication node: ${this.nodeId}`)

    // Инициализируем компоненты
    await this.indexedDBAdapter.initialize()
    await this.serviceWorkerManager.initialize()
    await this.webrtcManager.initialize()

    // Регистрируемся в сети репликации
    await this.registerInReplicationNetwork()

    // Начинаем участвовать в репликации
    await this.startReplicationParticipation()
  }

  private shouldActivateAsNode(): boolean {
    // Проверяем наличие подписок
    if (this.hasConfiguredSubscriptions()) {
      return false
    }

    // Проверяем поддержку браузером
    if (!this.isBrowserSupported()) {
      console.warn('Browser does not support required APIs for replication')
      return false
    }

    // Проверяем конфигурацию
    return this.config.browser?.autoActivateAsNode !== false
  }

  private hasConfiguredSubscriptions(): boolean {
    return this.config.subscriptions && this.config.subscriptions.length > 0
  }

  private isBrowserSupported(): boolean {
    return !!(
      window.RTCPeerConnection &&
      window.indexedDB &&
      navigator.serviceWorker &&
      window.BroadcastChannel
    )
  }
}
```

### WebRTC P2P Manager

```typescript
// @/src/replication/browser/WebRTCManager.ts
export class WebRTCManager {
  private localPeer: RTCPeerConnection
  private dataChannels: Map<string, RTCDataChannel> = new Map()
  private signaling: SignalingManager
  private discoveredPeers: Set<string> = new Set()

  constructor(config: WebRTCConfig) {
    this.signaling = new SignalingManager(config.signaling)
    this.setupLocalPeer()
  }

  private setupLocalPeer(): void {
    this.localPeer = new RTCPeerConnection({
      iceServers: [
        { urls: 'stun:stun.l.google.com:19302' },
        { urls: 'stun:stun1.l.google.com:19302' }
      ]
    })

    this.localPeer.ondatachannel = (event) => {
      this.handleIncomingDataChannel(event.channel)
    }

    this.localPeer.onicecandidate = (event) => {
      if (event.candidate) {
        this.signaling.sendIceCandidate(event.candidate)
      }
    }
  }

  async connectToPeer(peerId: string): Promise<RTCDataChannel> {
    const dataChannel = this.localPeer.createDataChannel(`replication-${peerId}`, {
      ordered: true,
      maxRetransmits: 3
    })

    this.setupDataChannel(dataChannel, peerId)

    // Create offer
    const offer = await this.localPeer.createOffer()
    await this.localPeer.setLocalDescription(offer)

    // Send offer through signaling
    await this.signaling.sendOffer(peerId, offer)

    return dataChannel
  }

  private setupDataChannel(channel: RTCDataChannel, peerId: string): void {
    channel.onopen = () => {
      console.log(`P2P connection established with ${peerId}`)
      this.dataChannels.set(peerId, channel)
      this.onPeerConnected(peerId, channel)
    }

    channel.onmessage = (event) => {
      this.handleReplicationMessage(peerId, JSON.parse(event.data))
    }

    channel.onclose = () => {
      console.log(`P2P connection closed with ${peerId}`)
      this.dataChannels.delete(peerId)
      this.onPeerDisconnected(peerId)
    }

    channel.onerror = (error) => {
      console.error(`P2P connection error with ${peerId}:`, error)
    }
  }

  async broadcastChange(change: ReplicationChange): Promise<void> {
    const message = {
      type: 'replication-change',
      nodeId: this.nodeId,
      change,
      timestamp: Date.now()
    }

    // Отправляем всем подключенным пирам
    for (const [peerId, channel] of this.dataChannels) {
      if (channel.readyState === 'open') {
        try {
          channel.send(JSON.stringify(message))
        } catch (error) {
          console.error(`Failed to send change to peer ${peerId}:`, error)
        }
      }
    }
  }
}
```

### Peer Discovery через Service Worker

```typescript
// @/src/browser/workers/ServiceWorkerManager.ts
export class ServiceWorkerManager {
  private registration: ServiceWorkerRegistration | null = null
  private broadcastChannel: BroadcastChannel

  constructor() {
    this.broadcastChannel = new BroadcastChannel('collection-store-replication')
  }

  async initialize(): Promise<void> {
    if (!('serviceWorker' in navigator)) {
      console.warn('Service Workers not supported')
      return
    }

    try {
      this.registration = await navigator.serviceWorker.register('/sw.js')
      console.log('Service Worker registered successfully')

      // Настраиваем обмен сообщениями
      this.setupMessageHandling()

      // Начинаем peer discovery
      this.startPeerDiscovery()
    } catch (error) {
      console.error('Service Worker registration failed:', error)
    }
  }

  private setupMessageHandling(): void {
    // Слушаем сообщения от Service Worker
    navigator.serviceWorker.addEventListener('message', (event) => {
      this.handleServiceWorkerMessage(event.data)
    })

    // Слушаем сообщения от других табов
    this.broadcastChannel.addEventListener('message', (event) => {
      this.handleCrossTabMessage(event.data)
    })
  }

  private startPeerDiscovery(): void {
    // Объявляем о себе другим табам
    this.broadcastChannel.postMessage({
      type: 'peer-announcement',
      nodeId: this.nodeId,
      timestamp: Date.now(),
      capabilities: this.getNodeCapabilities()
    })

    // Периодически обновляем информацию о себе
    setInterval(() => {
      this.broadcastChannel.postMessage({
        type: 'peer-heartbeat',
        nodeId: this.nodeId,
        timestamp: Date.now()
      })
    }, 30000) // каждые 30 секунд
  }

  private getNodeCapabilities(): NodeCapabilities {
    return {
      storage: 'indexeddb',
      webrtc: !!window.RTCPeerConnection,
      serviceWorker: !!navigator.serviceWorker,
      broadcastChannel: !!window.BroadcastChannel,
      maxStorageQuota: this.estimateStorageQuota()
    }
  }
}
```

## Conflict Resolution для браузерных нод

### Стратегии разрешения конфликтов

```typescript
// @/src/replication/browser/BrowserConflictResolver.ts
export class BrowserConflictResolver implements ConflictResolver {
  private strategy: ConflictResolutionStrategy

  constructor(strategy: ConflictResolutionStrategy = 'timestamp-priority') {
    this.strategy = strategy
  }

  async resolveConflict(
    localChange: Change,
    remoteChange: Change,
    context: ConflictContext
  ): Promise<ResolvedChange> {
    switch (this.strategy) {
      case 'timestamp-priority':
        return this.resolveByTimestampAndPriority(localChange, remoteChange, context)

      case 'browser-defers':
        return this.browserDefersToServer(localChange, remoteChange, context)

      case 'last-writer-wins':
        return this.lastWriterWins(localChange, remoteChange)

      case 'merge-fields':
        return this.mergeFields(localChange, remoteChange)

      default:
        throw new Error(`Unknown conflict resolution strategy: ${this.strategy}`)
    }
  }

  private resolveByTimestampAndPriority(
    local: Change,
    remote: Change,
    context: ConflictContext
  ): ResolvedChange {
    // Браузерные ноды имеют более низкий приоритет
    const localPriority = context.localNode.type === 'browser' ? 1 : 2
    const remotePriority = context.remoteNode.type === 'browser' ? 1 : 2

    if (remotePriority > localPriority) {
      return { winner: 'remote', change: remote, reason: 'higher-priority-node' }
    }

    if (localPriority > remotePriority) {
      return { winner: 'local', change: local, reason: 'higher-priority-node' }
    }

    // Одинаковый приоритет - сравниваем по времени
    if (remote.timestamp > local.timestamp) {
      return { winner: 'remote', change: remote, reason: 'newer-timestamp' }
    }

    return { winner: 'local', change: local, reason: 'newer-or-equal-timestamp' }
  }

  private browserDefersToServer(
    local: Change,
    remote: Change,
    context: ConflictContext
  ): ResolvedChange {
    // Браузер всегда уступает серверным нодам
    if (context.remoteNode.type === 'server' && context.localNode.type === 'browser') {
      return { winner: 'remote', change: remote, reason: 'browser-defers-to-server' }
    }

    // Между браузерными нодами - по времени
    return this.lastWriterWins(local, remote)
  }
}
```

## Offline-first архитектура

### Локальное хранение и синхронизация

```typescript
// @/src/browser/adapters/IndexedDBAdapter.ts
export class IndexedDBAdapter implements StorageAdapter {
  private db: IDBDatabase | null = null
  private pendingChanges: Change[] = []
  private syncQueue: SyncQueue

  constructor(config: IndexedDBConfig) {
    this.syncQueue = new SyncQueue(config.sync)
  }

  async initialize(): Promise<void> {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open('collection-store-v6', 1)

      request.onerror = () => reject(request.error)
      request.onsuccess = () => {
        this.db = request.result
        this.setupChangeTracking()
        resolve()
      }

      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result
        this.createObjectStores(db)
      }
    })
  }

  private createObjectStores(db: IDBDatabase): void {
    // Основные коллекции
    const collectionsStore = db.createObjectStore('collections', { keyPath: 'id' })
    collectionsStore.createIndex('name', 'name', { unique: true })

    // Документы
    const documentsStore = db.createObjectStore('documents', { keyPath: 'id' })
    documentsStore.createIndex('collectionId', 'collectionId')
    documentsStore.createIndex('timestamp', 'timestamp')

    // Изменения для репликации
    const changesStore = db.createObjectStore('changes', { keyPath: 'id' })
    changesStore.createIndex('timestamp', 'timestamp')
    changesStore.createIndex('synced', 'synced')

    // Метаданные репликации
    const replicationStore = db.createObjectStore('replication', { keyPath: 'key' })
  }

  async saveChange(change: Change): Promise<void> {
    if (!this.db) throw new Error('IndexedDB not initialized')

    const transaction = this.db.transaction(['changes'], 'readwrite')
    const store = transaction.objectStore('changes')

    await new Promise<void>((resolve, reject) => {
      const request = store.add({
        ...change,
        synced: false,
        createdAt: Date.now()
      })

      request.onsuccess = () => resolve()
      request.onerror = () => reject(request.error)
    })

    // Добавляем в очередь синхронизации
    this.syncQueue.enqueue(change)
  }

  async getPendingChanges(): Promise<Change[]> {
    if (!this.db) return []

    const transaction = this.db.transaction(['changes'], 'readonly')
    const store = transaction.objectStore('changes')
    const index = store.index('synced')

    return new Promise((resolve, reject) => {
      const request = index.getAll(false) // synced = false

      request.onsuccess = () => resolve(request.result)
      request.onerror = () => reject(request.error)
    })
  }

  async markChangesSynced(changeIds: string[]): Promise<void> {
    if (!this.db) return

    const transaction = this.db.transaction(['changes'], 'readwrite')
    const store = transaction.objectStore('changes')

    for (const changeId of changeIds) {
      const getRequest = store.get(changeId)

      getRequest.onsuccess = () => {
        const change = getRequest.result
        if (change) {
          change.synced = true
          store.put(change)
        }
      }
    }
  }
}
```

## Производительность и оптимизация

### Partial Replication для браузеров

```typescript
// @/src/replication/browser/PartialReplicationManager.ts
export class PartialReplicationManager {
  private subscriptions: Map<string, ReplicationSubscription> = new Map()
  private filters: ReplicationFilter[]

  constructor(config: PartialReplicationConfig) {
    this.filters = config.filters || []
  }

  // Подписка на частичную репликацию
  async subscribe(subscription: ReplicationSubscription): Promise<void> {
    this.subscriptions.set(subscription.id, subscription)

    // Запрашиваем только нужные данные
    const filter = this.createFilterFromSubscription(subscription)
    await this.requestPartialData(filter)
  }

  private createFilterFromSubscription(sub: ReplicationSubscription): ReplicationFilter {
    return {
      collections: sub.collections,
      query: sub.query,
      fields: sub.fields,
      limit: sub.limit || 1000, // Ограничиваем для браузера
      priority: sub.priority || 'normal'
    }
  }

  // Проверяем, нужно ли реплицировать изменение
  shouldReplicateChange(change: Change): boolean {
    // Проверяем по всем активным подпискам
    for (const subscription of this.subscriptions.values()) {
      if (this.matchesSubscription(change, subscription)) {
        return true
      }
    }

    return false
  }

  private matchesSubscription(change: Change, sub: ReplicationSubscription): boolean {
    // Проверяем коллекцию
    if (sub.collections && !sub.collections.includes(change.collection)) {
      return false
    }

    // Проверяем запрос
    if (sub.query && !this.matchesQuery(change.document, sub.query)) {
      return false
    }

    return true
  }
}
```

## Мониторинг и отладка

### Browser Replication Dashboard

```typescript
// @/src/browser/monitoring/ReplicationDashboard.ts
export class ReplicationDashboard {
  private metrics: ReplicationMetrics
  private ui: DashboardUI

  constructor() {
    this.metrics = new ReplicationMetrics()
    this.ui = new DashboardUI()
  }

  async initialize(): Promise<void> {
    // Создаем UI для отладки
    this.ui.create({
      position: 'bottom-right',
      collapsible: true,
      sections: [
        'node-info',
        'peer-connections',
        'replication-status',
        'performance-metrics',
        'conflict-log'
      ]
    })

    // Начинаем сбор метрик
    this.startMetricsCollection()
  }

  private startMetricsCollection(): void {
    setInterval(() => {
      this.updateMetrics()
      this.ui.updateDisplay(this.metrics.getSnapshot())
    }, 1000)
  }

  private updateMetrics(): void {
    this.metrics.update({
      nodeId: this.nodeId,
      peerCount: this.getPeerCount(),
      pendingChanges: this.getPendingChangesCount(),
      syncLatency: this.getAverageSyncLatency(),
      storageUsage: this.getStorageUsage(),
      conflictCount: this.getConflictCount()
    })
  }
}
```

## Заключение

Браузерная репликация в Collection Store v6.0 обеспечивает:

1. **Автоматическую активацию** - браузер становится нодой при отсутствии подписок
2. **P2P синхронизацию** - прямой обмен данными между браузерами через WebRTC
3. **Offline-first архитектуру** - полная функциональность без сервера
4. **Intelligent conflict resolution** - умное разрешение конфликтов
5. **Partial replication** - оптимизация для ограниченных ресурсов браузера
6. **Cross-tab синхронизацию** - координация между вкладками
7. **Мониторинг и отладку** - инструменты для разработчиков

Это делает Collection Store v6.0 по-настоящему децентрализованной системой, где браузерные клиенты являются равноправными участниками репликации.

---
*Response generated using Claude Sonnet 4*