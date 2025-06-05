# Conflict Resolution & Node Management Strategy v6.0

## Overview
Стратегии разрешения конфликтов, управления квотами браузерных узлов, обнаружения узлов и обработки offline режимов.

## Conflict Resolution Strategy

### Browser Nodes with Special Adapters
**Принцип**: Данные от browser nodes со специальными адаптерами добавляются по стандартным процедурам

```typescript
interface ConflictResolutionStrategy {
  // Browser nodes with special adapters treated as regular nodes
  browserNodePolicy: 'standard-procedures'

  // Conflict resolution based on node type
  resolutionRules: {
    'browser-with-adapters': 'standard-merge',
    'browser-without-adapters': 'defer-to-primary',
    'primary-to-primary': 'timestamp-based',
    'client-to-primary': 'defer-to-primary'
  }
}

class ConflictResolver {
  async resolveConflict(
    conflict: DataConflict,
    sourceNode: NodeConfig,
    targetNode: NodeConfig
  ): Promise<ConflictResolution> {

    // Browser nodes with special adapters use standard procedures
    if (sourceNode.role === NodeRole.BROWSER && sourceNode.hasSpecialAdapters) {
      return this.applyStandardMergeStrategy(conflict)
    }

    // Regular browser nodes defer to primary
    if (sourceNode.role === NodeRole.BROWSER && !sourceNode.hasSpecialAdapters) {
      return this.deferToPrimary(conflict, targetNode)
    }

    // Use existing conflict resolution mechanisms
    return this.existingConflictResolution.resolve(conflict, sourceNode, targetNode)
  }

  private async applyStandardMergeStrategy(conflict: DataConflict): Promise<ConflictResolution> {
    // Standard merge: additions are added, updates follow normal procedures
    const resolution: ConflictResolution = {
      strategy: 'standard-merge',
      actions: []
    }

    for (const change of conflict.changes) {
      switch (change.operation) {
        case 'insert':
          // Additions are always accepted from browser nodes with special adapters
          resolution.actions.push({
            type: 'accept',
            change: change,
            reason: 'browser-node-addition'
          })
          break

        case 'update':
        case 'delete':
          // Updates follow standard conflict resolution
          const standardResolution = await this.standardUpdateResolution(change)
          resolution.actions.push(standardResolution)
          break
      }
    }

    return resolution
  }
}
```

## Browser Storage Quota Management

### Automatic Quota Management
**Принцип**: При превышении лимитов автоматический переход в режим кэширования/подписки или offline

```typescript
interface QuotaManagementConfig {
  // Storage limits
  indexedDBLimit: number // bytes
  localStorageLimit: number // bytes

  // Automatic fallback strategies
  fallbackStrategies: {
    'cache-mode': QuotaCacheStrategy
    'subscription-mode': QuotaSubscriptionStrategy
    'offline-mode': QuotaOfflineStrategy
  }

  // Monitoring
  quotaMonitoring: {
    checkInterval: number
    warningThreshold: number // percentage
    criticalThreshold: number // percentage
  }
}

class BrowserQuotaManager {
  private quotaConfig: QuotaManagementConfig

  async checkAndManageQuota(): Promise<QuotaStatus> {
    const usage = await this.getCurrentUsage()
    const available = await this.getAvailableQuota()

    const usagePercentage = (usage / available) * 100

    if (usagePercentage > this.quotaConfig.quotaMonitoring.criticalThreshold) {
      return this.handleCriticalQuota(usage, available)
    }

    if (usagePercentage > this.quotaConfig.quotaMonitoring.warningThreshold) {
      return this.handleWarningQuota(usage, available)
    }

    return { status: 'ok', usage, available }
  }

  private async handleCriticalQuota(usage: number, available: number): Promise<QuotaStatus> {
    // Check if primary node is available
    const primaryAvailable = await this.checkPrimaryNodeAvailability()

    if (primaryAvailable) {
      // Switch to cache/subscription mode
      await this.switchToCacheMode()
      return {
        status: 'cache-mode',
        reason: 'quota-exceeded-primary-available',
        usage,
        available
      }
    } else {
      // Switch to offline mode
      await this.switchToOfflineMode()
      return {
        status: 'offline-mode',
        reason: 'quota-exceeded-no-primary',
        usage,
        available
      }
    }
  }

  private async switchToCacheMode(): Promise<void> {
    // Clear old cached data
    await this.clearOldCache()

    // Switch to subscription-based data loading
    this.dataLoadingStrategy = 'subscription-only'

    // Keep only essential data locally
    await this.retainEssentialDataOnly()
  }

  private async switchToOfflineMode(): Promise<void> {
    // Prepare for offline operation
    await this.prepareOfflineMode()

    // Keep critical data only
    await this.retainCriticalDataOnly()

    // Setup offline conflict tracking
    await this.setupOfflineConflictTracking()
  }
}
```

## Cross-Database Operations

### Unified Data Space with Cross-DB Transactions
**Принцип**: Все базы данных - часть одного пространства данных

```typescript
interface CrossDatabaseTransaction {
  id: string
  databases: string[]
  operations: CrossDatabaseOperation[]
  isolationLevel: TransactionIsolationLevel
  timeout: number
}

interface CrossDatabaseOperation {
  database: string
  collection: string
  operation: 'insert' | 'update' | 'delete' | 'query'
  data: any
  query?: MongoQuery
}

class CrossDatabaseTransactionManager {
  async executeTransaction(transaction: CrossDatabaseTransaction): Promise<TransactionResult> {
    // All databases are part of unified data space
    const coordinatorId = this.generateCoordinatorId()

    // Phase 1: Prepare all databases
    const prepareResults = await Promise.all(
      transaction.databases.map(db => this.prepareDatabase(db, transaction))
    )

    // Check if all databases can commit
    const canCommit = prepareResults.every(result => result.canCommit)

    if (canCommit) {
      // Phase 2: Commit all databases
      const commitResults = await Promise.all(
        transaction.databases.map(db => this.commitDatabase(db, transaction))
      )

      return {
        status: 'committed',
        results: commitResults,
        coordinatorId
      }
    } else {
      // Rollback all databases
      await Promise.all(
        transaction.databases.map(db => this.rollbackDatabase(db, transaction))
      )

      return {
        status: 'rolled-back',
        reason: 'prepare-phase-failed',
        coordinatorId
      }
    }
  }

  // Unified data space operations
  async queryAcrossDatabases(
    query: CrossDatabaseQuery
  ): Promise<CrossDatabaseQueryResult> {
    // Query multiple databases as single data space
    const results = await Promise.all(
      query.targets.map(target =>
        this.queryDatabase(target.database, target.collection, query.query)
      )
    )

    // Merge results from unified data space
    return this.mergeResults(results, query.mergeStrategy)
  }
}
```

## Node Discovery & Connection

### Browser Node Connection Strategy
**Принцип**: Подключение по строке соединения к первоначальному серверу

```typescript
interface BrowserNodeConnectionConfig {
  // Primary connection string
  connectionString: string

  // Fallback options
  fallbackServers?: string[]

  // Discovery options
  discoveryOptions: {
    autoDiscovery: boolean
    discoveryInterval: number
    maxRetries: number
  }

  // Connection options
  connectionOptions: {
    timeout: number
    retryInterval: number
    keepAlive: boolean
  }
}

class BrowserNodeDiscovery {
  async connectToNetwork(config: BrowserNodeConnectionConfig): Promise<BrowserConnection> {
    // Primary connection attempt
    try {
      const connection = await this.connectToPrimary(config.connectionString)

      // Register as browser node
      await this.registerBrowserNode(connection)

      return connection
    } catch (error) {
      // Try fallback servers
      if (config.fallbackServers?.length) {
        return this.tryFallbackServers(config.fallbackServers)
      }

      throw new Error(`Failed to connect to network: ${error.message}`)
    }
  }

  private async connectToPrimary(connectionString: string): Promise<BrowserConnection> {
    // Parse connection string
    const connectionParams = this.parseConnectionString(connectionString)

    // Establish WebSocket/HTTP connection
    const transport = await this.createTransport(connectionParams)

    // Create browser connection
    const connection = new BrowserConnection(transport, {
      role: NodeRole.BROWSER,
      capabilities: this.getBrowserCapabilities()
    })

    return connection
  }

  private async registerBrowserNode(connection: BrowserConnection): Promise<void> {
    // Register with primary server
    await connection.send('register-node', {
      nodeType: 'browser',
      capabilities: connection.capabilities,
      specialAdapters: this.getSpecialAdapters()
    })

    // Setup heartbeat
    this.setupHeartbeat(connection)
  }

  // Additional discovery methods for browser applications
  async discoverNearbyNodes(): Promise<NodeInfo[]> {
    // For browser apps, discovery is limited to:
    // 1. Connection string provided
    // 2. Fallback servers
    // 3. Local network discovery (if supported by browser)

    const discoveredNodes: NodeInfo[] = []

    // Try local network discovery (limited in browsers)
    if (this.supportsLocalDiscovery()) {
      const localNodes = await this.discoverLocalNodes()
      discoveredNodes.push(...localNodes)
    }

    return discoveredNodes
  }
}
```

## Offline Conflict Resolution

### Using Existing Conflict Resolution Mechanisms
**Принцип**: Использование существующих механизмов разрешения конфликтов

```typescript
class OfflineConflictManager {
  private existingResolver: ConflictResolver

  async handleOfflineConflicts(
    offlineChanges: OfflineChange[],
    onlineState: OnlineState
  ): Promise<ConflictResolutionResult> {

    // Use existing conflict resolution mechanisms
    const conflicts = await this.detectConflicts(offlineChanges, onlineState)

    const resolutions: ConflictResolution[] = []

    for (const conflict of conflicts) {
      // Apply existing conflict resolution strategy
      const resolution = await this.existingResolver.resolveConflict(
        conflict,
        { role: NodeRole.BROWSER }, // Source: browser node
        { role: NodeRole.PRIMARY }  // Target: primary node
      )

      resolutions.push(resolution)
    }

    return {
      totalConflicts: conflicts.length,
      resolutions,
      status: 'resolved'
    }
  }

  async trackOfflineChanges(change: DataChange): Promise<void> {
    // Track changes made while offline
    const offlineChange: OfflineChange = {
      id: this.generateChangeId(),
      timestamp: Date.now(),
      change,
      nodeId: this.nodeId,
      offline: true
    }

    // Store in offline change log
    await this.offlineChangeLog.add(offlineChange)
  }

  async syncOfflineChanges(): Promise<SyncResult> {
    // Get all offline changes
    const offlineChanges = await this.offlineChangeLog.getAll()

    if (offlineChanges.length === 0) {
      return { status: 'no-changes' }
    }

    // Apply existing sync mechanisms
    const syncResult = await this.existingSyncManager.sync(offlineChanges)

    // Handle any conflicts using existing resolution
    if (syncResult.conflicts?.length) {
      const conflictResolution = await this.handleOfflineConflicts(
        offlineChanges,
        syncResult.onlineState
      )

      return {
        status: 'synced-with-conflicts',
        conflicts: conflictResolution
      }
    }

    // Clear offline change log
    await this.offlineChangeLog.clear()

    return { status: 'synced' }
  }
}
```

## Read-Only Collections (External Sources)

### External Source Collections
**Новая фича**: Коллекции только для чтения, обновляемые извне

```typescript
interface ReadOnlyCollectionConfig extends CollectionConfig {
  // Mark as read-only (external source)
  readOnly: true

  // External source configuration
  externalSource: ExternalSourceConfig

  // Update policies
  updatePolicy: {
    // How often to check for external updates
    checkInterval: number

    // How to handle external updates
    updateStrategy: 'replace' | 'merge' | 'append'

    // Conflict resolution for external updates
    conflictResolution: 'external-wins' | 'merge-strategy'
  }

  // Replication settings (can replicate but not be updated)
  replication: ReadOnlyReplicationConfig
}

interface ExternalSourceConfig {
  type: 'mongodb' | 'google-sheets' | 'markdown' | 'api' | 'file'
  connection: string

  // Polling or push-based updates
  updateMode: 'poll' | 'push' | 'webhook'

  // Authentication for external source
  authentication?: ExternalAuthConfig
}

class ReadOnlyCollectionManager {
  async createReadOnlyCollection(
    config: ReadOnlyCollectionConfig
  ): Promise<ReadOnlyCollection> {

    // Validate read-only configuration
    this.validateReadOnlyConfig(config)

    // Create collection with read-only restrictions
    const collection = new ReadOnlyCollection(config)

    // Setup external source monitoring
    await this.setupExternalSourceMonitoring(collection)

    // Enable replication (read-only collections can be replicated)
    if (config.replication?.enabled) {
      await this.setupReadOnlyReplication(collection)
    }

    return collection
  }

  private async setupExternalSourceMonitoring(
    collection: ReadOnlyCollection
  ): Promise<void> {
    const source = collection.config.externalSource

    switch (source.updateMode) {
      case 'poll':
        // Setup polling for external changes
        this.setupPolling(collection, source)
        break

      case 'push':
        // Setup push notifications from external source
        this.setupPushNotifications(collection, source)
        break

      case 'webhook':
        // Setup webhook endpoint for external updates
        this.setupWebhook(collection, source)
        break
    }
  }

  // Prevent update operations on read-only collections
  async validateOperation(
    collection: string,
    operation: 'insert' | 'update' | 'delete' | 'query'
  ): Promise<void> {
    const collectionConfig = await this.getCollectionConfig(collection)

    if (collectionConfig.readOnly && ['insert', 'update', 'delete'].includes(operation)) {
      throw new Error(
        `Operation '${operation}' not allowed on read-only collection '${collection}'. ` +
        `This collection is updated from external source only.`
      )
    }
  }
}

class ReadOnlyCollection extends Collection {
  constructor(config: ReadOnlyCollectionConfig) {
    super(config)
    this.readOnly = true
  }

  // Override write operations to prevent updates
  async insert(document: any): Promise<never> {
    throw new Error('Insert operations not allowed on read-only collections')
  }

  async update(query: MongoQuery, update: any): Promise<never> {
    throw new Error('Update operations not allowed on read-only collections')
  }

  async delete(query: MongoQuery): Promise<never> {
    throw new Error('Delete operations not allowed on read-only collections')
  }

  // Allow read operations
  async find(query: MongoQuery): Promise<Document[]> {
    return super.find(query)
  }

  // Allow external updates
  async updateFromExternalSource(data: any[]): Promise<void> {
    // This is the only way to update read-only collections
    await this.replaceAllData(data)

    // Trigger replication if enabled
    if (this.config.replication?.enabled) {
      await this.triggerReplication()
    }

    // Notify subscribers
    await this.notifySubscribers('external-update', data)
  }
}
```

## Implementation Integration

Все эти стратегии интегрируются в существующий план разработки:

- **Phase 1**: Conflict resolution strategies и quota management
- **Phase 2**: Browser node discovery и connection management
- **Phase 3**: Read-only collections framework
- **Phase 4**: Offline conflict resolution integration

Нужны ли дополнительные уточнения по какой-либо из стратегий?

---
*Response generated using Claude Sonnet 4*