# 🚀 Phase 2: Advanced Authorization (RBAC + ABAC) - Implementation Plan

## 📋 СТАТУС: ГОТОВ К СТАРТУ ✅

### **Проверка готовности:**
- ✅ **Phase 1**: Authentication & Authorization Foundation - ЗАВЕРШЕНА (120/120 тестов)
- ✅ **Phase 1.5**: Computed Attributes System - ЗАВЕРШЕНА (195/195 тестов)
- ✅ **Phase 1.6**: Stored Functions & Procedures - ЗАВЕРШЕНА (50/50 тестов)
- ✅ **Инфраструктура**: CSDatabase, TypedCollection, WAL, Transactions - ГОТОВА
- ✅ **Базовый RBAC**: RoleManager, UserManager, TokenManager - РЕАЛИЗОВАНЫ

---

## 🎯 Цели Phase 2

### **Основные задачи:**
1. **Hybrid Authorization Engine** - гибридная система RBAC + ABAC
2. **Dynamic Rules System** - JavaScript-based правила доступа
3. **Granular Access Control** - контроль на всех уровнях (database/collection/document/field)
4. **Permission Caching System** - высокопроизводительное кэширование
5. **Attribute-Based Access Control** - интеграция с computed attributes
6. **Advanced Security Policies** - сложные политики безопасности

### **Ключевые принципы:**
- **Deny by Default** - атрибуты побеждают роли при запрете доступа
- **Performance First** - кэширование всех permission checks
- **Configurable Security** - все параметры настраиваются
- **Audit Everything** - полное логирование всех решений

---

## 📅 Timeline: 2-3 недели (14-21 день)

### **Week 1: Core Authorization Engine**
- Day 1-3: Hybrid Authorization Engine
- Day 4-5: Dynamic Rules System
- Day 6-7: Basic ABAC Integration

### **Week 2: Advanced Features**
- Day 8-10: Granular Access Control
- Day 11-12: Permission Caching System
- Day 13-14: Security Policies

### **Week 3: Integration & Testing**
- Day 15-17: Full Integration Testing
- Day 18-19: Performance Optimization
- Day 20-21: Documentation & Examples

---

## 🏗️ Week 1: Core Authorization Engine

### **Day 1-3: Hybrid Authorization Engine**

#### **1.1 Project Structure Setup**

```
src/auth/authorization/
├── core/
│   ├── AuthorizationEngine.ts       # Main hybrid engine
│   ├── RBACEngine.ts               # Role-based logic
│   ├── ABACEngine.ts               # Attribute-based logic
│   ├── PolicyEvaluator.ts          # Policy evaluation
│   └── index.ts                    # Core exports
├── rules/
│   ├── DynamicRuleManager.ts       # Dynamic rules management
│   ├── RuleEvaluator.ts            # JavaScript rule execution
│   ├── BuiltInRules.ts             # Predefined rules
│   └── index.ts                    # Rules exports
├── cache/
│   ├── PermissionCache.ts          # Permission caching
│   ├── CacheInvalidator.ts         # Cache invalidation
│   ├── CacheStats.ts               # Cache statistics
│   └── index.ts                    # Cache exports
├── policies/
│   ├── SecurityPolicyManager.ts    # Security policies
│   ├── AccessControlMatrix.ts      # Granular control
│   ├── FieldLevelSecurity.ts       # Field-level access
│   └── index.ts                    # Policies exports
├── interfaces/
│   ├── IAuthorizationEngine.ts     # Main interface
│   ├── IDynamicRule.ts             # Rule interface
│   ├── ISecurityPolicy.ts          # Policy interface
│   ├── types.ts                    # Core types
│   └── index.ts                    # Interface exports
├── tests/
│   ├── AuthorizationEngine.test.ts # Engine tests
│   ├── DynamicRules.test.ts        # Rules tests
│   ├── PermissionCache.test.ts     # Cache tests
│   ├── SecurityPolicies.test.ts    # Policy tests
│   └── Integration.test.ts         # Integration tests
└── index.ts                        # Main exports
```

#### **1.2 Core Authorization Engine**

```typescript
// core/AuthorizationEngine.ts
export class AuthorizationEngine implements IAuthorizationEngine {
  private rbacEngine: RBACEngine
  private abacEngine: ABACEngine
  private policyEvaluator: PolicyEvaluator
  private permissionCache: PermissionCache
  private ruleManager: DynamicRuleManager

  constructor(
    private database: CSDatabase,
    private auditLogger: IAuditLogger,
    private config: AuthorizationConfig
  ) {
    this.rbacEngine = new RBACEngine(database, config.rbac)
    this.abacEngine = new ABACEngine(database, config.abac)
    this.policyEvaluator = new PolicyEvaluator(config.policies)
    this.permissionCache = new PermissionCache(config.cache)
    this.ruleManager = new DynamicRuleManager(database, config.rules)
  }

  async checkPermission(
    user: User,
    resource: ResourceDescriptor,
    action: string,
    context?: AuthContext
  ): Promise<AuthorizationResult> {
    const startTime = Date.now()
    const cacheKey = this.generateCacheKey(user.id, resource, action, context)

    try {
      // Check cache first
      const cached = await this.permissionCache.get(cacheKey)
      if (cached && !this.isCacheExpired(cached)) {
        await this.auditLogger.log({
          action: 'permission_check',
          userId: user.id,
          resource: this.resourceToString(resource),
          result: cached.allowed ? 'allowed' : 'denied',
          details: { fromCache: true, reason: cached.reason }
        })

        return { ...cached, cacheHit: true }
      }

      // Evaluate permissions
      const result = await this.evaluatePermission(user, resource, action, context)

      // Cache result
      await this.permissionCache.set(cacheKey, result, this.config.cache.ttl)

      // Audit log
      await this.auditLogger.log({
        action: 'permission_check',
        userId: user.id,
        resource: this.resourceToString(resource),
        result: result.allowed ? 'allowed' : 'denied',
        details: {
          fromCache: false,
          reason: result.reason,
          appliedRules: result.appliedRules,
          evaluationTime: Date.now() - startTime
        }
      })

      return { ...result, cacheHit: false }
    } catch (error) {
      await this.auditLogger.log({
        action: 'permission_check_error',
        userId: user.id,
        resource: this.resourceToString(resource),
        result: 'error',
        details: { error: error.message }
      })

      throw error
    }
  }

  private async evaluatePermission(
    user: User,
    resource: ResourceDescriptor,
    action: string,
    context?: AuthContext
  ): Promise<AuthorizationResult> {
    const evaluationContext = {
      user,
      resource,
      action,
      context: context || {},
      timestamp: Date.now()
    }

    // Step 1: Check RBAC permissions
    const rbacResult = await this.rbacEngine.checkPermission(
      user,
      resource,
      action,
      evaluationContext
    )

    // Step 2: Check ABAC attributes
    const abacResult = await this.abacEngine.checkPermission(
      user,
      resource,
      action,
      evaluationContext
    )

    // Step 3: Evaluate dynamic rules
    const rulesResult = await this.ruleManager.evaluateRules(
      user,
      resource,
      action,
      evaluationContext
    )

    // Step 4: Apply security policies
    const policyResult = await this.policyEvaluator.evaluate(
      user,
      resource,
      action,
      evaluationContext
    )

    // Step 5: Combine results (deny by default)
    return this.combineResults([rbacResult, abacResult, rulesResult, policyResult])
  }

  private combineResults(results: AuthorizationResult[]): AuthorizationResult {
    // Deny by default - any deny overrides allows
    const denyResult = results.find(r => !r.allowed)
    if (denyResult) {
      return {
        allowed: false,
        reason: `Denied by ${denyResult.reason}`,
        appliedRules: results.flatMap(r => r.appliedRules),
        cacheHit: false
      }
    }

    // All results allow
    return {
      allowed: true,
      reason: 'Allowed by combined evaluation',
      appliedRules: results.flatMap(r => r.appliedRules),
      cacheHit: false
    }
  }
}
```

### **Day 4-5: Dynamic Rules System**

#### **2.1 Dynamic Rule Manager**

```typescript
// rules/DynamicRuleManager.ts
export class DynamicRuleManager {
  private rules = new Map<string, DynamicRule>()
  private ruleEvaluator: RuleEvaluator

  constructor(
    private database: CSDatabase,
    private config: DynamicRulesConfig
  ) {
    this.ruleEvaluator = new RuleEvaluator(config.sandbox)
    this.loadRulesFromDatabase()
  }

  async addRule(rule: DynamicRule): Promise<void> {
    // Validate rule
    const validation = await this.validateRule(rule)
    if (!validation.valid) {
      throw new ValidationError('Invalid rule', validation.errors)
    }

    // Store in database
    const rulesCollection = this.database.collection('dynamic_rules')
    await rulesCollection.insertOne(rule)

    // Cache in memory
    this.rules.set(rule.id, rule)
  }

  async evaluateRules(
    user: User,
    resource: ResourceDescriptor,
    action: string,
    context: EvaluationContext
  ): Promise<AuthorizationResult> {
    const applicableRules = this.getApplicableRules(resource, action)
    const appliedRules: string[] = []

    // Sort by priority (higher priority first)
    const sortedRules = applicableRules.sort((a, b) => b.priority - a.priority)

    for (const rule of sortedRules) {
      try {
        const result = await this.ruleEvaluator.evaluate(
          rule,
          user,
          resource,
          context
        )

        appliedRules.push(rule.id)

        // If rule denies, return immediately (deny by default)
        if (rule.type === 'deny' && result) {
          return {
            allowed: false,
            reason: `Denied by rule: ${rule.name}`,
            appliedRules,
            cacheHit: false
          }
        }

        // If rule allows, continue to check other rules
        if (rule.type === 'allow' && result) {
          // Continue checking for potential denies
        }
      } catch (error) {
        // Log rule evaluation error but continue
        console.error(`Error evaluating rule ${rule.id}:`, error)
      }
    }

    // No deny rules triggered
    return {
      allowed: true,
      reason: 'No deny rules triggered',
      appliedRules,
      cacheHit: false
    }
  }
}
```

#### **2.2 Built-in Rules**

```typescript
// rules/BuiltInRules.ts
export const BUILT_IN_RULES: DynamicRule[] = [
  {
    id: 'ownership-rule',
    name: 'Document Ownership',
    description: 'Allow access to documents owned by user',
    priority: 100,
    type: 'allow',
    scope: {
      resources: ['document'],
      actions: ['read', 'write', 'delete']
    },
    evaluator: async (user, resource, context) => {
      if (resource.type !== 'document') return false

      const document = await context.database
        .collection(resource.collection!)
        .findOne({ _id: resource.documentId })

      return document?.ownerId === user.id
    },
    isBuiltIn: true,
    isActive: true,
    createdBy: 'system',
    createdAt: new Date()
  },

  {
    id: 'business-hours-rule',
    name: 'Business Hours Access',
    description: 'Restrict access outside business hours',
    priority: 50,
    type: 'deny',
    scope: {
      resources: ['database', 'collection', 'document'],
      actions: ['write', 'delete']
    },
    evaluator: async (user, resource, context) => {
      const hour = new Date(context.timestamp).getHours()
      const isBusinessHours = hour >= 9 && hour <= 17

      // Deny if outside business hours (unless admin)
      return !isBusinessHours && !user.roles.includes('admin')
    },
    isBuiltIn: true,
    isActive: false, // disabled by default
    createdBy: 'system',
    createdAt: new Date()
  },

  {
    id: 'region-restriction-rule',
    name: 'Regional Access Control',
    description: 'Restrict access based on user region',
    priority: 75,
    type: 'deny',
    scope: {
      resources: ['database', 'collection', 'document'],
      actions: ['read', 'write', 'delete']
    },
    evaluator: async (user, resource, context) => {
      const userRegions = user.attributes?.allowedRegions || []
      const requestRegion = context.context?.region

      if (!requestRegion) return false

      // Deny if user not allowed in this region
      return !userRegions.includes(requestRegion)
    },
    isBuiltIn: true,
    isActive: false, // disabled by default
    createdBy: 'system',
    createdAt: new Date()
  }
]
```

---

## 🏗️ Week 2: Advanced Features

### **Day 8-10: Granular Access Control**

#### **3.1 Access Control Matrix**

```typescript
// policies/AccessControlMatrix.ts
export class AccessControlMatrix {
  private fieldPolicies = new Map<string, FieldSecurityPolicy>()
  private documentPolicies = new Map<string, DocumentSecurityPolicy>()

  async checkFieldAccess(
    user: User,
    field: FieldDescriptor,
    action: 'read' | 'write',
    context: AuthContext
  ): Promise<FieldAccessResult> {
    const policyKey = `${field.collection}.${field.fieldPath}`
    const policy = this.fieldPolicies.get(policyKey)

    if (!policy) {
      return { allowed: true, visibility: 'visible' }
    }

    // Evaluate field-level rules
    const result = await this.evaluateFieldPolicy(user, field, action, policy, context)

    return result
  }

  private async evaluateFieldPolicy(
    user: User,
    field: FieldDescriptor,
    action: 'read' | 'write',
    policy: FieldSecurityPolicy,
    context: AuthContext
  ): Promise<FieldAccessResult> {
    // Check role-based access
    const hasRole = policy.allowedRoles.some(role => user.roles.includes(role))
    if (!hasRole) {
      return {
        allowed: false,
        visibility: 'hidden',
        reason: 'Insufficient role permissions'
      }
    }

    // Check attribute-based conditions
    if (policy.conditions) {
      for (const condition of policy.conditions) {
        const conditionResult = await this.evaluateCondition(
          user,
          field,
          condition,
          context
        )

        if (!conditionResult) {
          return {
            allowed: false,
            visibility: policy.denyVisibility || 'hidden',
            reason: `Failed condition: ${condition.name}`
          }
        }
      }
    }

    // Apply masking if configured
    if (action === 'read' && policy.masking) {
      return {
        allowed: true,
        visibility: 'masked',
        maskingRule: policy.masking.rule,
        reason: 'Access granted with masking'
      }
    }

    return {
      allowed: true,
      visibility: 'visible',
      reason: 'Full access granted'
    }
  }
}
```

### **Day 11-12: Permission Caching System**

#### **4.1 High-Performance Caching**

```typescript
// cache/PermissionCache.ts
export class PermissionCache implements IPermissionCache {
  private cache = new Map<string, CachedPermission>()
  private stats: CacheStats
  private invalidationPatterns = new Map<string, Set<string>>()

  constructor(private config: PermissionCacheConfig) {
    this.stats = {
      hits: 0,
      misses: 0,
      evictions: 0,
      totalRequests: 0
    }

    // Setup automatic cleanup
    setInterval(() => this.cleanup(), config.cleanupInterval || 60000)
  }

  async get(key: string): Promise<AuthorizationResult | null> {
    this.stats.totalRequests++

    const cached = this.cache.get(key)
    if (!cached) {
      this.stats.misses++
      return null
    }

    if (this.isExpired(cached)) {
      this.cache.delete(key)
      this.stats.misses++
      return null
    }

    this.stats.hits++
    return cached.result
  }

  async set(
    key: string,
    result: AuthorizationResult,
    ttl: number
  ): Promise<void> {
    const cached: CachedPermission = {
      result,
      cachedAt: Date.now(),
      expiresAt: Date.now() + ttl,
      accessCount: 0
    }

    // Check cache size limit
    if (this.cache.size >= this.config.maxSize) {
      this.evictLRU()
    }

    this.cache.set(key, cached)

    // Index for pattern-based invalidation
    this.indexForInvalidation(key, result)
  }

  async invalidatePattern(pattern: string): Promise<void> {
    const keysToInvalidate = this.invalidationPatterns.get(pattern) || new Set()

    for (const key of keysToInvalidate) {
      this.cache.delete(key)
    }

    this.invalidationPatterns.delete(pattern)
  }

  getStats(): CacheStats {
    return {
      ...this.stats,
      hitRate: this.stats.hits / this.stats.totalRequests,
      missRate: this.stats.misses / this.stats.totalRequests,
      size: this.cache.size,
      memoryUsage: this.estimateMemoryUsage()
    }
  }
}
```

---

## 📊 Expected Results

### **Deliverables:**
1. **Hybrid Authorization Engine** - RBAC + ABAC система
2. **Dynamic Rules System** - JavaScript-based правила
3. **Granular Access Control** - field-level security
4. **Permission Caching** - высокопроизводительное кэширование
5. **Security Policies** - комплексные политики безопасности
6. **Test Suite** - 150+ тестов покрывающих все компоненты

### **Performance Targets:**
- **Permission Check**: < 1ms для cached permissions
- **Rule Evaluation**: < 5ms для complex rules
- **Cache Hit Rate**: > 95% для repeated checks
- **Memory Usage**: < 100MB для cache
- **Concurrent Checks**: 1000+ simultaneous permission checks

### **Security Features:**
- ✅ Deny by default principle
- ✅ Attribute-based access control
- ✅ Dynamic rule evaluation
- ✅ Field-level security
- ✅ Comprehensive audit logging

---

## 🚀 Ready to Start Phase 2!

Все компоненты Phase 1, 1.5 и 1.6 успешно завершены. Система готова для реализации advanced authorization с полной интеграцией существующих компонентов.

**Следующий шаг**: Начать с Week 1 - создание Hybrid Authorization Engine.

---

*Response generated using Claude Sonnet 4*