// Computed Attributes Interfaces - Centralized Exports
// All interfaces for computed attributes system

// Core interfaces
export * from './IComputedAttributeEngine'
export * from './IComputedAttributeCache'

// Re-export with aliases for convenience
export type {
  IComputedAttributeEngine as ICAEngine,
  ComputedAttributeEvent as CAEvent
} from './IComputedAttributeEngine'

export type {
  IComputedAttributeCache as ICACache,
  CacheEvent as CACacheEvent
} from './IComputedAttributeCache'
