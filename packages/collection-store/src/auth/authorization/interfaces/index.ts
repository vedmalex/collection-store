// Main interfaces
export type { IAuthorizationEngine } from './IAuthorizationEngine'

// Core types
export type {
  ResourceDescriptor,
  AuthorizationResult,
  EvaluationContext,
  AuthorizationConfig,
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
} from './types'

// Re-export from IAuthorizationEngine
export type {
  DynamicRule,
  AuthorizationHealthStatus
} from './IAuthorizationEngine'