// TypeScript Transpiler Interface
// Abstraction for different TypeScript to JavaScript transpilation providers

export interface TranspilationOptions {
  target?: 'ES5' | 'ES2015' | 'ES2017' | 'ES2018' | 'ES2019' | 'ES2020' | 'ES2021' | 'ES2022' | 'ESNext'
  module?: 'CommonJS' | 'AMD' | 'UMD' | 'SystemJS' | 'ES6' | 'ES2015' | 'ES2020' | 'ESNext' | 'None'
  strict?: boolean
  sourceMap?: boolean
  minify?: boolean
  removeComments?: boolean
  preserveConstEnums?: boolean
  declaration?: boolean
  allowJs?: boolean
  checkJs?: boolean
  jsx?: 'preserve' | 'react' | 'react-jsx' | 'react-jsxdev'
  experimentalDecorators?: boolean
  emitDecoratorMetadata?: boolean
  skipLibCheck?: boolean
  forceConsistentCasingInFileNames?: boolean
  moduleResolution?: 'node' | 'classic'
  esModuleInterop?: boolean
  allowSyntheticDefaultImports?: boolean
  resolveJsonModule?: boolean
  isolatedModules?: boolean
  noEmitOnError?: boolean
  incremental?: boolean
  tsBuildInfoFile?: string
  plugins?: TranspilerPlugin[]
}

export interface TranspilerPlugin {
  name: string
  options?: Record<string, any>
}

export interface TranspilationResult {
  success: boolean
  code?: string
  sourceMap?: string
  declarations?: string
  errors?: TranspilationError[]
  warnings?: TranspilationWarning[]
  diagnostics?: TranspilationDiagnostic[]
  metadata?: TranspilationMetadata
}

export interface TranspilationError {
  message: string
  file?: string
  line?: number
  column?: number
  code?: string | number
  severity: 'error'
  category?: 'syntax' | 'type' | 'semantic' | 'config'
}

export interface TranspilationWarning {
  message: string
  file?: string
  line?: number
  column?: number
  code?: string | number
  severity: 'warning'
  category?: 'deprecation' | 'performance' | 'style' | 'compatibility'
}

export interface TranspilationDiagnostic {
  message: string
  file?: string
  line?: number
  column?: number
  code?: string | number
  severity: 'info' | 'hint'
  category?: 'suggestion' | 'info'
}

export interface TranspilationMetadata {
  transpiler: string
  version: string
  duration: number
  inputSize: number
  outputSize: number
  compressionRatio?: number
  dependencies?: string[]
  exports?: string[]
  imports?: string[]
}

export interface TypeScriptTranspilerConfig {
  provider: 'esbuild' | 'swc' | 'typescript' | 'rollup' | 'rolldown' | 'babel'
  options: TranspilationOptions
  caching?: {
    enabled: boolean
    maxSize: number
    ttl: number
  }
  performance?: {
    timeout: number
    memoryLimit: number
  }
  security?: {
    allowedImports: string[]
    blockedImports: string[]
    allowNodeModules: boolean
    allowRelativeImports: boolean
    allowAbsoluteImports: boolean
  }
}

/**
 * Abstract interface for TypeScript to JavaScript transpilation
 * Allows switching between different transpilation providers
 */
export interface ITypeScriptTranspiler {
  /**
   * Get transpiler information
   */
  getInfo(): {
    name: string
    version: string
    provider: string
    capabilities: string[]
  }

  /**
   * Transpile TypeScript code to JavaScript
   */
  transpile(
    code: string,
    filename?: string,
    options?: Partial<TranspilationOptions>
  ): Promise<TranspilationResult>

  /**
   * Transpile multiple files
   */
  transpileFiles(
    files: Array<{ filename: string; code: string }>,
    options?: Partial<TranspilationOptions>
  ): Promise<Array<TranspilationResult & { filename: string }>>

  /**
   * Validate TypeScript code without transpilation
   */
  validate(
    code: string,
    filename?: string,
    options?: Partial<TranspilationOptions>
  ): Promise<{
    valid: boolean
    errors: TranspilationError[]
    warnings: TranspilationWarning[]
    diagnostics: TranspilationDiagnostic[]
  }>

  /**
   * Get type information for code
   */
  getTypeInfo(
    code: string,
    position: { line: number; column: number },
    filename?: string
  ): Promise<{
    type?: string
    documentation?: string
    signature?: string
    completions?: Array<{
      name: string
      type: string
      documentation?: string
    }>
  }>

  /**
   * Transform code with custom transformers
   */
  transform(
    code: string,
    transformers: TranspilerPlugin[],
    options?: Partial<TranspilationOptions>
  ): Promise<TranspilationResult>

  /**
   * Check if transpiler supports specific features
   */
  supports(feature: string): boolean

  /**
   * Get default configuration for this transpiler
   */
  getDefaultConfig(): TranspilationOptions

  /**
   * Dispose resources and cleanup
   */
  dispose(): Promise<void>
}

/**
 * Factory for creating TypeScript transpilers
 */
export interface ITypeScriptTranspilerFactory {
  /**
   * Create transpiler instance
   */
  create(config: TypeScriptTranspilerConfig): Promise<ITypeScriptTranspiler>

  /**
   * Get available transpiler providers
   */
  getAvailableProviders(): Array<{
    name: string
    version?: string
    available: boolean
    capabilities: string[]
  }>

  /**
   * Check if provider is available
   */
  isProviderAvailable(provider: string): Promise<boolean>
}

/**
 * Transpiler registry for managing multiple transpilers
 */
export interface ITypeScriptTranspilerRegistry {
  /**
   * Register transpiler
   */
  register(name: string, transpiler: ITypeScriptTranspiler): void

  /**
   * Get transpiler by name
   */
  get(name: string): ITypeScriptTranspiler | undefined

  /**
   * Get default transpiler
   */
  getDefault(): ITypeScriptTranspiler

  /**
   * Set default transpiler
   */
  setDefault(name: string): void

  /**
   * List all registered transpilers
   */
  list(): Array<{
    name: string
    info: ReturnType<ITypeScriptTranspiler['getInfo']>
  }>

  /**
   * Dispose all transpilers
   */
  dispose(): Promise<void>
}