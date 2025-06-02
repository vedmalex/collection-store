# 🚀 Collection Store v6.0 - User Management & Subscription System

## 📋 Общий план разработки

Основываясь на анализе требований и следуя правилам DEVELOPMENT_RULES.md, создаем поэтапный план разработки enterprise-grade системы управления пользователями и подписок.

## 🎯 Архитектурные решения

### **Выбранная архитектура: Монолитная с модульным дизайном**
- ✅ Все компоненты в одном Collection Store пакете
- ✅ Модульная внутренняя структура для будущего выделения сервисов
- ✅ Единые ACID транзакции между компонентами
- ✅ Простота развертывания и отладки

### **Ключевые принципы**
- **Принцип наименьших привилегий** - пользователи получают только необходимые права
- **Deny by default** - атрибуты имеют приоритет над ролями при запрете доступа
- **Configurable security** - все параметры безопасности настраиваются
- **Performance first** - кэширование и оптимизация по умолчанию

---

## 🔄 Phase 1: Authentication & Authorization Foundation ✅

### **Цели фазы:**
- Создать встроенную систему аутентификации с возможностью внешней интеграции
- Реализовать базовый RBAC с иерархией ролей
- Настроить JWT с гибкими алгоритмами
- Обеспечить audit logging

### **1.1 Core Authentication System**

#### **Компоненты:**
```typescript
interface IAuthManager {
  // Authentication
  authenticate(credentials: AuthCredentials): Promise<AuthResult>
  validateToken(token: string): Promise<TokenValidation>
  refreshToken(refreshToken: string): Promise<TokenPair>
  revokeToken(tokenId: string): Promise<void>

  // User management
  createUser(userData: CreateUserData): Promise<User>
  updateUser(userId: string, updates: Partial<User>): Promise<User>
  deleteUser(userId: string): Promise<void>

  // External auth integration
  configureExternalAuth(config: ExternalAuthConfig): void
}

interface AuthCredentials {
  type: 'email_password' | 'oauth' | 'api_key'
  email?: string
  password?: string
  oauthToken?: string
  apiKey?: string
  context?: AuthContext // IP, region, time, etc.
}

interface AuthContext {
  ip: string
  userAgent: string
  region?: string
  timestamp: number
  customAttributes?: Record<string, any>
}
```

#### **Реализация:**
- **AuthManager** - основной класс управления аутентификацией
- **TokenManager** - управление JWT токенами с ротацией
- **ExternalAuthAdapter** - интеграция с BetterAuth и другими провайдерами
- **AuditLogger** - логирование всех операций аутентификации

### **1.2 JWT Security System**

#### **Конфигурация:**
```typescript
interface JWTConfig {
  algorithm: 'ES256' | 'RS256' | 'HS256' // ES256 по умолчанию
  accessTokenTTL: number // 15 минут по умолчанию
  refreshTokenTTL: number // 7 дней по умолчанию
  rotateRefreshTokens: boolean // true по умолчанию

  storage: {
    client: 'httpOnly_cookies' | 'localStorage' | 'memory' // выбор пользователя
    server: 'collection_store' | 'external_db' // выбор пользователя
  }

  security: {
    enableRevocation: boolean // true по умолчанию
    maxConcurrentSessions: number // 5 по умолчанию
    requireSecureContext: boolean // true в production
  }
}
```

### **1.3 Basic RBAC System**

#### **Модель данных:**
```typescript
interface User {
  id: string
  email: string
  passwordHash: string
  roles: string[]
  attributes: Record<string, any>
  createdAt: Date
  lastLoginAt?: Date
  isActive: boolean
}

interface Role {
  id: string
  name: string
  description: string
  permissions: Permission[]
  parentRoles: string[] // иерархия ролей
  isSystemRole: boolean
}

interface Permission {
  resource: string // database, collection, document, field
  action: string // read, write, delete, admin
  conditions?: string[] // динамические условия
}
```

### **1.4 Audit Logging System**

#### **Структура логов:**
```typescript
interface AuditLog {
  id: string
  timestamp: Date
  userId?: string
  action: string
  resource: string
  result: 'success' | 'failure' | 'denied'
  context: AuthContext
  details?: Record<string, any>
}

interface AuditConfig {
  enabled: boolean // true по умолчанию
  retention: {
    type: 'time' | 'count'
    value: number // 90 дней или 1M записей
  }
  logLevel: 'minimal' | 'standard' | 'detailed'
}
```

---

## 🔄 Phase 1.5: Computed Attributes System ✅

### **Цели фазы:**
- Создать систему вычисляемых атрибутов для схем и авторизации
- Реализовать контекстные вычисления с доступом к данным
- Обеспечить кэширование и инвалидацию
- Интегрировать с системой авторизации

### **1.5.1 Core Computed Attributes Engine**

#### **Архитектура:**
```typescript
interface IComputedAttributeEngine {
  // Attribute management
  registerAttribute(definition: ComputedAttributeDefinition): void
  unregisterAttribute(attributeId: string): void

  // Computation
  computeAttribute(
    attributeId: string,
    context: ComputationContext
  ): Promise<any>

  computeAllAttributes(
    target: 'user' | 'document' | 'collection',
    targetId: string,
    context: ComputationContext
  ): Promise<Record<string, any>>

  // Cache management
  invalidateCache(attributeId: string, targetId?: string): Promise<void>
  clearAllCache(): Promise<void>
  getCacheStats(): ComputedAttributeCacheStats
}

interface ComputedAttributeDefinition {
  id: string
  name: string
  description: string

  // Target specification
  targetType: 'user' | 'document' | 'collection' | 'database'
  targetCollection?: string // для document-level атрибутов

  // Computation logic
  computeFunction: ComputeFunction
  dependencies: AttributeDependency[]

  // Caching strategy
  caching: {
    enabled: boolean
    ttl: number // seconds
    invalidateOn: InvalidationTrigger[]
  }

  // Security
  security: {
    allowExternalRequests: boolean
    timeout: number // milliseconds
    maxMemoryUsage: number // bytes
  }

  // Metadata
  createdBy: string
  createdAt: Date
  isActive: boolean
}

type ComputeFunction = (context: ComputationContext) => Promise<any>

interface ComputationContext {
  // Target data
  target: any // current user/document/collection
  targetId: string
  targetType: 'user' | 'document' | 'collection' | 'database'

  // Database access
  database: CSDatabase
  currentCollection?: Collection<any>

  // External services
  httpClient?: HttpClient

  // System context
  timestamp: number
  nodeId: string

  // User context (for authorization)
  currentUser?: User
  authContext?: AuthContext

  // Custom context
  customData?: Record<string, any>
}

interface AttributeDependency {
  type: 'field' | 'collection' | 'external_api' | 'system'
  source: string // field path, collection name, API endpoint, etc.
  invalidateOnChange: boolean
}

interface InvalidationTrigger {
  type: 'field_change' | 'document_change' | 'collection_change' | 'time_based' | 'external_event'
  source: string
  condition?: string // optional condition for invalidation
}
```

### **1.5.2 Schema Integration**

#### **Расширение схемы коллекций:**
```typescript
interface CollectionSchemaWithComputedAttributes extends CollectionSchema {
  computedAttributes?: {
    [attributeName: string]: ComputedAttributeDefinition
  }
}

// Пример использования в схеме
const userSchema: CollectionSchemaWithComputedAttributes = {
  fields: {
    id: { type: 'string', required: true },
    email: { type: 'string', required: true },
    department: { type: 'string' },
    salary: { type: 'number' }
  },

  computedAttributes: {
    // Вычисляемый атрибут на основе данных пользователя
    accessLevel: {
      id: 'user-access-level',
      name: 'User Access Level',
      description: 'Computed access level based on department and role',
      targetType: 'user',

      computeFunction: async (context) => {
        const user = context.target
        const department = user.department
        const roles = user.roles || []

        // Запрос к коллекции департаментов
        const deptCollection = context.database.collection('departments')
        const deptInfo = await deptCollection.findOne({ name: department })

        if (roles.includes('admin')) return 'high'
        if (deptInfo?.securityLevel === 'restricted') return 'medium'
        return 'low'
      },

      dependencies: [
        { type: 'field', source: 'department', invalidateOnChange: true },
        { type: 'field', source: 'roles', invalidateOnChange: true },
        { type: 'collection', source: 'departments', invalidateOnChange: true }
      ],

      caching: {
        enabled: true,
        ttl: 300, // 5 minutes
        invalidateOn: [
          { type: 'field_change', source: 'department' },
          { type: 'field_change', source: 'roles' },
          { type: 'collection_change', source: 'departments' }
        ]
      },

      security: {
        allowExternalRequests: false,
        timeout: 5000,
        maxMemoryUsage: 1024 * 1024 // 1MB
      },

      createdBy: 'system',
      createdAt: new Date(),
      isActive: true
    },

    // Атрибут с внешним API запросом
    creditScore: {
      id: 'user-credit-score',
      name: 'User Credit Score',
      description: 'Credit score from external service',
      targetType: 'user',

      computeFunction: async (context) => {
        if (!context.httpClient) {
          throw new Error('HTTP client not available')
        }

        const user = context.target
        const response = await context.httpClient.get(
          `https://credit-api.example.com/score/${user.id}`,
          { timeout: 3000 }
        )

        return response.data.score
      },

      dependencies: [
        { type: 'external_api', source: 'credit-api.example.com', invalidateOnChange: false }
      ],

      caching: {
        enabled: true,
        ttl: 86400, // 24 hours
        invalidateOn: [
          { type: 'time_based', source: 'daily' }
        ]
      },

      security: {
        allowExternalRequests: true,
        timeout: 5000,
        maxMemoryUsage: 512 * 1024 // 512KB
      },

      createdBy: 'system',
      createdAt: new Date(),
      isActive: true
    }
  }
}
```

### **1.5.3 Authorization Integration**

#### **Использование в правилах авторизации:**
```typescript
// Расширение User interface для computed attributes
interface UserWithComputedAttributes extends User {
  computedAttributes?: Record<string, any>
}

// Интеграция с динамическими правилами
const computedAttributeRule: DynamicRule = {
  id: 'computed-access-level-rule',
  name: 'Access Level Based Rule',
  priority: 90,
  type: 'allow',

  evaluator: async (user: UserWithComputedAttributes, resource, context) => {
    // Получаем вычисляемый атрибут
    const accessLevel = await context.computedAttributeEngine.computeAttribute(
      'user-access-level',
      {
        target: user,
        targetId: user.id,
        targetType: 'user',
        database: context.database,
        timestamp: Date.now(),
        nodeId: context.nodeId,
        currentUser: user,
        authContext: context
      }
    )

    // Проверяем доступ на основе вычисляемого атрибута
    if (resource.securityLevel === 'high' && accessLevel !== 'high') {
      return false
    }

    return true
  }
}
```

### **1.5.4 Caching & Performance**

#### **Кэширование вычисляемых атрибутов:**
```typescript
interface IComputedAttributeCache {
  // Cache operations
  get(attributeId: string, targetId: string): Promise<CachedAttribute | null>
  set(
    attributeId: string,
    targetId: string,
    value: any,
    ttl: number
  ): Promise<void>

  // Invalidation
  invalidate(attributeId: string, targetId?: string): Promise<void>
  invalidateByDependency(dependency: AttributeDependency): Promise<void>

  // Statistics
  getStats(): ComputedAttributeCacheStats
}

interface CachedAttribute {
  value: any
  computedAt: Date
  expiresAt: Date
  dependencies: AttributeDependency[]
}

interface ComputedAttributeCacheStats {
  totalAttributes: number
  cachedAttributes: number
  hitRate: number
  missRate: number
  averageComputeTime: number
  memoryUsage: number
}

// Реализация с автоматической инвалидацией
class ComputedAttributeCacheManager implements IComputedAttributeCache {
  private cache = new Map<string, CachedAttribute>()
  private dependencyIndex = new Map<string, Set<string>>()

  constructor(private database: CSDatabase) {
    this.setupInvalidationListeners()
  }

  private setupInvalidationListeners(): void {
    // Слушаем изменения в коллекциях для автоматической инвалидации
    this.database.on('document:updated', (event) => {
      this.handleDocumentChange(event)
    })

    this.database.on('document:inserted', (event) => {
      this.handleDocumentChange(event)
    })

    this.database.on('document:deleted', (event) => {
      this.handleDocumentChange(event)
    })
  }

  private async handleDocumentChange(event: DocumentChangeEvent): Promise<void> {
    const dependency: AttributeDependency = {
      type: 'collection',
      source: event.collection,
      invalidateOnChange: true
    }

    await this.invalidateByDependency(dependency)
  }
}
```

### **1.5.5 Built-in Computed Attributes**

#### **Системные вычисляемые атрибуты:**
```typescript
// Предустановленные атрибуты для общих случаев
const builtInComputedAttributes: ComputedAttributeDefinition[] = [
  {
    id: 'user-last-activity',
    name: 'User Last Activity',
    description: 'Time since user last activity',
    targetType: 'user',

    computeFunction: async (context) => {
      const user = context.target
      const auditCollection = context.database.collection('audit_logs')

      const lastActivity = await auditCollection.findOne(
        { userId: user.id },
        { sort: { timestamp: -1 } }
      )

      if (!lastActivity) return null

      return {
        lastActivityAt: lastActivity.timestamp,
        minutesAgo: Math.floor((Date.now() - lastActivity.timestamp) / 60000)
      }
    },

    dependencies: [
      { type: 'collection', source: 'audit_logs', invalidateOnChange: true }
    ],

    caching: {
      enabled: true,
      ttl: 60, // 1 minute
      invalidateOn: [
        { type: 'collection_change', source: 'audit_logs' }
      ]
    },

    security: {
      allowExternalRequests: false,
      timeout: 2000,
      maxMemoryUsage: 256 * 1024
    },

    createdBy: 'system',
    createdAt: new Date(),
    isActive: true
  },

  {
    id: 'document-access-frequency',
    name: 'Document Access Frequency',
    description: 'How often this document is accessed',
    targetType: 'document',

    computeFunction: async (context) => {
      const document = context.target
      const auditCollection = context.database.collection('audit_logs')

      const accessCount = await auditCollection.count({
        resource: `document:${document.id}`,
        action: 'read',
        timestamp: { $gte: Date.now() - 30 * 24 * 60 * 60 * 1000 } // last 30 days
      })

      return {
        accessCount,
        accessesPerDay: accessCount / 30,
        popularityScore: Math.min(accessCount / 100, 1) // normalized 0-1
      }
    },

    dependencies: [
      { type: 'collection', source: 'audit_logs', invalidateOnChange: true }
    ],

    caching: {
      enabled: true,
      ttl: 3600, // 1 hour
      invalidateOn: [
        { type: 'collection_change', source: 'audit_logs' }
      ]
    },

    security: {
      allowExternalRequests: false,
      timeout: 5000,
      maxMemoryUsage: 512 * 1024
    },

    createdBy: 'system',
    createdAt: new Date(),
    isActive: true
  }
]
```

---

## 🔄 Phase 1.6: Stored Functions & Procedures System ✅

### **Цели фазы:**
- Создать систему хранимых функций для computed views
- Реализовать хранимые процедуры для бизнес-логики
- Обеспечить выполнение в контексте пользователя с соблюдением прав доступа
- Интегрировать с системой авторизации и кэширования

### **1.6.1 Core Stored Functions Engine**

#### **Архитектура:**
```typescript
interface IStoredFunctionEngine {
  // Function management
  registerFunction(definition: StoredFunctionDefinition): Promise<void>
  unregisterFunction(functionId: string): Promise<void>
  updateFunction(functionId: string, definition: StoredFunctionDefinition): Promise<void>

  // Versioning
  deployVersion(functionId: string, version: string, strategy: DeploymentStrategy): Promise<void>
  rollbackVersion(functionId: string, targetVersion: string): Promise<void>
  enableABTesting(functionId: string, versions: ABTestConfig): Promise<void>

  // Execution
  executeFunction(
    functionId: string,
    parameters: Record<string, any>,
    executionContext: FunctionExecutionContext
  ): Promise<FunctionResult>

  executeProcedure(
    procedureId: string,
    parameters: Record<string, any>,
    executionContext: FunctionExecutionContext
  ): Promise<ProcedureResult>

  // Computed views
  getComputedView(
    viewId: string,
    parameters: Record<string, any>,
    executionContext: FunctionExecutionContext
  ): Promise<ComputedViewResult>

  // Cache management
  invalidateViewCache(viewId: string, parameters?: Record<string, any>): Promise<void>
  refreshMaterializedView(viewId: string): Promise<void>

  // Monitoring & Metrics
  getFunctionStats(functionId: string): Promise<FunctionStats>
  getExecutionHistory(functionId: string, limit?: number): Promise<ExecutionLog[]>
  getPerformanceMetrics(functionId: string): Promise<PerformanceMetrics>

  // Hot reload
  reloadFunction(functionId: string): Promise<void>
  validateFunction(definition: StoredFunctionDefinition): Promise<ValidationResult>
}

interface StoredFunctionDefinition {
  id: string
  name: string
  description: string

  // Function type
  type: 'computed_view' | 'stored_procedure' | 'scalar_function'

  // TypeScript/JavaScript implementation
  implementation: TypeScriptFunctionImplementation
  typeDefinitions?: string // TypeScript type definitions

  // Parameters with TypeScript types
  parameters: TypedFunctionParameter[]
  returnType: TypedFunctionReturnType

  // Security and execution
  security: {
    executionMode: 'caller_rights' // только caller_rights по требованию
    allowedRoles: string[]
    maxExecutionTime: number // configurable, no default limit
    maxMemoryUsage: number // configurable
    maxDbOperations: number // configurable
    sandboxed: true // всегда в sandbox
  }

  // Transaction management
  transaction: {
    autoTransaction: boolean // true по умолчанию
    isolationLevel?: 'read_committed' | 'repeatable_read' | 'serializable'
    timeout?: number
  }

  // Streaming support
  streaming?: {
    enabled: boolean
    chunkSize: number
    maxChunks: number
  }

  // Caching (for computed views)
  caching?: {
    enabled: boolean
    strategy: 'dependency_based' // только по зависимостям
    ttl: number // seconds
    invalidateOn: ViewInvalidationTrigger[]
    subscriptionBased?: boolean // для будущего развития
  }

  // Dependencies
  dependencies: FunctionDependency[]

  // Versioning & Deployment
  version: string
  previousVersions: FunctionVersion[]
  deploymentStrategy: DeploymentStrategy
  abTestConfig?: ABTestConfig

  // Metadata
  createdBy: string
  createdAt: Date
  updatedAt: Date
  isActive: boolean
}

interface TypeScriptFunctionImplementation {
  code: string // TypeScript/JavaScript code
  compiledCode?: string // compiled JavaScript
  sourceMap?: string
  dependencies?: string[] // npm packages if needed
}

interface TypedFunctionParameter {
  name: string
  type: string // TypeScript type string
  required: boolean
  defaultValue?: any
  validation?: ParameterValidation
  description?: string
}

interface TypedFunctionReturnType {
  type: 'scalar' | 'dataset' | 'stream' | 'void'
  typeDefinition: string // TypeScript type
  schema?: any // JSON schema для dataset
  streamChunkSize?: number // для stream
}

interface DeploymentStrategy {
  type: 'immediate' | 'blue_green' | 'canary' | 'ab_test'
  rolloutPercentage?: number // для canary
  healthCheckEndpoint?: string
  autoRollbackOnError: boolean // true по умолчанию
  maxErrorRate?: number // для auto rollback
}

interface ABTestConfig {
  enabled: boolean
  versions: {
    version: string
    trafficPercentage: number
  }[]
  metrics: string[] // метрики для сравнения
  duration: number // длительность теста в секундах
}

interface FunctionVersion {
  version: string
  code: string
  deployedAt: Date
  isActive: boolean
  performanceMetrics?: PerformanceMetrics
}
```

### **1.6.2 TypeScript Sandbox Execution**

#### **Безопасное выполнение с TypeScript:**
```typescript
interface IFunctionSandbox {
  // Compilation
  compileTypeScript(code: string, types?: string): Promise<CompilationResult>
  validateTypes(definition: StoredFunctionDefinition): Promise<TypeValidationResult>

  // Execution
  executeInSandbox(
    compiledCode: string,
    parameters: Record<string, any>,
    context: SandboxExecutionContext,
    limits: ResourceLimits
  ): Promise<any>

  // Monitoring
  monitorExecution(executionId: string): Promise<ExecutionMonitor>
  terminateExecution(executionId: string): Promise<void>
}

interface CompilationResult {
  success: boolean
  compiledCode?: string
  sourceMap?: string
  errors?: TypeScriptError[]
  warnings?: TypeScriptWarning[]
}

interface SandboxExecutionContext extends FunctionExecutionContext {
  // Restricted API access
  allowedModules: string[]
  networkAccess: boolean
  fileSystemAccess: boolean

  // Resource monitoring
  memoryMonitor: MemoryMonitor
  timeoutMonitor: TimeoutMonitor
  operationCounter: OperationCounter
}

// Пример TypeScript функции
const typedUserActivityView: StoredFunctionDefinition = {
  id: 'typed-user-activity-summary',
  name: 'Typed User Activity Summary',
  description: 'Type-safe aggregated user activity data',
  type: 'computed_view',

  implementation: {
    code: `
      interface ActivityParameters {
        startDate?: string;
        endDate?: string;
        departmentFilter?: string;
      }

      interface ActivityResult {
        userId: string;
        userName: string;
        department: string;
        totalActions: number;
        lastActivity: Date;
        actionTypes: string[];
      }

      export default async function userActivitySummary(
        parameters: ActivityParameters,
        context: FunctionExecutionContext
      ): Promise<ActivityResult[]> {
        const { startDate, endDate, departmentFilter } = parameters;
        const { currentUser, database } = context;

        // Type-safe query building
        const query: any = {
          timestamp: {
            $gte: startDate ? new Date(startDate) : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
            $lte: endDate ? new Date(endDate) : new Date()
          }
        };

        // Permission-based filtering
        if (!currentUser.roles.includes('admin')) {
          query.userId = currentUser.id;
        }

        if (departmentFilter && currentUser.roles.includes('manager')) {
          const usersCollection = database.collection<User>('users');
          const departmentUsers = await usersCollection.find({
            department: departmentFilter
          }).select('id');

          query.userId = { $in: departmentUsers.map(u => u.id) };
        }

        const auditCollection = database.collection('audit_logs');
        const results = await auditCollection.aggregate([
          { $match: query },
          {
            $group: {
              _id: '$userId',
              totalActions: { $sum: 1 },
              lastActivity: { $max: '$timestamp' },
              actionTypes: { $addToSet: '$action' }
            }
          },
          {
            $lookup: {
              from: 'users',
              localField: '_id',
              foreignField: 'id',
              as: 'user'
            }
          },
          {
            $project: {
              userId: '$_id',
              userName: { $arrayElemAt: ['$user.email', 0] },
              department: { $arrayElemAt: ['$user.department', 0] },
              totalActions: 1,
              lastActivity: 1,
              actionTypes: 1
            }
          },
          { $sort: { totalActions: -1 } }
        ]);

        return results as ActivityResult[];
      }
    `,
    dependencies: [] // no external dependencies
  },

  parameters: [
    {
      name: 'startDate',
      type: 'string | undefined',
      required: false,
      description: 'Start date in ISO format'
    },
    {
      name: 'endDate',
      type: 'string | undefined',
      required: false,
      description: 'End date in ISO format'
    },
    {
      name: 'departmentFilter',
      type: 'string | undefined',
      required: false,
      description: 'Filter by department name'
    }
  ],

  returnType: {
    type: 'dataset',
    typeDefinition: 'ActivityResult[]',
    schema: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          userId: { type: 'string' },
          userName: { type: 'string' },
          department: { type: 'string' },
          totalActions: { type: 'number' },
          lastActivity: { type: 'string', format: 'date-time' },
          actionTypes: { type: 'array', items: { type: 'string' } }
        }
      }
    }
  },

  security: {
    executionMode: 'caller_rights',
    allowedRoles: ['user', 'manager', 'admin'],
    maxExecutionTime: 30000, // configurable
    maxMemoryUsage: 50 * 1024 * 1024, // configurable
    maxDbOperations: 1000, // configurable
    sandboxed: true
  },

  transaction: {
    autoTransaction: false, // read-only operation
  },

  caching: {
    enabled: true,
    strategy: 'dependency_based',
    ttl: 3600,
    invalidateOn: [
      { type: 'collection_change', source: 'audit_logs' },
      { type: 'collection_change', source: 'users' }
    ]
  },

  dependencies: [
    { type: 'collection', source: 'audit_logs', access: 'read' },
    { type: 'collection', source: 'users', access: 'read' }
  ],

  version: '1.0.0',
  previousVersions: [],
  deploymentStrategy: {
    type: 'blue_green',
    autoRollbackOnError: true,
    maxErrorRate: 0.05 // 5% error rate triggers rollback
  },

  createdBy: 'system',
  createdAt: new Date(),
  updatedAt: new Date(),
  isActive: true
}
```

### **1.6.3 Deployment & Versioning System**

#### **Многоэтапное развертывание:**
```typescript
interface IFunctionDeploymentManager {
  // API Deployment
  deployViaAPI(definition: StoredFunctionDefinition): Promise<DeploymentResult>

  // Configuration File Deployment
  deployFromConfig(configPath: string): Promise<DeploymentResult[]>
  loadConfigSchema(): Promise<ConfigSchema>

  // UI Deployment (future phase)
  generateUISchema(functionId: string): Promise<UISchema>
  deployFromUI(uiData: UIFunctionData): Promise<DeploymentResult>

  // Version Management
  createVersion(functionId: string, changes: FunctionChanges): Promise<string>
  deployVersion(functionId: string, version: string, strategy: DeploymentStrategy): Promise<void>
  rollbackToVersion(functionId: string, version: string): Promise<void>

  // A/B Testing
  startABTest(functionId: string, config: ABTestConfig): Promise<string>
  stopABTest(testId: string, winningVersion: string): Promise<void>
  getABTestResults(testId: string): Promise<ABTestResults>
}

// Phase 1: API Deployment
interface APIDeploymentEndpoints {
  'POST /api/functions': (definition: StoredFunctionDefinition) => Promise<DeploymentResult>
  'PUT /api/functions/:id': (definition: Partial<StoredFunctionDefinition>) => Promise<DeploymentResult>
  'POST /api/functions/:id/versions': (version: FunctionVersion) => Promise<DeploymentResult>
  'POST /api/functions/:id/deploy/:version': (strategy: DeploymentStrategy) => Promise<void>
  'POST /api/functions/:id/rollback/:version': () => Promise<void>
  'GET /api/functions/:id/stats': () => Promise<FunctionStats>
}

// Phase 2: Configuration File Deployment
interface ConfigFileFormat {
  functions: {
    [functionId: string]: {
      definition: StoredFunctionDefinition
      deployment: DeploymentStrategy
      monitoring: MonitoringConfig
    }
  }
  global: {
    defaultLimits: ResourceLimits
    sandboxConfig: SandboxConfig
    deploymentDefaults: DeploymentStrategy
  }
}

// Phase 3: UI Deployment (future)
interface UISchema {
  functionId: string
  metadata: {
    name: string
    description: string
    category: string
  }
  parameters: UIParameterSchema[]
  codeEditor: {
    language: 'typescript'
    templates: CodeTemplate[]
    autoComplete: boolean
  }
  testing: {
    testCases: TestCase[]
    mockData: MockDataSet[]
  }
}
```

### **1.6.4 Performance Monitoring & Alerting**

#### **Метрики и мониторинг:**
```typescript
interface PerformanceMetrics {
  functionId: string
  version: string

  // Execution metrics
  totalExecutions: number
  successfulExecutions: number
  failedExecutions: number
  averageExecutionTime: number
  p95ExecutionTime: number
  p99ExecutionTime: number

  // Resource usage
  averageMemoryUsage: number
  peakMemoryUsage: number
  averageDbOperations: number

  // Error metrics
  errorRate: number
  timeoutRate: number
  memoryLimitExceededRate: number

  // Cache metrics (for computed views)
  cacheHitRate?: number
  cacheMissRate?: number
  cacheInvalidationCount?: number

  // Time period
  periodStart: Date
  periodEnd: Date
}

interface AlertingConfig {
  functionId: string
  alerts: {
    // Performance alerts
    executionTimeThreshold: number // ms
    errorRateThreshold: number // percentage
    memoryUsageThreshold: number // bytes

    // Notification settings
    notificationChannels: NotificationChannel[]
    escalationPolicy: EscalationPolicy

    // Auto-actions
    autoRollbackOnErrorRate: boolean
    autoScaleOnHighLoad: boolean
  }
}

interface NotificationChannel {
  type: 'email' | 'slack' | 'webhook' | 'sse'
  config: Record<string, any>
  severity: 'low' | 'medium' | 'high' | 'critical'
}

// Реализация мониторинга
class FunctionPerformanceMonitor {
  async collectMetrics(functionId: string, executionResult: ExecutionResult): Promise<void> {
    const metrics = {
      functionId,
      executionTime: executionResult.executionTime,
      memoryUsage: executionResult.memoryUsage,
      dbOperations: executionResult.dbOperations,
      success: executionResult.success,
      timestamp: new Date()
    }

    await this.metricsCollection.create(metrics)

    // Check thresholds
    await this.checkAlertThresholds(functionId, metrics)
  }

  private async checkAlertThresholds(functionId: string, metrics: any): Promise<void> {
    const alertConfig = await this.getAlertConfig(functionId)

    // Check execution time
    if (metrics.executionTime > alertConfig.executionTimeThreshold) {
      await this.sendAlert('execution_time_exceeded', functionId, metrics)
    }

    // Check memory usage
    if (metrics.memoryUsage > alertConfig.memoryUsageThreshold) {
      await this.sendAlert('memory_threshold_exceeded', functionId, metrics)
    }

    // Check error rate (over time window)
    const recentErrorRate = await this.calculateRecentErrorRate(functionId)
    if (recentErrorRate > alertConfig.errorRateThreshold) {
      await this.sendAlert('error_rate_exceeded', functionId, { errorRate: recentErrorRate })

      if (alertConfig.autoRollbackOnErrorRate) {
        await this.triggerAutoRollback(functionId)
      }
    }
  }
}
```

### **1.6.5 REST API & SSE Integration**

#### **HTTP API для функций:**
```typescript
interface FunctionRESTAPI {
  // Function execution endpoints
  'POST /api/functions/:id/execute': {
    body: {
      parameters: Record<string, any>
      options?: ExecutionOptions
    }
    response: FunctionResult | ProcedureResult
  }

  // Computed view endpoints
  'GET /api/views/:id': {
    query: Record<string, any> // parameters
    response: ComputedViewResult
  }

  // Streaming endpoints
  'GET /api/functions/:id/stream': {
    query: Record<string, any>
    response: ReadableStream<any>
  }

  // SSE for real-time results
  'GET /api/functions/:id/subscribe': {
    query: { parameters: string } // JSON encoded
    response: EventSource // SSE stream
  }
}

// SSE Implementation для real-time результатов
class FunctionSSEManager {
  async subscribeToFunction(
    functionId: string,
    parameters: Record<string, any>,
    user: User,
    response: Response
  ): Promise<void> {
    // Setup SSE headers
    response.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
      'Access-Control-Allow-Origin': '*'
    })

    const subscriptionId = crypto.randomUUID()

    // Initial execution
    try {
      const result = await this.functionEngine.executeFunction(functionId, parameters, {
        currentUser: user,
        // ... other context
      })

      this.sendSSEEvent(response, 'result', result)
    } catch (error) {
      this.sendSSEEvent(response, 'error', { message: error.message })
    }

    // Subscribe to dependency changes for auto-refresh
    const functionDef = await this.getFunctionDefinition(functionId)
    for (const dependency of functionDef.dependencies) {
      if (dependency.type === 'collection') {
        await this.subscribeToCollectionChanges(
          dependency.source,
          () => this.refreshFunctionResult(functionId, parameters, user, response)
        )
      }
    }

    // Cleanup on disconnect
    response.on('close', () => {
      this.cleanupSubscription(subscriptionId)
    })
  }

  private sendSSEEvent(response: Response, event: string, data: any): void {
    response.write(`event: ${event}\n`)
    response.write(`data: ${JSON.stringify(data)}\n\n`)
  }
}
```

---

## 🔄 Phase 2: Advanced Authorization (RBAC + ABAC) ✅

### **Цели фазы:**
- Реализовать гибридную систему RBAC + ABAC
- Добавить динамические правила доступа
- Обеспечить гранулярный контроль на всех уровнях
- Оптимизировать производительность через кэширование

### **2.1 Hybrid Authorization Engine**

#### **Архитектура:**
```typescript
interface IAuthorizationEngine {
  // Permission checking
  checkPermission(
    user: User,
    resource: ResourceDescriptor,
    action: string,
    context?: AuthContext
  ): Promise<AuthorizationResult>

  // Rule management
  addDynamicRule(rule: DynamicRule): void
  removeDynamicRule(ruleId: string): void
  evaluateRules(user: User, resource: any, context: AuthContext): Promise<boolean>

  // Cache management
  clearPermissionCache(userId?: string): void
  getPermissionCacheStats(): CacheStats
}

interface ResourceDescriptor {
  type: 'database' | 'collection' | 'document' | 'field'
  database?: string
  collection?: string
  documentId?: string
  fieldPath?: string
}

interface AuthorizationResult {
  allowed: boolean
  reason: string
  appliedRules: string[]
  cacheHit: boolean
}
```

### **2.2 Dynamic Rules System**

#### **Типы правил:**
```typescript
interface DynamicRule {
  id: string
  name: string
  priority: number
  type: 'allow' | 'deny'

  // JavaScript function rule
  evaluator: (user: User, resource: any, context: AuthContext) => Promise<boolean>

  // Metadata
  description: string
  createdBy: string
  createdAt: Date
  isActive: boolean
}

// Примеры правил
const ownershipRule: DynamicRule = {
  id: 'ownership-rule',
  name: 'Document Ownership',
  priority: 100,
  type: 'allow',
  evaluator: async (user, resource, context) => {
    return resource.ownerId === user.id
  }
}

const timeBasedRule: DynamicRule = {
  id: 'business-hours',
  name: 'Business Hours Access',
  priority: 50,
  type: 'deny',
  evaluator: async (user, resource, context) => {
    const hour = new Date(context.timestamp).getHours()
    return hour < 9 || hour > 17 // deny outside business hours
  }
}

const regionBasedRule: DynamicRule = {
  id: 'region-restriction',
  name: 'Regional Access Control',
  priority: 75,
  type: 'deny',
  evaluator: async (user, resource, context) => {
    const allowedRegions = user.attributes.allowedRegions || []
    return !allowedRegions.includes(context.region)
  }
}
```

### **2.3 Granular Access Control**

#### **Уровни контроля:**
```typescript
interface AccessControlMatrix {
  database: DatabasePermissions
  collection: CollectionPermissions
  document: DocumentPermissions
  field: FieldPermissions
}

interface FieldPermissions {
  read: boolean
  write: boolean
  visibility: 'visible' | 'hidden' | 'masked'
  maskingRule?: (value: any) => any
}

// Пример: пароли видны только админам
const passwordFieldRule: FieldPermissions = {
  read: false,
  write: false,
  visibility: 'hidden',
  maskingRule: () => '***'
}
```

### **2.4 Permission Caching System**

#### **Кэширование:**
```typescript
interface PermissionCache {
  // Cache operations
  get(key: string): Promise<AuthorizationResult | null>
  set(key: string, result: AuthorizationResult, ttl: number): Promise<void>
  invalidate(pattern: string): Promise<void>

  // Statistics
  getStats(): CacheStats

  // Configuration
  configure(config: CacheConfig): void
}

interface CacheConfig {
  enabled: boolean // true по умолчанию
  ttl: number // 5 минут по умолчанию
  maxSize: number // 10000 записей по умолчанию
  strategy: 'lru' | 'lfu' | 'ttl'
}
```

---

## 🔄 Phase 3: Real-time Subscriptions & Notifications ✅

### **Цели фазы:**
- Реализовать SSE с chunked encoding для больших datasets
- Добавить BroadcastChannel для синхронизации между вкладками
- Поддержать MessagePack для production, JSON для отладки
- Обеспечить subset replication на клиенте

### **3.1 Subscription Management System**

#### **Архитектура:**
```typescript
interface ISubscriptionManager {
  // Subscription lifecycle
  subscribe(
    userId: string,
    subscription: SubscriptionRequest
  ): Promise<SubscriptionId>

  unsubscribe(subscriptionId: SubscriptionId): Promise<void>

  // Data filtering and delivery
  notifySubscribers(changes: ChangeRecord[]): Promise<void>

  // Cross-tab synchronization
  enableCrossTabSync(enabled: boolean): void

  // Protocol management
  setProtocol(protocol: 'sse' | 'websocket'): void
  setFormat(format: 'json' | 'messagepack'): void
}

interface SubscriptionRequest {
  collections: string[]
  filters?: QueryFilter[]
  fields?: string[] // subset of fields
  realtime: boolean
  persistAcrossTabs: boolean

  // Pagination for large datasets
  pagination?: {
    type: 'cursor'
    limit: number
    cursor?: string
  }
}
```

### **3.2 Server-Sent Events (SSE) Implementation**

#### **SSE с chunked encoding:**
```typescript
interface SSEManager {
  // Connection management
  createConnection(userId: string, subscriptionId: string): SSEConnection
  closeConnection(connectionId: string): void

  // Data streaming
  streamData(
    connectionId: string,
    data: any[],
    options: StreamOptions
  ): Promise<void>

  // Health monitoring
  pingConnections(): void
  getConnectionStats(): ConnectionStats
}

interface StreamOptions {
  chunkSize: number // настраивается пользователем
  compression: boolean
  format: 'json' | 'messagepack'
}

// Пример использования
const sseManager = new SSEManager({
  chunkSize: 1024 * 1024, // 1MB chunks
  compression: true,
  heartbeatInterval: 30000 // 30 seconds
})
```

### **3.3 Cross-Tab Synchronization**

#### **BroadcastChannel API:**
```typescript
interface CrossTabSynchronizer {
  // Tab coordination
  registerTab(tabId: string): void
  unregisterTab(tabId: string): void

  // Data synchronization
  broadcastUpdate(update: DataUpdate): void
  onUpdate(handler: (update: DataUpdate) => void): void

  // Subscription management
  coordinateSubscriptions(): void

  // Memory management
  cleanupUnusedData(): void
}

interface DataUpdate {
  type: 'insert' | 'update' | 'delete'
  collection: string
  documentId: string
  data?: any
  timestamp: number
  sourceTabId: string
}

// Реализация
class BroadcastChannelSynchronizer implements CrossTabSynchronizer {
  private channel: BroadcastChannel
  private activeSubscriptions = new Map<string, Subscription>()

  constructor() {
    this.channel = new BroadcastChannel('collection-store-sync')
    this.setupMessageHandlers()
  }

  private setupMessageHandlers(): void {
    this.channel.onmessage = (event) => {
      const { type, data } = event.data

      switch (type) {
        case 'data-update':
          this.handleDataUpdate(data)
          break
        case 'subscription-change':
          this.handleSubscriptionChange(data)
          break
      }
    }
  }
}
```

### **3.4 Client-Side Data Management**

#### **Subset Replication:**
```typescript
interface ClientDataManager {
  // Data synchronization
  syncSubset(collections: string[], filters: QueryFilter[]): Promise<void>

  // Local storage
  getLocalData(collection: string, query?: Query): Promise<any[]>
  updateLocalData(collection: string, changes: ChangeRecord[]): Promise<void>

  // Pagination
  loadMore(collection: string, cursor: string): Promise<PaginationResult>

  // Offline support (optional)
  enableOfflineMode(enabled: boolean): void
  syncPendingChanges(): Promise<ConflictResolution[]>
}

interface PaginationResult {
  data: any[]
  nextCursor?: string
  hasMore: boolean
  totalCount?: number
}
```

---

## 🔄 Phase 4: File Storage System ✅

### **Цели фазы:**
- Создать Unified API для multiple storage backends
- Реализовать metadata management в отдельной коллекции
- Добавить streaming и thumbnail generation
- Обеспечить репликацию файлов между узлами

### **4.1 Unified File Storage API**

#### **Архитектура:**
```typescript
interface IFileStorageManager {
  // File operations
  upload(file: FileUpload, options: UploadOptions): Promise<FileMetadata>
  download(fileId: string, options?: DownloadOptions): Promise<ReadableStream>
  delete(fileId: string): Promise<void>

  // Metadata management
  getMetadata(fileId: string): Promise<FileMetadata>
  updateMetadata(fileId: string, updates: Partial<FileMetadata>): Promise<void>

  // Streaming
  streamFile(fileId: string, range?: ByteRange): Promise<ReadableStream>

  // Thumbnails
  generateThumbnail(fileId: string, size: ThumbnailSize): Promise<string>

  // Access control
  generateSignedUrl(fileId: string, ttl: number, permissions: string[]): Promise<string>
}

interface FileUpload {
  filename: string
  mimeType: string
  size: number
  stream: ReadableStream
  checksum?: string
}

interface UploadOptions {
  backend?: 'local' | 's3' | 'azure' | 'gcs'
  access: 'public' | 'private' | 'restricted'
  ttl?: number // время жизни файла
  generateThumbnails?: boolean
  thumbnailSizes?: ThumbnailSize[]
  chunkSize?: number // для streaming upload
}
```

### **4.2 Storage Backends**

#### **Local Storage:**
```typescript
class LocalFileStorage implements IStorageBackend {
  private basePath: string

  async store(fileId: string, stream: ReadableStream): Promise<void> {
    const filePath = this.getFilePath(fileId)
    await this.ensureDirectory(path.dirname(filePath))

    const writeStream = fs.createWriteStream(filePath)
    await pipeline(stream, writeStream)
  }

  async retrieve(fileId: string, range?: ByteRange): Promise<ReadableStream> {
    const filePath = this.getFilePath(fileId)

    if (range) {
      return fs.createReadStream(filePath, {
        start: range.start,
        end: range.end
      })
    }

    return fs.createReadStream(filePath)
  }
}
```

#### **S3-Compatible Storage:**
```typescript
class S3Storage implements IStorageBackend {
  private s3Client: S3Client
  private bucket: string

  async store(fileId: string, stream: ReadableStream): Promise<void> {
    const upload = new Upload({
      client: this.s3Client,
      params: {
        Bucket: this.bucket,
        Key: fileId,
        Body: stream
      }
    })

    await upload.done()
  }

  async retrieve(fileId: string, range?: ByteRange): Promise<ReadableStream> {
    const command = new GetObjectCommand({
      Bucket: this.bucket,
      Key: fileId,
      Range: range ? `bytes=${range.start}-${range.end}` : undefined
    })

    const response = await this.s3Client.send(command)
    return response.Body as ReadableStream
  }
}
```

### **4.3 Metadata Management**

#### **File Metadata Collection:**
```typescript
interface FileMetadata {
  id: string
  filename: string
  originalName: string
  mimeType: string
  size: number
  checksum: string

  // Storage info
  backend: string
  storagePath: string

  // Access control
  access: 'public' | 'private' | 'restricted'
  ownerId: string
  permissions: FilePermission[]

  // Lifecycle
  createdAt: Date
  updatedAt: Date
  expiresAt?: Date

  // Media-specific metadata
  imageMetadata?: ImageMetadata
  videoMetadata?: VideoMetadata

  // Thumbnails
  thumbnails: ThumbnailInfo[]
}

interface ImageMetadata {
  width: number
  height: number
  format: string
  colorSpace: string
  hasAlpha: boolean
  exif?: Record<string, any>
}

interface ThumbnailInfo {
  size: ThumbnailSize
  fileId: string
  mimeType: string
  generatedAt: Date
}

type ThumbnailSize =
  | { width: number; height: number }
  | 'small' // 150x150
  | 'medium' // 300x300
  | 'large' // 600x600
  | 'custom'
```

### **4.4 Thumbnail Generation**

#### **Image Processing:**
```typescript
interface IThumbnailGenerator {
  generate(
    sourceFileId: string,
    sizes: ThumbnailSize[]
  ): Promise<ThumbnailInfo[]>

  generateCustom(
    sourceFileId: string,
    width: number,
    height: number,
    options?: ThumbnailOptions
  ): Promise<ThumbnailInfo>
}

interface ThumbnailOptions {
  quality: number // 1-100
  format: 'jpeg' | 'png' | 'webp'
  crop: 'center' | 'smart' | 'entropy'
  background?: string // для PNG с прозрачностью
}

// Реализация с Sharp
class SharpThumbnailGenerator implements IThumbnailGenerator {
  async generate(sourceFileId: string, sizes: ThumbnailSize[]): Promise<ThumbnailInfo[]> {
    const sourceStream = await this.fileStorage.download(sourceFileId)
    const results: ThumbnailInfo[] = []

    for (const size of sizes) {
      const { width, height } = this.resolveThumbnailSize(size)

      const thumbnailStream = sharp()
        .resize(width, height, {
          fit: 'cover',
          position: 'center'
        })
        .jpeg({ quality: 85 })

      const thumbnailId = `${sourceFileId}_thumb_${width}x${height}`

      await this.fileStorage.upload({
        filename: `thumbnail_${width}x${height}.jpg`,
        mimeType: 'image/jpeg',
        size: 0, // будет вычислен
        stream: sourceStream.pipe(thumbnailStream)
      }, {
        backend: 'local',
        access: 'public'
      })

      results.push({
        size: { width, height },
        fileId: thumbnailId,
        mimeType: 'image/jpeg',
        generatedAt: new Date()
      })
    }

    return results
  }
}
```

### **4.5 File Replication**

#### **Репликация между узлами:**
```typescript
interface IFileReplicationManager {
  // Replication operations
  replicateFile(fileId: string, targetNodes: string[]): Promise<void>

  // Synchronization
  syncFiles(sourceNode: string): Promise<void>

  // Health monitoring
  checkReplicationHealth(): Promise<ReplicationHealth>

  // Cleanup
  cleanupOrphanedFiles(): Promise<void>
}

interface ReplicationHealth {
  totalFiles: number
  replicatedFiles: number
  missingReplicas: string[]
  corruptedFiles: string[]
  lastSyncTime: Date
}

// Интеграция с WAL Replication
class FileReplicationManager implements IFileReplicationManager {
  constructor(
    private fileStorage: IFileStorageManager,
    private walReplication: WALReplicationManager
  ) {}

  async replicateFile(fileId: string, targetNodes: string[]): Promise<void> {
    const metadata = await this.fileStorage.getMetadata(fileId)
    const fileStream = await this.fileStorage.download(fileId)

    // Создаем WAL entry для репликации файла
    const walEntry: WALEntry = {
      type: 'FILE_REPLICATION',
      transactionId: crypto.randomUUID(),
      timestamp: Date.now(),
      data: {
        fileId,
        metadata,
        targetNodes
      }
    }

    await this.walReplication.streamWALEntry(walEntry)

    // Отправляем файл на целевые узлы
    for (const nodeId of targetNodes) {
      await this.sendFileToNode(nodeId, fileId, metadata, fileStream)
    }
  }
}
```

---

## 🔄 Phase 5: Client-Side Integration ✅

### **Цели фазы:**
- Реализовать cursor-based pagination с сортировкой
- Добавить distributed session storage
- Опциональный offline-first режим
- Интеграция всех компонентов

### **5.1 Advanced Pagination**

#### **Cursor-based с множественной сортировкой:**
```typescript
interface CursorPagination {
  // Pagination operations
  paginate<T>(
    collection: string,
    query: Query,
    options: PaginationOptions
  ): Promise<PaginationResult<T>>

  // Cursor management
  encodeCursor(sortValues: any[], documentId: string): string
  decodeCursor(cursor: string): CursorData

  // Sorting
  addSortField(field: string, direction: 'asc' | 'desc'): void
  clearSort(): void
}

interface PaginationOptions {
  limit: number
  cursor?: string
  sortFields: SortField[]
  format: 'simple_id' | 'base64_json' // выбор пользователя
}

interface SortField {
  field: string
  direction: 'asc' | 'desc'
  nullsFirst?: boolean
}

interface CursorData {
  sortValues: any[]
  documentId: string
  timestamp: number
}

// Реализация
class CursorPaginationManager implements CursorPagination {
  encodeCursor(sortValues: any[], documentId: string): string {
    const cursorData: CursorData = {
      sortValues,
      documentId,
      timestamp: Date.now()
    }

    if (this.options.format === 'simple_id') {
      return documentId
    }

    return Buffer.from(JSON.stringify(cursorData)).toString('base64')
  }

  async paginate<T>(
    collection: string,
    query: Query,
    options: PaginationOptions
  ): Promise<PaginationResult<T>> {
    let enhancedQuery = { ...query }

    // Добавляем cursor условия
    if (options.cursor) {
      const cursorData = this.decodeCursor(options.cursor)
      enhancedQuery = this.applyCursorConditions(enhancedQuery, cursorData, options.sortFields)
    }

    // Выполняем запрос с лимитом +1 для определения hasMore
    const results = await this.collection.find(enhancedQuery)
      .sort(this.buildSortObject(options.sortFields))
      .limit(options.limit + 1)

    const hasMore = results.length > options.limit
    const data = hasMore ? results.slice(0, -1) : results

    let nextCursor: string | undefined
    if (hasMore && data.length > 0) {
      const lastItem = data[data.length - 1]
      const sortValues = options.sortFields.map(sf => lastItem[sf.field])
      nextCursor = this.encodeCursor(sortValues, lastItem.id)
    }

    return {
      data,
      nextCursor,
      hasMore,
      totalCount: undefined // cursor pagination не поддерживает точный count
    }
  }
}
```

### **5.2 Distributed Session Storage**

#### **Session Management:**
```typescript
interface ISessionManager {
  // Session lifecycle
  createSession(userId: string, context: AuthContext): Promise<Session>
  getSession(sessionId: string): Promise<Session | null>
  updateSession(sessionId: string, updates: Partial<Session>): Promise<void>
  destroySession(sessionId: string): Promise<void>

  // Session migration
  migrateSession(sessionId: string, targetNode: string): Promise<void>

  // Cleanup
  cleanupExpiredSessions(): Promise<void>

  // Statistics
  getSessionStats(): SessionStats
}

interface Session {
  id: string
  userId: string
  createdAt: Date
  lastAccessAt: Date
  expiresAt: Date

  // Session data
  data: Record<string, any>

  // Security
  ipAddress: string
  userAgent: string

  // Distributed info
  nodeId: string
  isActive: boolean
}

// Реализация с Collection Store
class DistributedSessionManager implements ISessionManager {
  private sessionsCollection: Collection<Session>

  constructor(database: CSDatabase) {
    this.sessionsCollection = database.collection<Session>('sessions')
    this.setupCleanupJob()
  }

  async createSession(userId: string, context: AuthContext): Promise<Session> {
    const session: Session = {
      id: crypto.randomUUID(),
      userId,
      createdAt: new Date(),
      lastAccessAt: new Date(),
      expiresAt: new Date(Date.now() + this.sessionTTL),
      data: {},
      ipAddress: context.ip,
      userAgent: context.userAgent,
      nodeId: this.nodeId,
      isActive: true
    }

    await this.sessionsCollection.create(session)
    return session
  }

  async migrateSession(sessionId: string, targetNode: string): Promise<void> {
    const session = await this.getSession(sessionId)
    if (!session) {
      throw new Error(`Session ${sessionId} not found`)
    }

    // Обновляем nodeId в сессии
    await this.updateSession(sessionId, { nodeId: targetNode })

    // Уведомляем целевой узел о миграции
    await this.notifySessionMigration(sessionId, targetNode)
  }
}
```

### **5.3 Offline-First Support (Optional)**

#### **Conflict Resolution:**
```typescript
interface IOfflineManager {
  // Offline mode
  enableOfflineMode(): void
  disableOfflineMode(): void
  isOffline(): boolean

  // Data synchronization
  queueChange(change: OfflineChange): void
  syncPendingChanges(): Promise<ConflictResolution[]>

  // Conflict resolution
  resolveConflict(conflict: DataConflict, resolution: ConflictResolution): Promise<void>

  // Storage management
  getOfflineStorageSize(): Promise<number>
  clearOfflineStorage(): Promise<void>
}

interface OfflineChange {
  id: string
  type: 'insert' | 'update' | 'delete'
  collection: string
  documentId: string
  data?: any
  timestamp: number
  clientId: string
}

interface DataConflict {
  documentId: string
  collection: string
  localVersion: any
  serverVersion: any
  conflictFields: string[]
  timestamp: number
}

interface ConflictResolution {
  strategy: 'client_wins' | 'server_wins' | 'merge' | 'manual'
  resolvedData?: any
  mergeRules?: MergeRule[]
}
```

---

## 🧪 Testing Strategy

### **Тестирование по фазам:**

#### **Phase 1 Tests:**
- ✅ Authentication flow tests
- ✅ JWT token validation tests
- ✅ RBAC permission tests
- ✅ Audit logging tests

#### **Phase 1.5 Tests:**
- ✅ Computed attribute definition tests
- ✅ Context computation tests
- ✅ Cache invalidation tests
- ✅ External API integration tests
- ✅ Performance benchmarks for computed attributes

#### **Phase 1.6 Tests:**
- ✅ Stored function definition and registration tests
- ✅ Computed view execution and caching tests
- ✅ Stored procedure transaction tests
- ✅ Security and permission enforcement tests
- ✅ Resource limit and monitoring tests
- ✅ Materialized view refresh and invalidation tests

#### **Phase 2 Tests:**
- ✅ ABAC rule evaluation tests
- ✅ Dynamic rule execution tests
- ✅ Permission caching tests
- ✅ Granular access control tests
- ✅ Computed attributes in authorization tests
- ✅ Stored functions in authorization rules tests

#### **Phase 3 Tests:**
- ✅ SSE connection tests
- ✅ Cross-tab synchronization tests
- ✅ Subscription management tests
- ✅ Real-time notification tests

#### **Phase 4 Tests:**
- ✅ File upload/download tests
- ✅ Thumbnail generation tests
- ✅ Storage backend tests
- ✅ File replication tests

#### **Phase 5 Tests:**
- ✅ Pagination tests
- ✅ Session management tests
- ✅ Offline mode tests (optional)
- ✅ Integration tests

### **Performance Benchmarks:**
- 🎯 Authentication: <10ms per request
- 🎯 Authorization: <5ms per check (with cache)
- 🎯 File upload: >100MB/s throughput
- 🎯 Real-time notifications: <100ms latency
- 🎯 Cross-tab sync: <50ms propagation

---

## 📊 Success Metrics

### **Функциональные метрики:**
- ✅ 100% test coverage для критических компонентов
- ✅ Поддержка всех заявленных протоколов (SSE, WebSocket)
- ✅ Работа со всеми storage backends
- ✅ Полная интеграция с существующей WAL/Replication системой

### **Производительность:**
- ✅ Sub-10ms authentication
- ✅ Sub-5ms authorization (cached)
- ✅ 100MB/s+ file throughput
- ✅ <100ms real-time latency
- ✅ Support for 10K+ concurrent users

### **Безопасность:**
- ✅ Принцип наименьших привилегий
- ✅ Полный audit trail
- ✅ Secure token management
- ✅ Granular access control

---

## 🚀 Implementation Timeline

### **Phase 1: 2-3 недели**
- Week 1: Core authentication system
- Week 2: JWT security + RBAC
- Week 3: Audit logging + testing

### **Phase 1.5: 2 недели**
- Week 1: Computed attributes engine + schema integration
- Week 2: Caching system + authorization integration + testing

### **Phase 1.6: 1 неделя**
- Week 1: Stored functions + procedures + materialized views

### **Phase 2: 2-3 недели**
- Week 1: ABAC engine + dynamic rules
- Week 2: Granular access control + computed attributes + stored functions integration
- Week 3: Performance optimization + caching

### **Phase 3: 2-3 недели**
- Week 1: SSE implementation
- Week 2: Cross-tab synchronization
- Week 3: Subscription management

### **Phase 4: 2-3 недели**
- Week 1: File storage API + backends
- Week 2: Thumbnail generation + metadata
- Week 3: File replication

### **Phase 5: 1-2 недели**
- Week 1: Pagination + session management
- Week 2: Integration + final testing

**Общий timeline: 12-17 недель**

---

## 🎯 Next Steps

1. **Создать рабочие файлы** для каждой фазы
2. **Настроить тестовую среду** с существующей Collection Store
3. **Начать с Phase 1** - Authentication Foundation
4. **Следовать правилам DEVELOPMENT_RULES.md** для каждого этапа

Готов приступить к реализации! 🚀