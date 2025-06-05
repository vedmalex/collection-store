# Database & Collection Configuration Plan v6.0

## Overview
Конфигурирование баз данных и коллекций с поддержкой репликации на уровне БД/коллекций, ролей узлов и специальной архитектуры для браузерных клиентов.

## Database-Level Configuration

### Database as Replication Unit
```typescript
interface DatabaseConfig {
  name: string
  collections: CollectionConfig[]
  replication: DatabaseReplicationConfig
  transactions: TransactionConfig
  subscriptions: SubscriptionConfig
  storage: StorageConfig
}

interface DatabaseReplicationConfig {
  // Database-level replication
  enabled: boolean
  mode: 'full' | 'selective' | 'filtered'

  // Replication targets
  targets: ReplicationTarget[]

  // Collection-specific overrides
  collectionOverrides: Map<string, CollectionReplicationConfig>

  // Conflict resolution at DB level
  conflictResolution: ConflictResolutionStrategy
}
```

### Unified Database Operations
```typescript
class DatabaseManager {
  // Database-level operations with same tools as collections
  async replicateDatabase(
    sourceDb: string,
    targetDb: string,
    config: DatabaseReplicationConfig
  ): Promise<DatabaseReplication>

  async subscribeToDatabase(
    database: string,
    callback: DatabaseChangeCallback,
    options: DatabaseSubscriptionOptions
  ): Promise<DatabaseSubscription>

  async executeTransaction(
    database: string,
    operations: DatabaseOperation[],
    options: TransactionOptions
  ): Promise<TransactionResult>

  // Collection management within database
  async configureCollection(
    database: string,
    collection: string,
    config: CollectionConfig
  ): Promise<void>
}
```

## Collection-Level Configuration

### Enhanced Collection Config
```typescript
interface CollectionConfig {
  name: string
  database: string

  // Schema and validation
  schema?: JSONSchema
  validation: ValidationConfig

  // Indexing
  indexes: IndexConfig[]

  // Replication (can override database settings)
  replication?: CollectionReplicationConfig

  // Transactions
  transactions: CollectionTransactionConfig

  // Subscriptions
  subscriptions: CollectionSubscriptionConfig

  // Storage adapter
  storage: CollectionStorageConfig
}

interface CollectionReplicationConfig {
  enabled: boolean
  mode: 'full' | 'partial' | 'filtered'

  // Replication filters
  filter?: MongoQuery
  projection?: ProjectionConfig

  // Conflict resolution
  conflictResolution: ConflictResolutionStrategy

  // Performance settings
  batchSize: number
  syncInterval: number
}
```

### Unified Collection Tools
```typescript
class CollectionManager {
  // Same tools for both database and collection level
  async replicateCollection(
    source: CollectionReference,
    target: CollectionReference,
    config: CollectionReplicationConfig
  ): Promise<CollectionReplication>

  async subscribeToCollection(
    collection: CollectionReference,
    query: MongoQuery,
    callback: CollectionChangeCallback
  ): Promise<CollectionSubscription>

  async executeCollectionTransaction(
    collection: CollectionReference,
    operations: CollectionOperation[],
    options: TransactionOptions
  ): Promise<TransactionResult>
}
```

## Node Roles & Architecture

### Node Role Hierarchy
```typescript
enum NodeRole {
  // Primary nodes - authoritative data sources
  PRIMARY = 'primary',

  // Secondary nodes - replicated data, can serve reads
  SECONDARY = 'secondary',

  // Client nodes - consumers, not authoritative
  CLIENT = 'client',

  // Browser nodes - special client nodes with limitations
  BROWSER = 'browser',

  // Adapter nodes - bridge to external systems
  ADAPTER = 'adapter'
}

interface NodeConfig {
  id: string
  role: NodeRole
  capabilities: NodeCapabilities
  replication: NodeReplicationConfig
  storage: NodeStorageConfig
}
```

### Client as Secondary Data Source
```typescript
class ClientNode {
  constructor(config: ClientNodeConfig) {
    // Clients always work as secondary sources
    this.role = NodeRole.CLIENT
    this.isAuthoritative = false
    this.canInitiateWrites = false
  }

  async connect(target: DatabaseReference | CollectionReference): Promise<ClientConnection> {
    const connection = new ClientConnection(target, {
      role: NodeRole.SECONDARY,
      readOnly: false, // Can write but not authoritative
      replicationMode: 'pull', // Always pull from primary
      conflictResolution: 'defer-to-primary'
    })

    // Setup as secondary data source
    await this.setupSecondaryReplication(connection)

    return connection
  }

  private async setupSecondaryReplication(connection: ClientConnection): Promise<void> {
    // Client receives updates from primary
    connection.subscribe('changes', (changes) => {
      this.applyChanges(changes, { source: 'primary' })
    })

    // Client can propose changes but they must be validated by primary
    connection.onWrite((operation) => {
      return this.proposeChange(operation, { requirePrimaryApproval: true })
    })
  }
}
```

## Browser Node Architecture

### Browser Node Limitations
```typescript
class BrowserNode extends ClientNode {
  constructor(config: BrowserNodeConfig) {
    super(config)
    this.role = NodeRole.BROWSER
    this.isAuthoritative = false
    this.requiresSpecialAdapters = true
  }

  // Browser nodes cannot be standalone data sources
  async connect(target: DatabaseReference | CollectionReference): Promise<BrowserConnection> {
    if (!this.hasSpecialAdapters()) {
      throw new Error('Browser nodes require special List/Storage adapters to be authoritative')
    }

    const connection = new BrowserConnection(target, {
      role: NodeRole.BROWSER,
      storage: this.getStorageAdapter(), // IndexedDB, localStorage, etc.
      replication: 'pull-only', // Cannot push without special adapters
      offline: true // Support offline mode
    })

    return connection
  }

  private hasSpecialAdapters(): boolean {
    return this.config.adapters?.some(adapter =>
      adapter.type === 'browser-storage' && adapter.authoritative === true
    )
  }
}
```

### Special Browser Adapters
```typescript
interface BrowserStorageAdapter extends IStorageAdapter {
  type: 'browser-storage'
  backend: 'indexeddb' | 'localstorage' | 'websql' | 'memory'

  // Special configuration for browser nodes to be authoritative
  authoritative: boolean

  // Sync capabilities
  syncCapabilities: {
    offline: boolean
    backgroundSync: boolean
    serviceWorker: boolean
    broadcastChannel: boolean
  }
}

class BrowserNodeManager {
  async configureBrowserAsNode(config: BrowserNodeConfig): Promise<BrowserNode> {
    // Only allow if special adapters are configured
    if (!config.specialAdapters?.length) {
      throw new Error('Browser nodes require special adapters to be configured as nodes')
    }

    const node = new BrowserNode(config)

    // Configure as nodal node with special adapters
    await this.setupNodalConfiguration(node, config.specialAdapters)

    return node
  }

  private async setupNodalConfiguration(
    node: BrowserNode,
    adapters: BrowserStorageAdapter[]
  ): Promise<void> {
    // Setup browser as nodal node
    node.role = NodeRole.ADAPTER // Elevated from BROWSER to ADAPTER
    node.isAuthoritative = true

    // Configure special storage adapters
    for (const adapter of adapters) {
      await node.addStorageAdapter(adapter)
    }

    // Enable nodal capabilities
    node.capabilities.canInitiateReplication = true
    node.capabilities.canServeReads = true
    node.capabilities.canAcceptWrites = true
  }
}
```

## Configuration Examples

### Database-Level Configuration
```yaml
# Database configuration with collection overrides
databases:
  lms_system:
    collections:
      - users
      - courses
      - assignments
      - grades

    replication:
      enabled: true
      mode: full
      targets:
        - type: mongodb
          connection: "mongodb://replica1:27017"
        - type: postgresql
          connection: "postgresql://backup:5432"

      # Collection-specific overrides
      collection_overrides:
        grades:
          mode: filtered
          filter: { "semester": { "$gte": "2024-01" } }

        users:
          mode: partial
          projection: { "password": 0, "internal_notes": 0 }

    transactions:
      isolation_level: "read_committed"
      timeout: 30000

    subscriptions:
      enabled: true
      batch_size: 100
      debounce_ms: 50
```

### Node Role Configuration
```yaml
# Node configurations
nodes:
  primary_server:
    role: primary
    capabilities:
      - authoritative_writes
      - serve_reads
      - initiate_replication
    storage:
      adapter: mongodb
      connection: "mongodb://primary:27017"

  client_app:
    role: client
    capabilities:
      - propose_writes
      - serve_cached_reads
    replication:
      mode: pull
      source: primary_server

  browser_client:
    role: browser
    capabilities:
      - offline_reads
      - propose_writes
    storage:
      adapter: indexeddb
      authoritative: false

    # Special configuration for nodal browser
    special_adapters:
      - type: browser-storage
        backend: indexeddb
        authoritative: true
        sync_capabilities:
          offline: true
          background_sync: true
          service_worker: true
```

### Collection-Specific Configuration
```yaml
# Collection with database inheritance and overrides
collections:
  users:
    database: lms_system

    # Inherits database replication but with overrides
    replication:
      mode: partial
      projection: { "password": 0 }
      conflict_resolution: "last_write_wins"

    # Collection-specific indexes
    indexes:
      - fields: ["email"]
        unique: true
      - fields: ["role", "department"]
        sparse: true

    # Collection-specific subscriptions
    subscriptions:
      real_time: true
      filters:
        - name: "active_users"
          query: { "status": "active" }
        - name: "admin_users"
          query: { "role": "admin" }
```

## Implementation Plan

### Phase 1: Database Configuration Framework (1.5 weeks)
- [ ] Database-level configuration interfaces
- [ ] Collection configuration with inheritance
- [ ] Configuration validation and merging
- [ ] Database manager implementation

### Phase 2: Node Role Architecture (2 weeks)
- [ ] Node role hierarchy implementation
- [ ] Client as secondary source logic
- [ ] Connection management with role enforcement
- [ ] Role-based capability restrictions

### Phase 3: Browser Node Specialization (1.5 weeks)
- [ ] Browser node limitations implementation
- [ ] Special adapter framework
- [ ] Nodal browser configuration
- [ ] Browser storage adapters (IndexedDB, etc.)

### Phase 4: Unified Tools Integration (1 week)
- [ ] Database-level replication using collection tools
- [ ] Database-level transactions
- [ ] Database-level subscriptions
- [ ] Cross-collection operations

## Technical Specifications

### Database Replication Engine
```typescript
class DatabaseReplicationEngine {
  async replicateDatabase(
    source: DatabaseReference,
    target: DatabaseReference,
    config: DatabaseReplicationConfig
  ): Promise<DatabaseReplication> {

    const collections = await this.getCollections(source)
    const replicationTasks: Promise<CollectionReplication>[] = []

    for (const collection of collections) {
      // Use same tools as collection replication
      const collectionConfig = this.mergeConfigs(
        config,
        config.collectionOverrides.get(collection.name)
      )

      const task = this.collectionReplicationEngine.replicate(
        { database: source.name, collection: collection.name },
        { database: target.name, collection: collection.name },
        collectionConfig
      )

      replicationTasks.push(task)
    }

    const results = await Promise.all(replicationTasks)
    return new DatabaseReplication(source, target, results)
  }
}
```

### Node Connection Manager
```typescript
class NodeConnectionManager {
  async establishConnection(
    node: NodeConfig,
    target: DatabaseReference | CollectionReference
  ): Promise<NodeConnection> {

    // Enforce role-based restrictions
    this.validateNodeCapabilities(node, target)

    const connection = new NodeConnection(node, target)

    // Configure based on node role
    switch (node.role) {
      case NodeRole.CLIENT:
        await this.configureClientConnection(connection)
        break

      case NodeRole.BROWSER:
        await this.configureBrowserConnection(connection)
        break

      case NodeRole.PRIMARY:
        await this.configurePrimaryConnection(connection)
        break
    }

    return connection
  }

  private async configureClientConnection(connection: NodeConnection): Promise<void> {
    // Client always works as secondary
    connection.role = NodeRole.SECONDARY
    connection.replicationMode = 'pull'
    connection.conflictResolution = 'defer-to-primary'

    // Setup secondary replication
    await connection.setupSecondaryReplication()
  }
}
```

## Success Criteria
- [ ] База данных и коллекции используют одни и те же инструменты
- [ ] Репликация работает на уровне БД и коллекций
- [ ] Клиенты автоматически работают как вторичные источники
- [ ] Браузерные узлы ограничены без специальных адаптеров
- [ ] Конфигурация поддерживает все уровни (БД/коллекция/узел)
- [ ] Unified API для всех операций независимо от уровня