import type { User, AuthContext } from '../../interfaces/types'

// Resource descriptor for authorization
export interface ResourceDescriptor {
  type: 'database' | 'collection' | 'document' | 'field'
  database?: string
  collection?: string
  documentId?: string
  fieldPath?: string
  metadata?: Record<string, any>
}

// Authorization result
export interface AuthorizationResult {
  allowed: boolean
  reason: string
  appliedRules: string[]
  cacheHit: boolean
  evaluationTime?: number
  metadata?: Record<string, any>
}

// Evaluation context for authorization
export interface EvaluationContext {
  user: User
  resource: ResourceDescriptor
  action: string
  context: AuthContext
  timestamp: number
  nodeId?: string
  customData?: Record<string, any>
}

// Authorization configuration
export interface AuthorizationConfig {
  rbac: RBACConfig
  abac: ABACConfig
  cache: PermissionCacheConfig
  rules: DynamicRulesConfig
  policies: SecurityPoliciesConfig
}

export interface RBACConfig {
  enabled: boolean
  strictMode: boolean
  inheritanceEnabled: boolean
  defaultDeny: boolean
}

export interface ABACConfig {
  enabled: boolean
  attributeEngine: string // reference to computed attribute engine
  contextAttributes: string[]
  defaultDeny: boolean
}

export interface PermissionCacheConfig {
  enabled: boolean
  ttl: number // seconds
  maxSize: number
  strategy: 'lru' | 'lfu' | 'ttl'
  cleanupInterval: number
}

export interface DynamicRulesConfig {
  enabled: boolean
  sandbox: SandboxConfig
  maxExecutionTime: number
  maxMemoryUsage: number
}

export interface SandboxConfig {
  allowedModules: string[]
  networkAccess: boolean
  fileSystemAccess: boolean
  timeout: number
}

export interface SecurityPoliciesConfig {
  enabled: boolean
  defaultPolicy: 'allow' | 'deny'
  policyEvaluationOrder: string[]
}

// Field-level access control
export interface FieldDescriptor {
  collection: string
  fieldPath: string
  documentId?: string
}

export interface FieldAccessResult {
  allowed: boolean
  visibility: 'visible' | 'hidden' | 'masked'
  maskingRule?: (value: any) => any
  reason?: string
}

// Cache-related types
export interface CachedPermission {
  result: AuthorizationResult
  cachedAt: number
  expiresAt: number
  accessCount: number
}

export interface CacheStats {
  hits: number
  misses: number
  evictions: number
  totalRequests: number
  hitRate?: number
  missRate?: number
  size?: number
  memoryUsage?: number
}