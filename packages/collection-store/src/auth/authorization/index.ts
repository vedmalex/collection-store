// Main Authorization Engine
export { AuthorizationEngine } from './core/AuthorizationEngine'

// Individual Engines
export { RBACEngine } from './core/RBACEngine'
export { ABACEngine } from './core/ABACEngine'
export { PolicyEvaluator } from './core/PolicyEvaluator'

// Interfaces and Types
export type {
  IAuthorizationEngine,
  DynamicRule,
  AuthorizationConfig,
  AuthorizationHealthStatus,
  ResourceDescriptor,
  AuthorizationResult,
  EvaluationContext,
  RBACConfig,
  ABACConfig,
  PermissionCacheConfig,
  DynamicRulesConfig,
  SandboxConfig,
  SecurityPoliciesConfig,
  FieldDescriptor,
  FieldAccessResult,
  CachedPermission,
  CacheStats
} from './interfaces'

// Re-export core exports
export * from './core'