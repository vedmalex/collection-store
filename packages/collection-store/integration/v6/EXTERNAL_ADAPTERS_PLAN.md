# 🔗 External Storage Adapters Plan v6.0

## Размещение и интеграция

### Структура адаптеров
- **Базовая директория**: `@/src/adapters/`
- **MongoDB**: `@/src/adapters/mongodb/`
- **Google Sheets**: `@/src/adapters/google-sheets/`
- **Markdown**: `@/src/adapters/markdown/`
- **Фабрика адаптеров**: `@/src/adapters/AdapterFactory.ts`

### Технологические обновления
- **Zod v4**: Валидация конфигурации адаптеров
- **ESM модули**: Динамическая загрузка адаптеров
- **TypeScript 5.x**: Улучшенная типизация

## 🎯 Приоритеты разработки

1. **MongoDB Adapter** (Приоритет 1) - Change Streams, Oplog, Rate Limiting
2. **Google Sheets Adapter** (Приоритет 2) - API Limits, Batch Operations, Webhooks
3. **Markdown Adapter** (Приоритет 3) - File Watching, Git Integration, Frontmatter

---

## 🚀 MongoDB Adapter (Приоритет 1)

### Архитектура
```typescript
// @/src/adapters/mongodb/MongoDBAdapter.ts
export class MongoDBAdapter<T extends Item> implements IExternalStorageAdapter<T> {
  private mongoose: typeof import('mongoose')
  private model: any
  private changeStream: any
  private oplogWatcher?: OplogWatcher
  private config: MongoDBAdapterConfig
  private rateLimiter: RateLimiter

  constructor(config: MongoDBAdapterConfig) {
    this.config = {
      connectionString: config.connectionString,
      database: config.database,
      collection: config.collection,

      // Subscription mechanisms
      changeStream: config.changeStream ?? true,
      oplog: config.oplog ?? false,

      // Rate limiting
      rateLimits: {
        connectionsPerSecond: 10,
        operationsPerSecond: 1000,
        batchSize: 100,
        ...config.rateLimits
      },

      // Retry policy
      retryPolicy: {
        maxAttempts: 3,
        backoffMs: 1000,
        backoffMultiplier: 2,
        maxBackoffMs: 30000,
        ...config.retryPolicy
      },

      // Connection pooling
      pooling: {
        minPoolSize: 5,
        maxPoolSize: 50,
        maxIdleTimeMS: 30000,
        ...config.pooling
      }
    }

    this.rateLimiter = new RateLimiter(this.config.rateLimits)
  }
}
```

### Change Streams Implementation
```typescript
private async setupChangeStream(): Promise<void> {
  const pipeline = [
    {
      $match: {
        'fullDocument._deleted': { $ne: true },
        operationType: { $in: ['insert', 'update', 'delete', 'replace'] }
      }
    }
  ]

  this.changeStream = this.model.watch(pipeline, {
    fullDocument: 'updateLookup',
    fullDocumentBeforeChange: 'whenAvailable'
  })

  this.changeStream.on('change', (change: ChangeStreamDocument) => {
    this.handleChangeStreamEvent(change)
  })

  this.changeStream.on('error', (error: any) => {
    console.error('MongoDB Change Stream error:', error)
    this.scheduleChangeStreamReconnect()
  })

  this.changeStream.on('close', () => {
    console.warn('MongoDB Change Stream closed')
    this.scheduleChangeStreamReconnect()
  })
}

private handleChangeStreamEvent(change: ChangeStreamDocument): void {
  const externalChange: ExternalChange = {
    id: change._id.toString(),
    type: this.mapOperationType(change.operationType),
    source: 'mongodb',
    collection: this.collection.name,
    documentId: change.documentKey._id.toString(),
    data: change.fullDocument,
    previousData: change.fullDocumentBeforeChange,
    timestamp: change.clusterTime.getHighBits() * 1000,
    metadata: {
      operationType: change.operationType,
      resumeToken: change._id
    }
  }

  this.emitExternalChange(externalChange)
}
```

### Rate Limiting Implementation
```typescript
class RateLimiter {
  private tokens: number
  private lastRefill: number
  private readonly maxTokens: number
  private readonly refillRate: number

  constructor(config: RateLimitConfig) {
    this.maxTokens = config.operationsPerSecond
    this.refillRate = config.operationsPerSecond
    this.tokens = this.maxTokens
    this.lastRefill = Date.now()
  }

  async acquire(tokens: number = 1): Promise<void> {
    this.refillTokens()

    if (this.tokens >= tokens) {
      this.tokens -= tokens
      return
    }

    // Wait for tokens to be available
    const waitTime = (tokens - this.tokens) / this.refillRate * 1000
    await new Promise(resolve => setTimeout(resolve, waitTime))

    this.refillTokens()
    this.tokens -= tokens
  }

  private refillTokens(): void {
    const now = Date.now()
    const timePassed = (now - this.lastRefill) / 1000
    const tokensToAdd = timePassed * this.refillRate

    this.tokens = Math.min(this.maxTokens, this.tokens + tokensToAdd)
    this.lastRefill = now
  }
}
```

---

## 📊 Google Sheets Adapter (Приоритет 2)

### Архитектура с Rate Limits
```typescript
// @/src/adapters/google-sheets/GoogleSheetsAdapter.ts
export class GoogleSheetsAdapter<T extends Item> implements IExternalStorageAdapter<T> {
  private sheets: Map<string, any> = new Map()
  private config: GoogleSheetsAdapterConfig
  private rateLimiter: GoogleSheetsRateLimiter
  private quotaManager: QuotaManager
  private lastSyncTime: number = 0

  constructor(config: GoogleSheetsAdapterConfig) {
    this.config = {
      credentials: config.credentials,

      // Rate limits (Google Sheets API limits)
      rateLimits: {
        requestsPerMinute: 100,
        requestsPerSecond: 10,
        quotaPerDay: 100000,
        batchSize: 1000,
        readRequestsPerMinute: 300,
        writeRequestsPerMinute: 60,
        ...config.rateLimits
      },

      // Polling configuration
      polling: {
        interval: 30000, // 30 seconds
        enabled: true,
        smartPolling: true, // Only poll if sheet was modified
        ...config.polling
      },

      // Batch operations
      batching: {
        enabled: true,
        maxBatchSize: 1000,
        batchTimeout: 5000,
        ...config.batching
      },

      sheets: config.sheets
    }

    this.rateLimiter = new GoogleSheetsRateLimiter(this.config.rateLimits)
    this.quotaManager = new QuotaManager(this.config.rateLimits.quotaPerDay)
  }
}
```

### Batch Operations для Rate Limits
```typescript
class BatchOperationManager {
  private pendingOperations: Map<string, BatchOperation[]> = new Map()
  private batchTimers: Map<string, NodeJS.Timeout> = new Map()

  async addOperation(sheetId: string, operation: BatchOperation): Promise<any> {
    if (!this.pendingOperations.has(sheetId)) {
      this.pendingOperations.set(sheetId, [])
    }

    const operations = this.pendingOperations.get(sheetId)!
    operations.push(operation)

    // Schedule batch execution
    this.scheduleBatchExecution(sheetId)

    return operation.promise
  }

  private scheduleBatchExecution(sheetId: string): void {
    if (this.batchTimers.has(sheetId)) {
      return // Already scheduled
    }

    const timer = setTimeout(async () => {
      await this.executeBatch(sheetId)
      this.batchTimers.delete(sheetId)
    }, this.config.batching.batchTimeout)

    this.batchTimers.set(sheetId, timer)
  }

  private async executeBatch(sheetId: string): Promise<void> {
    const operations = this.pendingOperations.get(sheetId) || []
    if (operations.length === 0) return

    this.pendingOperations.set(sheetId, [])

    // Group operations by type
    const reads = operations.filter(op => op.type === 'read')
    const writes = operations.filter(op => op.type === 'write')

    // Execute batch reads
    if (reads.length > 0) {
      await this.executeBatchReads(sheetId, reads)
    }

    // Execute batch writes
    if (writes.length > 0) {
      await this.executeBatchWrites(sheetId, writes)
    }
  }
}
```

### Smart Polling с Change Detection
```typescript
private async checkForChanges(): Promise<void> {
  for (const [collectionName, sheetConfig] of this.config.sheets.entries()) {
    try {
      // Check if sheet was modified since last sync
      const lastModified = await this.getSheetLastModified(sheetConfig.id)

      if (lastModified <= this.lastSyncTime) {
        continue // No changes
      }

      // Rate limit check
      await this.rateLimiter.acquireReadToken()

      const changes = await this.detectChanges(sheetConfig.id, collectionName)

      for (const change of changes) {
        this.emitExternalChange(change)
      }

      this.lastSyncTime = lastModified

    } catch (error) {
      if (this.isQuotaExceededError(error)) {
        console.warn('Google Sheets quota exceeded, backing off...')
        await this.quotaManager.handleQuotaExceeded()
      } else {
        console.error(`Error checking changes for ${collectionName}:`, error)
      }
    }
  }
}
```

---

## 📝 Markdown Adapter (Приоритет 3)

### File Watching с Git Integration
```typescript
// v6/adapters/markdown/MarkdownAdapter.ts
export class MarkdownAdapter<T extends Item> implements IExternalStorageAdapter<T> {
  private watcher: any
  private gitWatcher?: GitWatcher
  private config: MarkdownAdapterConfig
  private frontmatterValidator?: FrontmatterValidator

  constructor(config: MarkdownAdapterConfig) {
    this.config = {
      directory: config.directory,
      watchForChanges: config.watchForChanges ?? true,

      // File patterns
      filePatterns: config.filePatterns ?? ['**/*.md', '**/*.mdx'],
      ignorePatterns: config.ignorePatterns ?? ['node_modules/**', '.git/**'],

      // Frontmatter configuration
      frontmatterSchema: config.frontmatterSchema,
      frontmatterValidation: config.frontmatterValidation ?? true,

      // Git integration
      gitIntegration: config.gitIntegration ?? false,
      gitHooks: config.gitHooks ?? ['post-commit', 'post-merge'],

      // Processing options
      processing: {
        parseContent: true,
        extractMetadata: true,
        generateSummary: false,
        ...config.processing
      }
    }

    if (this.config.frontmatterSchema) {
      this.frontmatterValidator = new FrontmatterValidator(this.config.frontmatterSchema)
    }
  }
}
```

### Git Integration
```typescript
class GitWatcher extends EventEmitter {
  private gitDir: string
  private hooks: Map<string, string> = new Map()

  constructor(directory: string) {
    super()
    this.gitDir = path.join(directory, '.git')
  }

  async setupGitHooks(hooks: string[]): Promise<void> {
    const hooksDir = path.join(this.gitDir, 'hooks')

    for (const hookName of hooks) {
      const hookPath = path.join(hooksDir, hookName)
      const hookScript = this.generateHookScript(hookName)

      await fs.writeFile(hookPath, hookScript, { mode: 0o755 })
      this.hooks.set(hookName, hookPath)
    }
  }

  private generateHookScript(hookName: string): string {
    return `#!/bin/sh
# Collection Store Git Hook
curl -X POST http://localhost:3000/git-webhook \\
  -H "Content-Type: application/json" \\
  -d '{
    "hook": "${hookName}",
    "repository": "$(pwd)",
    "timestamp": "$(date -u +%Y-%m-%dT%H:%M:%SZ)"
  }'
`
  }

  async getChangedFiles(since?: string): Promise<string[]> {
    const { execSync } = await import('child_process')

    const command = since
      ? `git diff --name-only ${since}..HEAD`
      : 'git diff --name-only HEAD~1..HEAD'

    const output = execSync(command, {
      cwd: path.dirname(this.gitDir),
      encoding: 'utf-8'
    })

    return output.trim().split('\n').filter(Boolean)
  }
}
```

### Frontmatter Validation
```typescript
class FrontmatterValidator {
  private schema: any

  constructor(schemaName: string) {
    this.schema = this.loadSchema(schemaName)
  }

  async validate(frontmatter: any, filePath: string): Promise<ValidationResult> {
    try {
      const result = this.schema.safeParse(frontmatter)

      if (!result.success) {
        return {
          valid: false,
          errors: result.error.issues.map(issue => ({
            path: issue.path.join('.'),
            message: issue.message,
            code: issue.code
          })),
          filePath
        }
      }

      return { valid: true, filePath }

    } catch (error) {
      return {
        valid: false,
        errors: [{ message: error.message, path: '', code: 'validation_error' }],
        filePath
      }
    }
  }

  private loadSchema(schemaName: string): any {
    const schemas = {
      'course-content': z.object({
        title: z.string(),
        description: z.string().optional(),
        author: z.string(),
        date: z.string().datetime(),
        tags: z.array(z.string()).optional(),
        category: z.string(),
        difficulty: z.enum(['beginner', 'intermediate', 'advanced']).optional(),
        duration: z.number().optional(),
        published: z.boolean().default(false)
      }),

      'assignment': z.object({
        title: z.string(),
        description: z.string(),
        dueDate: z.string().datetime(),
        maxPoints: z.number().positive(),
        courseId: z.string(),
        type: z.enum(['homework', 'quiz', 'project', 'exam']),
        instructions: z.string().optional()
      })
    }

    return schemas[schemaName] || z.object({})
  }
}
```

---

## 🔄 Subscription Mechanisms

### Unified Subscription Interface
```typescript
// v6/core/subscriptions/SubscriptionManager.ts
export class SubscriptionManager {
  private adapters: Map<string, IExternalStorageAdapter<any>> = new Map()
  private subscriptions: Map<string, Subscription> = new Map()

  async setupAdapterSubscription(
    adapterName: string,
    adapter: IExternalStorageAdapter<any>,
    config: SubscriptionConfig
  ): Promise<void> {
    this.adapters.set(adapterName, adapter)

    switch (config.mechanism) {
      case 'changestream':
        await this.setupChangeStreamSubscription(adapterName, adapter, config)
        break
      case 'oplog':
        await this.setupOplogSubscription(adapterName, adapter, config)
        break
      case 'polling':
        await this.setupPollingSubscription(adapterName, adapter, config)
        break
      case 'webhooks':
        await this.setupWebhookSubscription(adapterName, adapter, config)
        break
      case 'filewatcher':
        await this.setupFileWatcherSubscription(adapterName, adapter, config)
        break
    }
  }

  private async setupChangeStreamSubscription(
    adapterName: string,
    adapter: IExternalStorageAdapter<any>,
    config: SubscriptionConfig
  ): Promise<void> {
    if (!(adapter instanceof MongoDBAdapter)) {
      throw new Error('Change streams only supported for MongoDB adapters')
    }

    await adapter.enableChangeDetection()

    adapter.onExternalChange((change: ExternalChange) => {
      this.handleExternalChange(adapterName, change)
    })
  }

  private handleExternalChange(adapterName: string, change: ExternalChange): void {
    // Emit to Collection Store's subscription system
    this.emit('externalChange', {
      adapter: adapterName,
      change
    })

    // Handle conflict resolution if multiple adapters report changes
    this.handleConflictResolution(change)
  }
}
```

---

## 🎯 Конфигурационные примеры

### MongoDB Configuration
```yaml
adapters:
  mongodb:
    enabled: true
    priority: 1
    role: "primary"
    type: "mongodb"
    subscriptions:
      enabled: true
      mechanism: "changestream"
      batchSize: 100
    rateLimits:
      operationsPerSecond: 1000
      connectionsPerSecond: 10
      batchSize: 100
    retryPolicy:
      maxAttempts: 3
      backoffMs: 1000
      backoffMultiplier: 2
    config:
      connectionString: "mongodb://localhost:27017/lms"
      database: "lms"
      collections:
        courses: "courses"
        students: "students"
        assignments: "assignments"
      pooling:
        minPoolSize: 5
        maxPoolSize: 50
```

### Google Sheets Configuration
```yaml
adapters:
  googlesheets:
    enabled: true
    priority: 2
    role: "backup"
    type: "googlesheets"
    subscriptions:
      enabled: true
      mechanism: "polling"
      interval: 60000
    rateLimits:
      requestsPerMinute: 100
      quotaPerDay: 100000
      batchSize: 1000
    config:
      credentials:
        type: "service-account"
        serviceAccount: "./service-account.json"
      sheets:
        - id: "1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgvE2upms"
          collection: "grades"
          range: "A1:Z1000"
        - id: "1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgvE2upms"
          collection: "students"
          range: "Students!A1:Z1000"
```

### Markdown Configuration
```yaml
adapters:
  markdown:
    enabled: true
    priority: 3
    role: "readonly"
    type: "markdown"
    subscriptions:
      enabled: true
      mechanism: "filewatcher"
    config:
      directory: "./content"
      filePatterns:
        - "**/*.md"
        - "**/*.mdx"
      ignorePatterns:
        - "node_modules/**"
        - ".git/**"
      frontmatterSchema: "course-content"
      frontmatterValidation: true
      gitIntegration: true
      gitHooks:
        - "post-commit"
        - "post-merge"
      processing:
        parseContent: true
        extractMetadata: true
        generateSummary: false
```

---

*External Adapters v6.0 обеспечивают seamless интеграцию с внешними источниками данных через конфигурацию*