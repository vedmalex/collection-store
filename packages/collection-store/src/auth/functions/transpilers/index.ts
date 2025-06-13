// TypeScript Transpilers - Exports
// Pluggable TypeScript to JavaScript transpilation system

// Main interfaces
export * from '../interfaces/ITypeScriptTranspiler'

// Factory and registry
export * from './TypeScriptTranspilerFactory'

// Transpiler implementations
export * from './ESBuildTranspiler'

// TODO: Add other transpiler implementations
// export * from './SWCTranspiler'
// export * from './TypeScriptTranspiler'
// export * from './RollupTranspiler'
// export * from './RolldownTranspiler'
// export * from './BabelTranspiler'

// Convenience re-exports
export type {
  ITypeScriptTranspiler,
  ITypeScriptTranspilerFactory,
  ITypeScriptTranspilerRegistry,
  TypeScriptTranspilerConfig,
  TranspilationOptions,
  TranspilationResult,
  TranspilationError,
  TranspilationWarning,
  TranspilationDiagnostic,
  TranspilationMetadata,
  TranspilerPlugin
} from '../interfaces/ITypeScriptTranspiler'

export {
  TypeScriptTranspilerFactory,
  getDefaultTranspilerConfig,
  DEFAULT_TRANSPILER_CONFIGS
} from './TypeScriptTranspilerFactory'

export { ESBuildTranspiler } from './ESBuildTranspiler'