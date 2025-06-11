// Core interfaces
export * from './interfaces/IConfigurationComponent';
export * from './interfaces/IComponentRegistry';

// Types
export * from './types/ComponentTypes';

// Core classes
export { ComponentRegistry } from './ComponentRegistry';
export { BaseConfigurationComponent } from './BaseConfigurationComponent';

// Re-export for convenience
export type {
  IConfigurationComponent,
  ComponentHealth,
  ComponentMetadata,
  ComponentLifecycleState,
  ComponentEvents
} from './interfaces/IConfigurationComponent';

export type {
  IComponentRegistry,
  RegistryStats,
  RegistryEvent,
  RegistryEventCallback,
  RegistryEventData
} from './interfaces/IComponentRegistry';

export type {
  ComponentRegistration,
  DependencyNode,
  DependencyResolution,
  ComponentConfig,
  RegistryConfig,
  ComponentFactory,
  ComponentFactoryRegistration,
  ComponentOperationResult,
  BatchOperationResult,
  HealthCheckConfig,
  ComponentMetrics
} from './types/ComponentTypes';