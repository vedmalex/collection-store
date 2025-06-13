// Core Authorization Engine exports
export { AuthorizationEngine } from './AuthorizationEngine'
export { RBACEngine } from './RBACEngine'
export { ABACEngine } from './ABACEngine'
export { PolicyEvaluator } from './PolicyEvaluator'

// Re-export types
export type {
  IAuthorizationEngine,
  AuthorizationResult,
  ResourceDescriptor,
  EvaluationContext
} from '../interfaces/index'