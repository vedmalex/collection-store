# 🚀 Phase 3: Real-time Subscriptions & Notifications - Implementation Plan

## 📋 СТАТУС: ГОТОВ К СТАРТУ ✅

### **Проверка готовности:**
- ✅ **Phase 1**: Authentication & Authorization Foundation - ЗАВЕРШЕНА (120/120 тестов)
- ✅ **Phase 1.5**: Computed Attributes System - ЗАВЕРШЕНА (195/195 тестов)
- ✅ **Phase 1.6**: Stored Functions & Procedures - ЗАВЕРШЕНА (50/50 тестов)
- ✅ **Phase 2**: Advanced Authorization (RBAC + ABAC) - ЗАВЕРШЕНА (86/87 тестов)
- ✅ **Общая готовность**: 451/452 тестов (99.8% success rate)

---

## 🎯 Цели Phase 3

### **Основные задачи:**
1. **Real-time Subscription Engine** - подписки на изменения данных
2. **WebSocket & SSE Support** - поддержка WebSocket и Server-Sent Events
3. **Cross-tab Synchronization** - синхронизация между вкладками браузера
4. **Change Notification System** - система уведомлений об изменениях
5. **Client-side Data Management** - управление данными на клиенте
6. **Authorization Integration** - интеграция с системой авторизации

### **Ключевые принципы:**
- **Real-time First** - приоритет real-time обновлений
- **Protocol Agnostic** - поддержка WebSocket и SSE
- **Authorization Aware** - permission-based filtering
- **Performance Optimized** - высокая пропускная способность
- **Cross-tab Coordinated** - одна подписка на браузер

---

## 📅 Timeline: 2-3 недели (14-21 день)

### **Week 1: Core Subscription Engine**
- Day 1-3: Real-time Subscription Engine
- Day 4-5: WebSocket Manager
- Day 6-7: SSE Manager

### **Week 2: Advanced Features**
- Day 8-10: Cross-tab Synchronization
- Day 11-12: Change Notification System
- Day 13-14: Client-side Data Management

### **Week 3: Integration & Testing**
- Day 15-17: Full Integration Testing
- Day 18-19: Performance Optimization
- Day 20-21: Documentation & Examples

---

## 🏗️ Week 1: Core Subscription Engine

### **Day 1-3: Real-time Subscription Engine**

#### **1.1 Project Structure Setup**

```
src/subscriptions/
├── core/
│   ├── SubscriptionEngine.ts          # Main subscription engine
│   ├── SubscriptionManager.ts         # Subscription lifecycle
│   ├── QueryParser.ts                 # Subscription query parsing
│   ├── DataFilter.ts                  # Data filtering logic
│   └── index.ts                       # Core exports
├── connections/
│   ├── WebSocketManager.ts            # WebSocket connection handling
│   ├── SSEManager.ts                  # Server-Sent Events handling
│   ├── ConnectionPool.ts              # Connection pooling
│   ├── AuthenticationHandler.ts       # Connection authentication
│   └── index.ts                       # Connection exports
├── sync/
│   ├── CrossTabManager.ts             # Cross-tab synchronization
│   ├── BroadcastChannelHandler.ts     # BroadcastChannel API
│   ├── TabLifecycleManager.ts         # Tab lifecycle tracking
│   ├── SubscriptionDeduplicator.ts    # Subscription deduplication
│   └── index.ts                       # Sync exports
├── notifications/
│   ├── ChangeNotificationEngine.ts    # Change notification system
│   ├── DatabaseChangeDetector.ts      # Database change detection
│   ├── ChangeRouter.ts                # Change routing logic
│   ├── NotificationFormatter.ts       # Message formatting
│   └── index.ts                       # Notification exports
├── client/
│   ├── ClientSubscriptionManager.ts   # Client-side subscription management
│   ├── LocalDataCache.ts              # Local data caching
│   ├── ConflictResolver.ts            # Conflict resolution
│   ├── OfflineHandler.ts              # Offline support
│   └── index.ts                       # Client exports
├── interfaces/
│   ├── ISubscriptionEngine.ts         # Main interfaces
│   ├── IConnectionManager.ts          # Connection interfaces
│   ├── ICrossTabManager.ts            # Cross-tab interfaces
│   ├── types.ts                       # Core types
│   └── index.ts                       # Interface exports
├── tests/
│   ├── SubscriptionEngine.test.ts     # Engine tests
│   ├── WebSocketManager.test.ts       # WebSocket tests
│   ├── SSEManager.test.ts             # SSE tests
│   ├── CrossTabSync.test.ts           # Cross-tab tests
│   ├── ChangeNotifications.test.ts    # Notification tests
│   ├── ClientManagement.test.ts       # Client tests
│   └── Integration.test.ts            # Integration tests
└── index.ts                           # Main exports
```

#### **1.2 Core Subscription Engine**

```typescript
// core/SubscriptionEngine.ts
export class SubscriptionEngine implements ISubscriptionEngine {
  private subscriptions = new Map<string, Subscription>()
  private userSubscriptions = new Map<string, Set<string>>()
  private queryParser: QueryParser
  private dataFilter: DataFilter
  private authEngine: AuthorizationEngine
  private changeNotifier: ChangeNotificationEngine

  constructor(
    private database: CSDatabase,
    private authorizationEngine: AuthorizationEngine,
    private config: SubscriptionConfig
  ) {
    this.queryParser = new QueryParser(config.query)
    this.dataFilter = new DataFilter(config.filtering)
    this.authEngine = authorizationEngine
    this.changeNotifier = new ChangeNotificationEngine(database, config.notifications)
  }

  async subscribe(
    user: User,
    query: SubscriptionQuery,
    connection: Connection,
    context?: SubscriptionContext
  ): Promise<Subscription> {
    const startTime = Date.now()

    try {
      // 1. Parse and validate subscription query
      const parsedQuery = await this.queryParser.parse(query)

      // 2. Check authorization for subscription
      const authResult = await this.checkSubscriptionPermission(user, parsedQuery)
      if (!authResult.allowed) {
        throw new SubscriptionError('Subscription not authorized', {
          reason: authResult.reason,
          query: parsedQuery
        })
      }

      // 3. Create subscription
      const subscription: Subscription = {
        id: generateSubscriptionId(),
        userId: user.id,
        query: parsedQuery,
        connection,
        context: context || {},
        createdAt: new Date(),
        lastActivity: new Date(),
        status: 'active',
        metadata: {
          userAgent: context?.userAgent,
          ipAddress: context?.ipAddress,
          tabId: context?.tabId
        }
      }

      // 4. Store subscription
      this.subscriptions.set(subscription.id, subscription)

      // 5. Index by user
      if (!this.userSubscriptions.has(user.id)) {
        this.userSubscriptions.set(user.id, new Set())
      }
      this.userSubscriptions.get(user.id)!.add(subscription.id)

      // 6. Setup change notifications
      await this.changeNotifier.addSubscription(subscription)

      // 7. Send initial data if requested
      if (parsedQuery.includeInitialData) {
        await this.sendInitialData(subscription)
      }

      // 8. Audit log
      await this.auditLogger.log({
        action: 'subscription_created',
        userId: user.id,
        details: {
          subscriptionId: subscription.id,
          query: parsedQuery,
          creationTime: Date.now() - startTime
        }
      })

      return subscription
    } catch (error) {
      await this.auditLogger.log({
        action: 'subscription_creation_failed',
        userId: user.id,
        details: {
          error: error.message,
          query,
          creationTime: Date.now() - startTime
        }
      })

      throw error
    }
  }

  async unsubscribe(subscriptionId: string): Promise<void> {
    const subscription = this.subscriptions.get(subscriptionId)
    if (!subscription) {
      throw new SubscriptionError('Subscription not found', { subscriptionId })
    }

    try {
      // 1. Remove from change notifications
      await this.changeNotifier.removeSubscription(subscription)

      // 2. Remove from indexes
      this.subscriptions.delete(subscriptionId)
      const userSubs = this.userSubscriptions.get(subscription.userId)
      if (userSubs) {
        userSubs.delete(subscriptionId)
        if (userSubs.size === 0) {
          this.userSubscriptions.delete(subscription.userId)
        }
      }

      // 3. Close connection if needed
      if (subscription.connection.readyState === 1) { // OPEN
        subscription.connection.close(1000, 'Subscription ended')
      }

      // 4. Audit log
      await this.auditLogger.log({
        action: 'subscription_ended',
        userId: subscription.userId,
        details: {
          subscriptionId,
          duration: Date.now() - subscription.createdAt.getTime()
        }
      })
    } catch (error) {
      await this.auditLogger.log({
        action: 'subscription_unsubscribe_error',
        userId: subscription.userId,
        details: {
          subscriptionId,
          error: error.message
        }
      })

      throw error
    }
  }

  async publishChange(change: DataChange): Promise<void> {
    const startTime = Date.now()
    let notifiedSubscriptions = 0

    try {
      // 1. Find affected subscriptions
      const affectedSubscriptions = await this.findAffectedSubscriptions(change)

      // 2. Filter and notify each subscription
      for (const subscription of affectedSubscriptions) {
        try {
          // Check if user still has permission for this data
          const hasPermission = await this.checkDataPermission(
            subscription.userId,
            change,
            subscription.query
          )

          if (hasPermission) {
            // Filter data according to subscription query and permissions
            const filteredChange = await this.dataFilter.filterChange(
              change,
              subscription.query,
              subscription.userId
            )

            if (filteredChange) {
              await this.sendChangeNotification(subscription, filteredChange)
              notifiedSubscriptions++
            }
          }
        } catch (error) {
          console.error(`Error notifying subscription ${subscription.id}:`, error)
          // Continue with other subscriptions
        }
      }

      // 3. Update metrics
      this.updateMetrics({
        changesProcessed: 1,
        subscriptionsNotified: notifiedSubscriptions,
        processingTime: Date.now() - startTime
      })
    } catch (error) {
      console.error('Error publishing change:', error)
      throw error
    }
  }

  private async checkSubscriptionPermission(
    user: User,
    query: ParsedSubscriptionQuery
  ): Promise<AuthorizationResult> {
    // Check permission for each resource in the subscription query
    const resource: ResourceDescriptor = {
      type: query.resourceType,
      database: query.database,
      collection: query.collection,
      documentId: query.documentId,
      fieldPath: query.fieldPath
    }

    return await this.authEngine.checkPermission(
      user,
      resource,
      'subscribe',
      { subscription: true }
    )
  }

  private async findAffectedSubscriptions(change: DataChange): Promise<Subscription[]> {
    const affected: Subscription[] = []

    for (const subscription of this.subscriptions.values()) {
      if (await this.isSubscriptionAffected(subscription, change)) {
        affected.push(subscription)
      }
    }

    return affected
  }

  private async isSubscriptionAffected(
    subscription: Subscription,
    change: DataChange
  ): Promise<boolean> {
    const query = subscription.query

    // Check resource type match
    if (query.resourceType !== change.resourceType) {
      return false
    }

    // Check database match
    if (query.database && query.database !== change.database) {
      return false
    }

    // Check collection match
    if (query.collection && query.collection !== change.collection) {
      return false
    }

    // Check document match
    if (query.documentId && query.documentId !== change.documentId) {
      return false
    }

    // Check field match
    if (query.fieldPath && !change.affectedFields?.includes(query.fieldPath)) {
      return false
    }

    // Check custom filters
    if (query.filters) {
      return await this.queryParser.matchesFilters(change, query.filters)
    }

    return true
  }
}
```

#### **1.3 Subscription Query Parser**

```typescript
// core/QueryParser.ts
export class QueryParser {
  constructor(private config: QueryParserConfig) {}

  async parse(query: SubscriptionQuery): Promise<ParsedSubscriptionQuery> {
    const parsed: ParsedSubscriptionQuery = {
      id: generateQueryId(),
      resourceType: query.resourceType || 'document',
      database: query.database,
      collection: query.collection,
      documentId: query.documentId,
      fieldPath: query.fieldPath,
      filters: [],
      options: {
        includeInitialData: query.includeInitialData ?? false,
        includeMetadata: query.includeMetadata ?? true,
        batchSize: query.batchSize ?? 100,
        throttleMs: query.throttleMs ?? 0
      }
    }

    // Parse filters
    if (query.filters) {
      parsed.filters = await this.parseFilters(query.filters)
    }

    // Validate query
    await this.validateQuery(parsed)

    return parsed
  }

  private async parseFilters(filters: SubscriptionFilter[]): Promise<ParsedFilter[]> {
    const parsed: ParsedFilter[] = []

    for (const filter of filters) {
      switch (filter.type) {
        case 'field':
          parsed.push(await this.parseFieldFilter(filter))
          break
        case 'user':
          parsed.push(await this.parseUserFilter(filter))
          break
        case 'custom':
          parsed.push(await this.parseCustomFilter(filter))
          break
        default:
          throw new QueryParseError(`Unknown filter type: ${filter.type}`)
      }
    }

    return parsed
  }

  private async parseFieldFilter(filter: FieldFilter): Promise<ParsedFieldFilter> {
    return {
      type: 'field',
      field: filter.field,
      operator: filter.operator,
      value: filter.value,
      caseSensitive: filter.caseSensitive ?? false
    }
  }

  async matchesFilters(change: DataChange, filters: ParsedFilter[]): Promise<boolean> {
    for (const filter of filters) {
      if (!(await this.matchesFilter(change, filter))) {
        return false
      }
    }
    return true
  }

  private async matchesFilter(change: DataChange, filter: ParsedFilter): Promise<boolean> {
    switch (filter.type) {
      case 'field':
        return this.matchesFieldFilter(change, filter as ParsedFieldFilter)
      case 'user':
        return this.matchesUserFilter(change, filter as ParsedUserFilter)
      case 'custom':
        return this.matchesCustomFilter(change, filter as ParsedCustomFilter)
      default:
        return false
    }
  }
}
```

### **Day 4-5: WebSocket Manager**

#### **2.1 WebSocket Connection Manager**

```typescript
// connections/WebSocketManager.ts
export class WebSocketManager implements IConnectionManager {
  private connections = new Map<string, WebSocketConnection>()
  private userConnections = new Map<string, Set<string>>()
  private authHandler: AuthenticationHandler
  private subscriptionEngine: SubscriptionEngine

  constructor(
    private server: WebSocketServer,
    private authEngine: AuthorizationEngine,
    private config: WebSocketConfig
  ) {
    this.authHandler = new AuthenticationHandler(authEngine, config.auth)
    this.setupServer()
  }

  private setupServer(): void {
    this.server.on('connection', async (ws: WebSocket, request: IncomingMessage) => {
      try {
        await this.handleConnection(ws, request)
      } catch (error) {
        console.error('WebSocket connection error:', error)
        ws.close(1011, 'Internal server error')
      }
    })
  }

  async handleConnection(ws: WebSocket, request: IncomingMessage): Promise<void> {
    const connectionId = generateConnectionId()
    const startTime = Date.now()

    try {
      // 1. Extract authentication token
      const token = this.extractAuthToken(request)
      if (!token) {
        ws.close(1008, 'Authentication required')
        return
      }

      // 2. Authenticate user
      const user = await this.authHandler.authenticateConnection(token)
      if (!user) {
        ws.close(1008, 'Authentication failed')
        return
      }

      // 3. Create connection object
      const connection: WebSocketConnection = {
        id: connectionId,
        userId: user.id,
        user,
        socket: ws,
        authenticated: true,
        createdAt: new Date(),
        lastActivity: new Date(),
        subscriptions: new Set(),
        metadata: {
          userAgent: request.headers['user-agent'],
          ipAddress: this.getClientIP(request),
          protocol: 'websocket'
        }
      }

      // 4. Store connection
      this.connections.set(connectionId, connection)
      if (!this.userConnections.has(user.id)) {
        this.userConnections.set(user.id, new Set())
      }
      this.userConnections.get(user.id)!.add(connectionId)

      // 5. Setup message handlers
      this.setupMessageHandlers(connection)

      // 6. Setup connection lifecycle
      this.setupConnectionLifecycle(connection)

      // 7. Send welcome message
      await this.sendMessage(connection, {
        type: 'connection_established',
        data: {
          connectionId,
          userId: user.id,
          serverTime: new Date().toISOString()
        }
      })

      // 8. Audit log
      await this.auditLogger.log({
        action: 'websocket_connection_established',
        userId: user.id,
        details: {
          connectionId,
          userAgent: connection.metadata.userAgent,
          ipAddress: connection.metadata.ipAddress,
          connectionTime: Date.now() - startTime
        }
      })
    } catch (error) {
      await this.auditLogger.log({
        action: 'websocket_connection_failed',
        details: {
          error: error.message,
          userAgent: request.headers['user-agent'],
          ipAddress: this.getClientIP(request)
        }
      })

      ws.close(1011, 'Connection setup failed')
    }
  }

  private setupMessageHandlers(connection: WebSocketConnection): void {
    connection.socket.on('message', async (data: Buffer) => {
      try {
        const message = JSON.parse(data.toString()) as WebSocketMessage
        await this.handleMessage(connection, message)
      } catch (error) {
        console.error(`Message handling error for connection ${connection.id}:`, error)
        await this.sendError(connection, 'Invalid message format')
      }
    })
  }

  private async handleMessage(
    connection: WebSocketConnection,
    message: WebSocketMessage
  ): Promise<void> {
    // Update last activity
    connection.lastActivity = new Date()

    switch (message.type) {
      case 'subscribe':
        await this.handleSubscribe(connection, message.data)
        break
      case 'unsubscribe':
        await this.handleUnsubscribe(connection, message.data)
        break
      case 'ping':
        await this.handlePing(connection, message.data)
        break
      case 'get_subscriptions':
        await this.handleGetSubscriptions(connection)
        break
      default:
        await this.sendError(connection, `Unknown message type: ${message.type}`)
    }
  }

  private async handleSubscribe(
    connection: WebSocketConnection,
    data: SubscriptionRequest
  ): Promise<void> {
    try {
      const subscription = await this.subscriptionEngine.subscribe(
        connection.user,
        data.query,
        connection,
        {
          tabId: data.tabId,
          userAgent: connection.metadata.userAgent,
          ipAddress: connection.metadata.ipAddress
        }
      )

      connection.subscriptions.add(subscription.id)

      await this.sendMessage(connection, {
        type: 'subscription_created',
        data: {
          subscriptionId: subscription.id,
          query: subscription.query
        }
      })
    } catch (error) {
      await this.sendError(connection, `Subscription failed: ${error.message}`)
    }
  }

  async broadcastToSubscriptions(change: DataChange): Promise<void> {
    // This will be called by the SubscriptionEngine
    // when it needs to send notifications to WebSocket connections
    const affectedConnections = await this.findAffectedConnections(change)

    for (const connection of affectedConnections) {
      try {
        await this.sendMessage(connection, {
          type: 'data_change',
          data: change
        })
      } catch (error) {
        console.error(`Error broadcasting to connection ${connection.id}:`, error)
      }
    }
  }

  private async sendMessage(
    connection: WebSocketConnection,
    message: WebSocketMessage
  ): Promise<void> {
    if (connection.socket.readyState === WebSocket.OPEN) {
      connection.socket.send(JSON.stringify(message))
    }
  }
}
```

### **Day 6-7: SSE Manager**

#### **3.1 Server-Sent Events Manager**

```typescript
// connections/SSEManager.ts
export class SSEManager implements IConnectionManager {
  private connections = new Map<string, SSEConnection>()
  private userConnections = new Map<string, Set<string>>()
  private authHandler: AuthenticationHandler

  constructor(
    private authEngine: AuthorizationEngine,
    private config: SSEConfig
  ) {
    this.authHandler = new AuthenticationHandler(authEngine, config.auth)
  }

  async handleConnection(request: Request, response: Response): Promise<void> {
    const connectionId = generateConnectionId()
    const startTime = Date.now()

    try {
      // 1. Setup SSE headers
      response.writeHead(200, {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Cache-Control'
      })

      // 2. Extract and validate auth token
      const token = this.extractAuthToken(request)
      if (!token) {
        this.sendSSEError(response, 'Authentication required')
        response.end()
        return
      }

      // 3. Authenticate user
      const user = await this.authHandler.authenticateConnection(token)
      if (!user) {
        this.sendSSEError(response, 'Authentication failed')
        response.end()
        return
      }

      // 4. Create SSE connection
      const connection: SSEConnection = {
        id: connectionId,
        userId: user.id,
        user,
        response,
        authenticated: true,
        createdAt: new Date(),
        lastActivity: new Date(),
        subscriptions: new Set(),
        metadata: {
          userAgent: request.headers['user-agent'],
          ipAddress: this.getClientIP(request),
          protocol: 'sse'
        }
      }

      // 5. Store connection
      this.connections.set(connectionId, connection)
      if (!this.userConnections.has(user.id)) {
        this.userConnections.set(user.id, new Set())
      }
      this.userConnections.get(user.id)!.add(connectionId)

      // 6. Setup connection lifecycle
      this.setupConnectionLifecycle(connection)

      // 7. Send welcome event
      await this.sendSSEEvent(connection, 'connection_established', {
        connectionId,
        userId: user.id,
        serverTime: new Date().toISOString()
      })

      // 8. Setup heartbeat
      this.setupHeartbeat(connection)

      // 9. Audit log
      await this.auditLogger.log({
        action: 'sse_connection_established',
        userId: user.id,
        details: {
          connectionId,
          userAgent: connection.metadata.userAgent,
          ipAddress: connection.metadata.ipAddress,
          connectionTime: Date.now() - startTime
        }
      })
    } catch (error) {
      await this.auditLogger.log({
        action: 'sse_connection_failed',
        details: {
          error: error.message,
          userAgent: request.headers['user-agent'],
          ipAddress: this.getClientIP(request)
        }
      })

      response.end()
    }
  }

  private async sendSSEEvent(
    connection: SSEConnection,
    event: string,
    data: any
  ): Promise<void> {
    if (!connection.response.destroyed) {
      const eventData = `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`
      connection.response.write(eventData)
    }
  }

  private setupHeartbeat(connection: SSEConnection): void {
    const heartbeatInterval = setInterval(async () => {
      if (connection.response.destroyed) {
        clearInterval(heartbeatInterval)
        return
      }

      try {
        await this.sendSSEEvent(connection, 'heartbeat', {
          timestamp: new Date().toISOString()
        })
      } catch (error) {
        console.error(`Heartbeat failed for connection ${connection.id}:`, error)
        clearInterval(heartbeatInterval)
        this.closeConnection(connection)
      }
    }, this.config.heartbeatInterval || 30000)
  }

  async broadcastToSubscriptions(change: DataChange): Promise<void> {
    const affectedConnections = await this.findAffectedConnections(change)

    for (const connection of affectedConnections) {
      try {
        await this.sendSSEEvent(connection, 'data_change', change)
      } catch (error) {
        console.error(`Error broadcasting to SSE connection ${connection.id}:`, error)
      }
    }
  }

  // Chunked encoding support for large datasets
  async sendLargeDataset(
    connection: SSEConnection,
    data: any[],
    chunkSize: number = 100
  ): Promise<void> {
    const chunks = this.chunkArray(data, chunkSize)

    for (let i = 0; i < chunks.length; i++) {
      const chunk = chunks[i]
      const isLast = i === chunks.length - 1

      await this.sendSSEEvent(connection, 'data_chunk', {
        chunk,
        chunkIndex: i,
        totalChunks: chunks.length,
        isLast
      })

      // Small delay to prevent overwhelming the client
      if (!isLast) {
        await new Promise(resolve => setTimeout(resolve, 10))
      }
    }
  }
}
```

---

## 📊 Expected Results Week 1

### **Deliverables:**
1. **Real-time Subscription Engine** - core subscription management
2. **WebSocket Manager** - WebSocket connection handling
3. **SSE Manager** - Server-Sent Events support
4. **Query Parser** - subscription query parsing и validation
5. **Authentication Integration** - JWT-based connection auth
6. **Test Suite** - 50+ тестов покрывающих core functionality

### **Performance Targets:**
- **Subscription Creation**: < 10ms per subscription
- **Connection Handling**: 100+ concurrent connections
- **Message Routing**: < 5ms per message
- **Memory Usage**: < 50MB для core engine
- **Authentication**: < 2ms per connection auth

### **Security Features:**
- ✅ JWT-based WebSocket authentication
- ✅ Permission-based subscription filtering
- ✅ Connection rate limiting
- ✅ Audit logging для all subscription events
- ✅ Secure message validation

---

## 🚀 Ready to Start Week 1!

Все компоненты Phase 1, 1.5, 1.6 и 2 успешно завершены с 99.8% test success rate. Система готова для реализации real-time subscriptions с полной интеграцией существующих компонентов.

**Следующий шаг**: Начать с Day 1 - создание Real-time Subscription Engine.

---

*Response generated using Claude Sonnet 4*