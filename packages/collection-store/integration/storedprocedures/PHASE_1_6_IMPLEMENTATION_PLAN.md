# 🚀 Phase 1.6: Stored Functions & Procedures System - Implementation Plan

## 📋 СТАТУС: ГОТОВ К СТАРТУ ✅

### **Проверка готовности:**
- ✅ **Phase 1**: Authentication & Authorization Foundation - ЗАВЕРШЕНА (120/120 тестов)
- ✅ **Phase 1.5**: Computed Attributes System - ЗАВЕРШЕНА (195/195 тестов)
- ✅ **Инфраструктура**: CSDatabase, TypedCollection, WAL, Transactions - ГОТОВА
- ✅ **Зависимости**: TypeScript, bcrypt, jsonwebtoken, zod - УСТАНОВЛЕНЫ
- ✅ **Тестовая среда**: Bun test framework - НАСТРОЕНА

---

## 🎯 Цели Phase 1.6

### **Основные задачи:**
1. **Stored Functions Engine** - система выполнения TypeScript функций в sandbox
2. **Computed Views** - кэшируемые представления данных с dependency tracking
3. **Stored Procedures** - бизнес-логика с транзакционной поддержкой
4. **Deployment System** - версионирование, blue-green deployment, A/B testing
5. **Security Integration** - выполнение в контексте пользователя с RBAC
6. **Performance Optimization** - кэширование, мониторинг, resource limits

### **Ключевые принципы:**
- **Caller Rights Only** - выполнение только в контексте вызывающего пользователя
- **TypeScript First** - полная типизация и compile-time проверки
- **Sandbox Security** - изолированное выполнение с resource limits
- **Dependency-based Caching** - автоматическая инвалидация кэша
- **Production Ready** - мониторинг, метрики, health checks

---

## 📅 Timeline: 1 неделя (7 дней)

### **Day 1-2: Core Infrastructure**
- Stored Functions Engine interfaces и types
- TypeScript Sandbox execution environment
- Resource limits и security constraints
- Basic function registration и validation

### **Day 3-4: Computed Views & Procedures**
- Computed Views implementation с dependency tracking
- Stored Procedures с transaction support
- Cache integration с invalidation triggers
- Parameter validation и type checking

### **Day 5-6: Deployment & Versioning**
- Function versioning system
- Blue-green deployment strategy
- A/B testing framework
- Configuration-based deployment

### **Day 7: Integration & Testing**
- Auth system integration
- Performance optimization
- Comprehensive test suite
- Documentation и examples

---

## 🏗️ Day 1-2: Core Infrastructure

### **1.1 Project Structure Setup**

#### **Создание модульной структуры:**
```
src/auth/functions/
├── core/
│   ├── StoredFunctionEngine.ts      # Main engine
│   ├── FunctionSandbox.ts           # TypeScript sandbox
│   ├── ResourceManager.ts           # Resource limits
│   └── index.ts                     # Core exports
├── deployment/
│   ├── DeploymentManager.ts         # Deployment strategies
│   ├── VersionManager.ts            # Version control
│   ├── ABTestManager.ts             # A/B testing
│   └── index.ts                     # Deployment exports
├── views/
│   ├── ComputedViewManager.ts       # Computed views
│   ├── ViewCache.ts                 # View caching
│   ├── DependencyTracker.ts         # Dependency tracking
│   └── index.ts                     # Views exports
├── procedures/
│   ├── StoredProcedureManager.ts    # Stored procedures
│   ├── TransactionManager.ts        # Transaction handling
│   ├── ParameterValidator.ts        # Parameter validation
│   └── index.ts                     # Procedures exports
├── interfaces/
│   ├── IStoredFunctionEngine.ts     # Main interface
│   ├── IFunctionSandbox.ts          # Sandbox interface
│   ├── IDeploymentManager.ts        # Deployment interface
│   ├── types.ts                     # Core types
│   └── index.ts                     # Interface exports
├── tests/
│   ├── StoredFunctionEngine.test.ts # Engine tests
│   ├── FunctionSandbox.test.ts      # Sandbox tests
│   ├── ComputedViews.test.ts        # Views tests
│   ├── StoredProcedures.test.ts     # Procedures tests
│   ├── Deployment.test.ts           # Deployment tests
│   └── Integration.test.ts          # Integration tests
├── utils/
│   ├── typescript-compiler.ts       # TS compilation
│   ├── function-validator.ts        # Function validation
│   ├── performance-monitor.ts       # Performance monitoring
│   └── index.ts                     # Utils exports
└── index.ts                         # Main exports
```

### **1.2 Core Types & Interfaces**

#### **Основные интерфейсы:**
```typescript
// interfaces/IStoredFunctionEngine.ts
export interface IStoredFunctionEngine {
  // Function management
  registerFunction(definition: StoredFunctionDefinition): Promise<void>
  unregisterFunction(functionId: string): Promise<void>
  updateFunction(functionId: string, definition: StoredFunctionDefinition): Promise<void>

  // Execution
  executeFunction(
    functionId: string,
    parameters: Record<string, any>,
    context: FunctionExecutionContext
  ): Promise<FunctionResult>

  // Computed views
  getComputedView(
    viewId: string,
    parameters: Record<string, any>,
    context: FunctionExecutionContext
  ): Promise<ComputedViewResult>

  // Monitoring
  getFunctionStats(functionId: string): Promise<FunctionStats>
  getPerformanceMetrics(functionId: string): Promise<PerformanceMetrics>
}

// interfaces/types.ts
export interface StoredFunctionDefinition {
  id: string
  name: string
  description: string
  type: 'computed_view' | 'stored_procedure' | 'scalar_function'

  // TypeScript implementation
  implementation: TypeScriptFunctionImplementation
  typeDefinitions?: string

  // Parameters with TypeScript types
  parameters: TypedFunctionParameter[]
  returnType: TypedFunctionReturnType

  // Security
  security: FunctionSecurity

  // Transaction management
  transaction: TransactionConfig

  // Caching (for computed views)
  caching?: CachingConfig

  // Dependencies
  dependencies: FunctionDependency[]

  // Versioning
  version: string
  deploymentStrategy: DeploymentStrategy

  // Metadata
  createdBy: string
  createdAt: Date
  updatedAt: Date
  isActive: boolean
}

export interface FunctionSecurity {
  executionMode: 'caller_rights' // только caller_rights
  allowedRoles: string[]
  maxExecutionTime: number // configurable
  maxMemoryUsage: number // configurable
  maxDbOperations: number // configurable
  sandboxed: true // всегда в sandbox
}

export interface FunctionExecutionContext {
  // User context
  currentUser: {
    id: string
    email: string
    roles: string[]
    permissions: string[]
    attributes: Record<string, any>
  }

  // Database access
  database: CSDatabase

  // Request context
  requestId: string
  timestamp: Date
  clientInfo?: {
    ip: string
    userAgent: string
  }

  // Execution limits
  limits: ResourceLimits
}

export interface ResourceLimits {
  maxExecutionTime: number // milliseconds
  maxMemoryUsage: number // bytes
  maxDbOperations: number
  maxNetworkRequests: number
  allowedModules: string[]
}
```

### **1.3 TypeScript Sandbox Implementation**

#### **Безопасное выполнение TypeScript кода:**
```typescript
// core/FunctionSandbox.ts
export class FunctionSandbox implements IFunctionSandbox {
  private compiler: TypeScriptCompiler
  private resourceMonitor: ResourceMonitor

  constructor(
    private config: SandboxConfig,
    private logger: ILogger
  ) {
    this.compiler = new TypeScriptCompiler(config.typescript)
    this.resourceMonitor = new ResourceMonitor(config.limits)
  }

  async compileTypeScript(
    code: string,
    types?: string
  ): Promise<CompilationResult> {
    try {
      // Validate TypeScript code
      const validation = await this.validateCode(code)
      if (!validation.isValid) {
        return {
          success: false,
          errors: validation.errors
        }
      }

      // Compile to JavaScript
      const result = await this.compiler.compile(code, types)

      return {
        success: true,
        compiledCode: result.code,
        sourceMap: result.sourceMap,
        warnings: result.warnings
      }
    } catch (error) {
      return {
        success: false,
        errors: [{ message: error.message, line: 0, column: 0 }]
      }
    }
  }

  async executeInSandbox(
    compiledCode: string,
    parameters: Record<string, any>,
    context: FunctionExecutionContext,
    limits: ResourceLimits
  ): Promise<any> {
    const executionId = generateId()

    try {
      // Start resource monitoring
      this.resourceMonitor.startMonitoring(executionId, limits)

      // Create sandbox environment
      const sandbox = this.createSandboxEnvironment(context, limits)

      // Execute function with timeout
      const result = await this.executeWithTimeout(
        compiledCode,
        parameters,
        sandbox,
        limits.maxExecutionTime
      )

      return result
    } finally {
      // Stop monitoring
      this.resourceMonitor.stopMonitoring(executionId)
    }
  }

  private createSandboxEnvironment(
    context: FunctionExecutionContext,
    limits: ResourceLimits
  ): SandboxEnvironment {
    return {
      // Restricted database access
      database: new RestrictedDatabaseProxy(context.database, context.currentUser),

      // User context
      currentUser: context.currentUser,

      // Utility functions
      console: new RestrictedConsole(),

      // No access to Node.js APIs
      require: undefined,
      process: undefined,
      global: undefined,

      // Limited module access
      allowedModules: this.createModuleProxy(limits.allowedModules)
    }
  }
}
```

---

## 🏗️ Day 3-4: Computed Views & Procedures

### **2.1 Computed Views Manager**

#### **Кэшируемые представления с dependency tracking:**
```typescript
// views/ComputedViewManager.ts
export class ComputedViewManager {
  private cache: ViewCache
  private dependencyTracker: DependencyTracker

  constructor(
    private engine: IStoredFunctionEngine,
    private cacheConfig: ViewCacheConfig
  ) {
    this.cache = new ViewCache(cacheConfig)
    this.dependencyTracker = new DependencyTracker()
  }

  async getComputedView(
    viewId: string,
    parameters: Record<string, any>,
    context: FunctionExecutionContext
  ): Promise<ComputedViewResult> {
    const cacheKey = this.generateCacheKey(viewId, parameters, context.currentUser.id)

    // Check cache first
    const cached = await this.cache.get(cacheKey)
    if (cached && !this.isCacheExpired(cached)) {
      return {
        data: cached.data,
        metadata: {
          ...cached.metadata,
          fromCache: true,
          cacheHit: true
        }
      }
    }

    // Execute function
    const result = await this.engine.executeFunction(viewId, parameters, context)

    // Cache result if caching is enabled
    const definition = await this.engine.getFunctionDefinition(viewId)
    if (definition.caching?.enabled) {
      await this.cacheResult(cacheKey, result, definition.caching)

      // Track dependencies for invalidation
      await this.dependencyTracker.trackDependencies(
        viewId,
        definition.dependencies,
        cacheKey
      )
    }

    return {
      data: result.data,
      metadata: {
        ...result.metadata,
        fromCache: false,
        cacheHit: false
      }
    }
  }

  async invalidateView(
    viewId: string,
    trigger: InvalidationTrigger
  ): Promise<void> {
    const affectedKeys = await this.dependencyTracker.getAffectedCacheKeys(
      viewId,
      trigger
    )

    await Promise.all(
      affectedKeys.map(key => this.cache.invalidate(key))
    )
  }
}
```

### **2.2 Stored Procedures Manager**

#### **Бизнес-логика с транзакционной поддержкой:**
```typescript
// procedures/StoredProcedureManager.ts
export class StoredProcedureManager {
  private transactionManager: TransactionManager
  private parameterValidator: ParameterValidator

  constructor(
    private engine: IStoredFunctionEngine,
    private database: CSDatabase
  ) {
    this.transactionManager = new TransactionManager(database)
    this.parameterValidator = new ParameterValidator()
  }

  async executeProcedure(
    procedureId: string,
    parameters: Record<string, any>,
    context: FunctionExecutionContext
  ): Promise<ProcedureResult> {
    const definition = await this.engine.getFunctionDefinition(procedureId)

    // Validate parameters
    const validation = await this.parameterValidator.validate(
      parameters,
      definition.parameters
    )
    if (!validation.isValid) {
      throw new ValidationError('Invalid parameters', validation.errors)
    }

    // Execute in transaction if configured
    if (definition.transaction.autoTransaction) {
      return await this.executeInTransaction(
        procedureId,
        parameters,
        context,
        definition.transaction
      )
    } else {
      return await this.engine.executeFunction(procedureId, parameters, context)
    }
  }

  private async executeInTransaction(
    procedureId: string,
    parameters: Record<string, any>,
    context: FunctionExecutionContext,
    transactionConfig: TransactionConfig
  ): Promise<ProcedureResult> {
    const transaction = await this.transactionManager.beginTransaction({
      isolationLevel: transactionConfig.isolationLevel,
      timeout: transactionConfig.timeout
    })

    try {
      // Execute procedure in transaction context
      const transactionalContext = {
        ...context,
        database: transaction.database
      }

      const result = await this.engine.executeFunction(
        procedureId,
        parameters,
        transactionalContext
      )

      await transaction.commit()
      return result
    } catch (error) {
      await transaction.rollback()
      throw error
    }
  }
}
```

---

## 🏗️ Day 5-6: Deployment & Versioning

### **3.1 Deployment Manager**

#### **Blue-green deployment и A/B testing:**
```typescript
// deployment/DeploymentManager.ts
export class DeploymentManager implements IDeploymentManager {
  private versionManager: VersionManager
  private abTestManager: ABTestManager

  async deployFunction(
    definition: StoredFunctionDefinition,
    strategy: DeploymentStrategy
  ): Promise<DeploymentResult> {
    switch (strategy.type) {
      case 'immediate':
        return await this.deployImmediate(definition)

      case 'blue_green':
        return await this.deployBlueGreen(definition, strategy)

      case 'canary':
        return await this.deployCanary(definition, strategy)

      case 'ab_test':
        return await this.deployABTest(definition, strategy)

      default:
        throw new Error(`Unknown deployment strategy: ${strategy.type}`)
    }
  }

  private async deployBlueGreen(
    definition: StoredFunctionDefinition,
    strategy: DeploymentStrategy
  ): Promise<DeploymentResult> {
    const deploymentId = generateId()

    try {
      // Deploy to green environment
      await this.deployToEnvironment(definition, 'green')

      // Health check
      const healthCheck = await this.performHealthCheck(
        definition.id,
        'green',
        strategy.healthCheckEndpoint
      )

      if (!healthCheck.healthy) {
        throw new Error(`Health check failed: ${healthCheck.error}`)
      }

      // Switch traffic to green
      await this.switchTraffic(definition.id, 'green')

      // Mark blue as inactive
      await this.deactivateEnvironment(definition.id, 'blue')

      return {
        deploymentId,
        success: true,
        environment: 'green',
        version: definition.version,
        deployedAt: new Date()
      }
    } catch (error) {
      // Auto rollback on error
      if (strategy.autoRollbackOnError) {
        await this.rollback(definition.id, deploymentId)
      }

      throw error
    }
  }
}
```

### **3.2 A/B Testing Framework**

#### **Статистически значимое тестирование функций:**
```typescript
// deployment/ABTestManager.ts
export class ABTestManager {
  private statisticsEngine: StatisticsEngine

  async createABTest(
    functionId: string,
    config: ABTestConfig
  ): Promise<ABTest> {
    const test: ABTest = {
      id: generateId(),
      functionId,
      config,
      status: 'running',
      startedAt: new Date(),
      metrics: new Map(),
      participants: new Map()
    }

    // Deploy versions with traffic splitting
    await this.deployVersionsWithSplitting(functionId, config.versions)

    // Start metrics collection
    await this.startMetricsCollection(test)

    return test
  }

  async evaluateTest(testId: string): Promise<ABTestResult> {
    const test = await this.getTest(testId)
    const metrics = await this.collectMetrics(test)

    // Statistical significance analysis
    const analysis = await this.statisticsEngine.analyze(metrics, {
      confidenceLevel: 0.95,
      minimumSampleSize: 1000,
      minimumEffect: 0.05
    })

    return {
      testId,
      winner: analysis.winner,
      confidence: analysis.confidence,
      metrics: analysis.metrics,
      recommendation: analysis.recommendation
    }
  }
}
```

---

## 🏗️ Day 7: Integration & Testing

### **4.1 Auth System Integration**

#### **Интеграция с RBAC и audit logging:**
```typescript
// core/StoredFunctionEngine.ts
export class StoredFunctionEngine implements IStoredFunctionEngine {
  constructor(
    private database: CSDatabase,
    private authManager: IAuthManager,
    private auditLogger: IAuditLogger,
    private config: StoredFunctionEngineConfig
  ) {}

  async executeFunction(
    functionId: string,
    parameters: Record<string, any>,
    context: FunctionExecutionContext
  ): Promise<FunctionResult> {
    const startTime = Date.now()

    try {
      // Authorization check
      await this.checkExecutionPermission(functionId, context.currentUser)

      // Audit log - execution start
      await this.auditLogger.log({
        action: 'function_execution_start',
        userId: context.currentUser.id,
        resource: `function:${functionId}`,
        details: { parameters: this.sanitizeParameters(parameters) }
      })

      // Get function definition
      const definition = await this.getFunctionDefinition(functionId)

      // Validate parameters
      await this.validateParameters(parameters, definition.parameters)

      // Execute in sandbox
      const result = await this.sandbox.executeInSandbox(
        definition.implementation.compiledCode,
        parameters,
        context,
        definition.security
      )

      // Audit log - execution success
      await this.auditLogger.log({
        action: 'function_execution_success',
        userId: context.currentUser.id,
        resource: `function:${functionId}`,
        details: {
          executionTime: Date.now() - startTime,
          resultSize: JSON.stringify(result).length
        }
      })

      return {
        data: result,
        metadata: {
          functionId,
          version: definition.version,
          executionTime: Date.now() - startTime,
          fromCache: false
        }
      }
    } catch (error) {
      // Audit log - execution failure
      await this.auditLogger.log({
        action: 'function_execution_failure',
        userId: context.currentUser.id,
        resource: `function:${functionId}`,
        result: 'failure',
        details: { error: error.message }
      })

      throw error
    }
  }

  private async checkExecutionPermission(
    functionId: string,
    user: any
  ): Promise<void> {
    const definition = await this.getFunctionDefinition(functionId)

    // Check role-based access
    const hasRole = definition.security.allowedRoles.some(role =>
      user.roles.includes(role)
    )

    if (!hasRole) {
      throw new AuthorizationError(
        `User ${user.id} does not have permission to execute function ${functionId}`
      )
    }

    // Additional permission checks can be added here
  }
}
```

### **4.2 Comprehensive Test Suite**

#### **Тестовое покрытие всех компонентов:**
```typescript
// tests/StoredFunctionEngine.test.ts
describe('StoredFunctionEngine', () => {
  let engine: StoredFunctionEngine
  let database: CSDatabase
  let authManager: IAuthManager

  beforeEach(async () => {
    // Setup test environment
    database = new CSDatabase({ adapter: new AdapterMemory() })
    authManager = new AuthManager(database)
    engine = new StoredFunctionEngine(database, authManager)
  })

  describe('Function Registration', () => {
    test('should register valid TypeScript function', async () => {
      const definition: StoredFunctionDefinition = {
        id: 'test-function',
        name: 'Test Function',
        type: 'scalar_function',
        implementation: {
          code: `
            export default function(params: { x: number, y: number }) {
              return params.x + params.y
            }
          `
        },
        parameters: [
          { name: 'x', type: 'number', required: true },
          { name: 'y', type: 'number', required: true }
        ],
        returnType: { type: 'scalar', typeDefinition: 'number' },
        security: {
          executionMode: 'caller_rights',
          allowedRoles: ['user'],
          maxExecutionTime: 5000,
          maxMemoryUsage: 10 * 1024 * 1024,
          maxDbOperations: 100,
          sandboxed: true
        },
        version: '1.0.0'
      }

      await expect(engine.registerFunction(definition)).resolves.not.toThrow()
    })

    test('should reject invalid TypeScript code', async () => {
      const definition: StoredFunctionDefinition = {
        // ... other properties
        implementation: {
          code: 'invalid typescript code {'
        }
      }

      await expect(engine.registerFunction(definition)).rejects.toThrow()
    })
  })

  describe('Function Execution', () => {
    test('should execute function with correct parameters', async () => {
      // Register function first
      await engine.registerFunction(testFunctionDefinition)

      const context: FunctionExecutionContext = {
        currentUser: {
          id: 'user1',
          email: 'test@example.com',
          roles: ['user'],
          permissions: [],
          attributes: {}
        },
        database,
        requestId: 'req1',
        timestamp: new Date()
      }

      const result = await engine.executeFunction(
        'test-function',
        { x: 5, y: 3 },
        context
      )

      expect(result.data).toBe(8)
    })

    test('should enforce security constraints', async () => {
      const context: FunctionExecutionContext = {
        currentUser: {
          id: 'user1',
          roles: ['guest'], // not allowed
          // ... other properties
        }
        // ... other properties
      }

      await expect(
        engine.executeFunction('test-function', { x: 5, y: 3 }, context)
      ).rejects.toThrow(AuthorizationError)
    })
  })

  describe('Computed Views', () => {
    test('should cache view results', async () => {
      // Test caching behavior
    })

    test('should invalidate cache on dependency changes', async () => {
      // Test cache invalidation
    })
  })

  describe('Deployment', () => {
    test('should perform blue-green deployment', async () => {
      // Test deployment strategies
    })

    test('should rollback on deployment failure', async () => {
      // Test rollback functionality
    })
  })
})
```

---

## 📊 Expected Results

### **Deliverables:**
1. **Stored Functions Engine** - полнофункциональная система выполнения TypeScript функций
2. **Computed Views** - кэшируемые представления с dependency tracking
3. **Stored Procedures** - транзакционная бизнес-логика
4. **Deployment System** - версионирование и стратегии развертывания
5. **Security Integration** - полная интеграция с auth системой
6. **Test Suite** - 100+ тестов покрывающих все компоненты

### **Performance Targets:**
- **Function Execution**: < 10ms для простых функций
- **Cache Hit Rate**: > 90% для computed views
- **Deployment Time**: < 30s для blue-green deployment
- **Memory Usage**: < 50MB per function execution
- **Concurrent Executions**: 100+ simultaneous functions

### **Security Features:**
- ✅ Caller rights only execution
- ✅ TypeScript sandbox isolation
- ✅ Resource limits enforcement
- ✅ RBAC integration
- ✅ Comprehensive audit logging

---

## 🚀 Ready to Start!

Все необходимые компоненты готовы для начала реализации Phase 1.6. Система построена на прочном фундаменте Phase 1 (Auth) и Phase 1.5 (Computed Attributes), что обеспечивает seamless интеграцию и высокое качество реализации.

**Следующий шаг**: Начать с Day 1 - создание core infrastructure и interfaces.

---

*Response generated using Claude Sonnet 4*