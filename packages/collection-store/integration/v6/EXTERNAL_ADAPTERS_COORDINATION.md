# External Adapters Coordination Plan v6.0

## Overview
Система внешних адаптеров с периодическим обновлением, координацией между узлами и полным аудитом для read-only коллекций.

## Read-Only Collections as Full Participants

### Full Collection Capabilities
**Принцип**: Read-only коллекции участвуют как полноправные коллекции во всех операциях кроме внутренних обновлений

```typescript
interface ReadOnlyCollectionCapabilities {
  // Full participation in system
  replication: true
  subscriptions: true
  queries: true
  transactions: true // read-only transactions
  indexing: true
  caching: true

  // Restricted operations
  internalUpdates: false

  // External updates only
  externalUpdates: true
  auditLogging: true
}

class ReadOnlyCollectionManager {
  async createReadOnlyCollection(config: ReadOnlyCollectionConfig): Promise<ReadOnlyCollection> {
    const collection = new ReadOnlyCollection(config)

    // Enable full participation
    await this.enableReplication(collection)
    await this.enableSubscriptions(collection)
    await this.enableIndexing(collection)
    await this.enableCaching(collection)

    // Setup audit logging
    await this.setupAuditLogging(collection)

    // Setup external source monitoring
    await this.setupExternalSourceMonitoring(collection)

    return collection
  }

  // Read-only collections participate in replication
  async setupReplication(collection: ReadOnlyCollection): Promise<void> {
    // Can be replicated to other nodes
    await this.replicationManager.addSource(collection, {
      mode: 'source-only', // Can be source but not target for internal updates
      allowExternalUpdates: true
    })

    // Can receive replicated data from other read-only collections
    await this.replicationManager.addTarget(collection, {
      sourceTypes: ['read-only', 'external-adapter']
    })
  }
}
```

### Audit Logging for External Updates
```typescript
interface ExternalUpdateAudit {
  id: string
  timestamp: number
  collection: string
  source: ExternalSourceInfo
  updateType: 'full-replace' | 'incremental' | 'merge'
  recordsAffected: number
  changes: ChangeLog[]
  checksum: string
  nodeId: string
}

interface ChangeLog {
  operation: 'insert' | 'update' | 'delete'
  documentId: string
  before?: any
  after?: any
  timestamp: number
}

class ExternalUpdateAuditor {
  async logExternalUpdate(
    collection: string,
    source: ExternalSourceInfo,
    changes: any[],
    updateType: string
  ): Promise<ExternalUpdateAudit> {

    const audit: ExternalUpdateAudit = {
      id: this.generateAuditId(),
      timestamp: Date.now(),
      collection,
      source,
      updateType: updateType as any,
      recordsAffected: changes.length,
      changes: await this.generateChangeLog(changes),
      checksum: await this.calculateChecksum(changes),
      nodeId: this.nodeId
    }

    // Store audit log
    await this.auditStorage.store(audit)

    // Replicate audit log to other nodes
    await this.replicateAuditLog(audit)

    // Trigger audit subscriptions
    await this.notifyAuditSubscribers(audit)

    return audit
  }

  async getAuditHistory(
    collection: string,
    timeRange?: { from: number, to: number }
  ): Promise<ExternalUpdateAudit[]> {
    return this.auditStorage.query({
      collection,
      timestamp: timeRange ? { $gte: timeRange.from, $lte: timeRange.to } : undefined
    })
  }
}
```

## External Adapter with Periodic Updates

### Adapter Configuration
```typescript
interface ExternalAdapterConfig {
  id: string
  name: string
  type: 'service' | 'file' | 'api' | 'database'

  // Connection configuration
  connection: ExternalConnectionConfig

  // Update configuration
  updateConfig: {
    // Periodic update function
    updateFunction: string // Function name or code
    interval: number // milliseconds

    // Coordination settings
    coordination: CoordinationConfig

    // Error handling
    errorHandling: ErrorHandlingConfig
  }

  // Target collections
  targetCollections: string[]

  // Authentication
  authentication?: AuthenticationConfig
}

interface CoordinationConfig {
  // Prevent simultaneous updates
  preventSimultaneous: boolean

  // Coordination strategy
  strategy: 'leader-election' | 'distributed-lock' | 'signal-based' | 'existing-system'

  // Lock timeout
  lockTimeout: number

  // Retry configuration
  retryConfig: {
    maxRetries: number
    retryInterval: number
    backoffStrategy: 'linear' | 'exponential'
  }
}
```

### Coordination Strategies

#### Option 1: Встроиться в существующую систему (Рекомендуется)
```typescript
class ExistingSystemCoordination {
  // Use existing replication/consensus mechanisms
  async coordinateUpdate(adapterId: string): Promise<UpdateCoordination> {
    // Use existing leader election from replication system
    const isLeader = await this.replicationManager.isLeader()

    if (isLeader) {
      // Leader node handles the update
      return {
        shouldUpdate: true,
        role: 'leader',
        reason: 'elected-leader'
      }
    }

    // Non-leader nodes wait for replication
    return {
      shouldUpdate: false,
      role: 'follower',
      reason: 'not-leader'
    }
  }

  // Integrate with existing subscription system
  async setupUpdateCoordination(adapter: ExternalAdapter): Promise<void> {
    // Subscribe to leader changes
    await this.replicationManager.subscribeToLeaderChanges((newLeader) => {
      if (newLeader === this.nodeId) {
        // Became leader, start adapter updates
        adapter.startPeriodicUpdates()
      } else {
        // No longer leader, stop adapter updates
        adapter.stopPeriodicUpdates()
      }
    })
  }
}
```

#### Option 2: Система сигналов
```typescript
class SignalBasedCoordination {
  private updateSignals = new Map<string, UpdateSignal>()

  async coordinateUpdate(adapterId: string): Promise<UpdateCoordination> {
    const signal = await this.acquireUpdateSignal(adapterId)

    if (signal.acquired) {
      return {
        shouldUpdate: true,
        signalId: signal.id,
        expiresAt: signal.expiresAt
      }
    }

    return {
      shouldUpdate: false,
      reason: 'signal-not-acquired',
      nextAttempt: signal.nextAvailableAt
    }
  }

  private async acquireUpdateSignal(adapterId: string): Promise<UpdateSignal> {
    const signalKey = `adapter-update:${adapterId}`

    // Try to acquire distributed signal
    const signal = await this.distributedSignalManager.acquire(signalKey, {
      ttl: this.config.lockTimeout,
      nodeId: this.nodeId
    })

    return signal
  }
}
```

#### Option 3: Distributed Lock
```typescript
class DistributedLockCoordination {
  async coordinateUpdate(adapterId: string): Promise<UpdateCoordination> {
    const lockKey = `external-adapter:${adapterId}`

    try {
      const lock = await this.distributedLock.acquire(lockKey, {
        ttl: this.config.lockTimeout,
        nodeId: this.nodeId
      })

      return {
        shouldUpdate: true,
        lockId: lock.id,
        expiresAt: lock.expiresAt
      }
    } catch (error) {
      return {
        shouldUpdate: false,
        reason: 'lock-not-acquired',
        error: error.message
      }
    }
  }
}
```

## External Adapter Implementation

### Configurable Update Function
```typescript
class ExternalAdapter {
  private config: ExternalAdapterConfig
  private coordinator: UpdateCoordinator
  private auditor: ExternalUpdateAuditor

  constructor(config: ExternalAdapterConfig) {
    this.config = config
    this.coordinator = this.createCoordinator(config.updateConfig.coordination)
    this.auditor = new ExternalUpdateAuditor()
  }

  async startPeriodicUpdates(): Promise<void> {
    // Setup periodic execution
    this.updateInterval = setInterval(async () => {
      await this.attemptUpdate()
    }, this.config.updateConfig.interval)
  }

  private async attemptUpdate(): Promise<void> {
    try {
      // Coordinate with other nodes
      const coordination = await this.coordinator.coordinateUpdate(this.config.id)

      if (!coordination.shouldUpdate) {
        this.logger.debug(`Skipping update: ${coordination.reason}`)
        return
      }

      // Execute update function
      const updateResult = await this.executeUpdateFunction()

      // Apply updates to target collections
      await this.applyUpdates(updateResult)

      // Log audit trail
      await this.auditor.logExternalUpdate(
        this.config.targetCollections[0], // Primary collection
        this.getSourceInfo(),
        updateResult.changes,
        updateResult.updateType
      )

      // Release coordination lock/signal
      await this.coordinator.releaseCoordination(coordination)

    } catch (error) {
      await this.handleUpdateError(error)
    }
  }

  private async executeUpdateFunction(): Promise<UpdateResult> {
    // Load and execute configured update function
    const updateFunction = await this.loadUpdateFunction(this.config.updateConfig.updateFunction)

    // Execute with connection and authentication
    const result = await updateFunction({
      connection: this.connection,
      authentication: this.authentication,
      lastUpdate: await this.getLastUpdateTimestamp()
    })

    return result
  }

  private async applyUpdates(updateResult: UpdateResult): Promise<void> {
    for (const collectionName of this.config.targetCollections) {
      const collection = await this.getReadOnlyCollection(collectionName)

      // Apply external update (only allowed way to update read-only collections)
      await collection.updateFromExternalSource(updateResult.data)

      // Trigger replication to other nodes
      await this.triggerReplication(collection, updateResult)
    }
  }
}
```

### Update Function Examples
```typescript
// Example: Google Sheets adapter function
const googleSheetsUpdateFunction = async (context: UpdateContext) => {
  const { connection, authentication, lastUpdate } = context

  // Fetch data from Google Sheets
  const sheets = google.sheets({ version: 'v4', auth: authentication.oauth })
  const response = await sheets.spreadsheets.values.get({
    spreadsheetId: connection.spreadsheetId,
    range: connection.range
  })

  // Transform data
  const data = response.data.values?.map(row => ({
    id: row[0],
    name: row[1],
    email: row[2],
    updatedAt: new Date().toISOString()
  }))

  return {
    data,
    updateType: 'full-replace',
    changes: data.length,
    metadata: {
      source: 'google-sheets',
      lastModified: response.headers['last-modified']
    }
  }
}

// Example: File system adapter function
const fileSystemUpdateFunction = async (context: UpdateContext) => {
  const { connection, lastUpdate } = context

  // Check file modification time
  const stats = await fs.stat(connection.filePath)

  if (stats.mtime.getTime() <= lastUpdate) {
    return { data: [], updateType: 'no-changes', changes: 0 }
  }

  // Read and parse file
  const content = await fs.readFile(connection.filePath, 'utf8')
  const data = JSON.parse(content)

  return {
    data,
    updateType: 'full-replace',
    changes: data.length,
    metadata: {
      source: 'file-system',
      filePath: connection.filePath,
      lastModified: stats.mtime.toISOString()
    }
  }
}
```

## Configuration Examples

### Quota Thresholds
```yaml
browser_quota_management:
  thresholds:
    warning: 80  # 80% usage warning
    critical: 95 # 95% usage critical action

  fallback_strategies:
    cache_mode:
      enabled: true
      retention_policy: "essential_only"

    offline_mode:
      enabled: true
      critical_data_only: true
```

### External Source Authentication
```yaml
external_sources:
  google_sheets:
    authentication:
      type: oauth2
      client_id: "${GOOGLE_CLIENT_ID}"
      client_secret: "${GOOGLE_CLIENT_SECRET}"
      scopes: ["https://www.googleapis.com/auth/spreadsheets.readonly"]

  external_api:
    authentication:
      type: jwt
      token: "${API_JWT_TOKEN}"
      refresh_url: "https://api.example.com/refresh"

  mongodb_external:
    authentication:
      type: connection_string
      connection: "mongodb://user:pass@external:27017/db"
```

### Cross-DB Query Caching
```yaml
cross_database_queries:
  caching:
    enabled: true
    strategy: "subscription-based"  # Same as collections
    ttl: 300000  # 5 minutes

    invalidation:
      on_source_change: true
      on_schema_change: true

    optimization:
      parallel_execution: true
      result_streaming: true
```

### External Adapter Configuration
```yaml
external_adapters:
  user_data_sync:
    type: service
    connection:
      url: "https://api.company.com/users"
      timeout: 30000

    update_config:
      update_function: "fetchCompanyUsers"
      interval: 300000  # 5 minutes

      coordination:
        strategy: "existing-system"  # Use existing replication leader
        prevent_simultaneous: true
        lock_timeout: 60000

    target_collections:
      - "external_users"

    authentication:
      type: oauth2
      client_id: "${COMPANY_API_CLIENT_ID}"
```

## Implementation Recommendation

**Рекомендую использовать "existing-system" стратегию** для координации:

### Преимущества:
1. **Переиспользование**: Использует существующую систему репликации/консенсуса
2. **Надежность**: Проверенные механизмы leader election
3. **Простота**: Не нужно создавать новую систему координации
4. **Интеграция**: Естественная интеграция с существующей архитектурой

### Реализация:
```typescript
// Integration with existing replication system
class ExternalAdapterCoordinator {
  async shouldUpdateAdapter(adapterId: string): Promise<boolean> {
    // Use existing leader election
    return await this.replicationManager.isLeader()
  }
}
```

Это решение обеспечивает:
- ✅ Предотвращение одновременных обновлений
- ✅ Использование существующей инфраструктуры
- ✅ Минимальную сложность
- ✅ Высокую надежность

Нужны ли дополнительные детали по какой-либо части системы?

---
*Response generated using Claude Sonnet 4*