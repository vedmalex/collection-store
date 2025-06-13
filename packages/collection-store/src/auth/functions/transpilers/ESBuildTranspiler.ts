// ESBuild TypeScript Transpiler Implementation
import { performance } from 'perf_hooks'
import type {
  ITypeScriptTranspiler,
  TranspilationOptions,
  TranspilationResult,
  TranspilationError,
  TranspilationWarning,
  TranspilationDiagnostic,
  TranspilerPlugin,
  TypeScriptTranspilerConfig
} from '../interfaces/ITypeScriptTranspiler'

/**
 * ESBuild-based TypeScript transpiler
 * Fast and efficient transpilation using esbuild
 */
export class ESBuildTranspiler implements ITypeScriptTranspiler {
  private esbuild: any
  private config: TypeScriptTranspilerConfig
  private cache = new Map<string, { result: TranspilationResult; timestamp: number }>()

  constructor(config: TypeScriptTranspilerConfig) {
    this.config = config
  }

  async initialize(): Promise<void> {
    try {
      // Dynamic import to avoid bundling issues
      this.esbuild = await import('esbuild')
    } catch (error) {
      throw new Error(`Failed to load esbuild: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }
  }

  getInfo() {
    return {
      name: 'ESBuild TypeScript Transpiler',
      version: this.esbuild?.version || 'unknown',
      provider: 'esbuild',
      capabilities: [
        'typescript',
        'javascript',
        'jsx',
        'tsx',
        'sourcemaps',
        'minification',
        'bundling',
        'tree-shaking',
        'code-splitting'
      ]
    }
  }

  async transpile(
    code: string,
    filename = 'input.ts',
    options: Partial<TranspilationOptions> = {}
  ): Promise<TranspilationResult> {
    if (!this.esbuild) {
      await this.initialize()
    }

    const startTime = performance.now()
    const cacheKey = this.generateCacheKey(code, filename, options)

    // Check cache
    if (this.config.caching?.enabled) {
      const cached = this.cache.get(cacheKey)
      if (cached && (Date.now() - cached.timestamp) < (this.config.caching.ttl * 1000)) {
        return cached.result
      }
    }

    try {
      const mergedOptions = { ...this.config.options, ...options }
      const esbuildOptions = this.convertToESBuildOptions(mergedOptions, filename)

      const result = await this.esbuild.transform(code, esbuildOptions)

      const transpilationResult: TranspilationResult = {
        success: true,
        code: result.code,
        sourceMap: result.map,
        errors: this.convertErrors(result.errors || []),
        warnings: this.convertWarnings(result.warnings || []),
        diagnostics: [],
        metadata: {
          transpiler: 'esbuild',
          version: this.esbuild.version,
          duration: performance.now() - startTime,
          inputSize: code.length,
          outputSize: result.code?.length || 0,
          compressionRatio: result.code ? code.length / result.code.length : 1
        }
      }

      // Cache result
      if (this.config.caching?.enabled) {
        this.cache.set(cacheKey, {
          result: transpilationResult,
          timestamp: Date.now()
        })

        // Clean up old cache entries
        this.cleanupCache()
      }

      return transpilationResult
    } catch (error) {
      return {
        success: false,
        errors: [{
          message: error instanceof Error ? error.message : 'Unknown transpilation error',
          file: filename,
          line: 0,
          column: 0,
          severity: 'error' as const,
          category: 'syntax'
        }],
        warnings: [],
        diagnostics: [],
        metadata: {
          transpiler: 'esbuild',
          version: this.esbuild?.version || 'unknown',
          duration: performance.now() - startTime,
          inputSize: code.length,
          outputSize: 0
        }
      }
    }
  }

  async transpileFiles(
    files: Array<{ filename: string; code: string }>,
    options: Partial<TranspilationOptions> = {}
  ): Promise<Array<TranspilationResult & { filename: string }>> {
    const results = await Promise.all(
      files.map(async (file) => {
        const result = await this.transpile(file.code, file.filename, options)
        return { ...result, filename: file.filename }
      })
    )

    return results
  }

  async validate(
    code: string,
    filename = 'input.ts',
    options: Partial<TranspilationOptions> = {}
  ): Promise<{
    valid: boolean
    errors: TranspilationError[]
    warnings: TranspilationWarning[]
    diagnostics: TranspilationDiagnostic[]
  }> {
    const result = await this.transpile(code, filename, { ...options, noEmitOnError: true })

    return {
      valid: result.success && (result.errors?.length || 0) === 0,
      errors: result.errors || [],
      warnings: result.warnings || [],
      diagnostics: result.diagnostics || []
    }
  }

  async getTypeInfo(
    code: string,
    position: { line: number; column: number },
    filename = 'input.ts'
  ): Promise<{
    type?: string
    documentation?: string
    signature?: string
    completions?: Array<{ name: string; type: string; documentation?: string }>
  }> {
    // ESBuild doesn't provide type information
    // This would require TypeScript compiler API
    return {
      type: undefined,
      documentation: 'Type information not available with esbuild',
      signature: undefined,
      completions: []
    }
  }

  async transform(
    code: string,
    transformers: TranspilerPlugin[],
    options: Partial<TranspilationOptions> = {}
  ): Promise<TranspilationResult> {
    // ESBuild plugins would be handled here
    // For now, just transpile normally
    return this.transpile(code, 'input.ts', options)
  }

  supports(feature: string): boolean {
    const supportedFeatures = [
      'typescript',
      'javascript',
      'jsx',
      'tsx',
      'sourcemaps',
      'minification',
      'es5',
      'es2015',
      'es2017',
      'es2018',
      'es2019',
      'es2020',
      'es2021',
      'es2022',
      'esnext'
    ]

    return supportedFeatures.includes(feature.toLowerCase())
  }

  getDefaultConfig(): TranspilationOptions {
    return {
      target: 'ES2020',
      module: 'CommonJS',
      strict: true,
      sourceMap: true,
      minify: false,
      removeComments: false,
      allowJs: true,
      skipLibCheck: true,
      esModuleInterop: true,
      allowSyntheticDefaultImports: true,
      isolatedModules: true
    }
  }

  async dispose(): Promise<void> {
    this.cache.clear()
    // ESBuild doesn't require explicit cleanup
  }

  // Private helper methods

  private convertToESBuildOptions(options: TranspilationOptions, filename: string): any {
    const loader = this.getLoader(filename)
    const target = this.convertTarget(options.target)

    const esbuildOptions: any = {
      loader,
      target,
      format: this.convertModule(options.module),
      sourcemap: options.sourceMap ? 'inline' : false,
      minify: options.minify || false,
      jsx: options.jsx === 'react' ? 'transform' : options.jsx,
      define: {},
      platform: 'node',
      charset: 'utf8'
    }

    // keepNames is not compatible with ES5
    if (target !== 'es5') {
      esbuildOptions.keepNames = !options.removeComments
    }

    return esbuildOptions
  }

  private getLoader(filename: string): string {
    const ext = filename.split('.').pop()?.toLowerCase()

    switch (ext) {
      case 'ts':
        return 'ts'
      case 'tsx':
        return 'tsx'
      case 'jsx':
        return 'jsx'
      case 'js':
        return 'js'
      default:
        return 'ts'
    }
  }

  private convertTarget(target?: string): string {
    switch (target) {
      case 'ES5':
        return 'es5'
      case 'ES2015':
      case 'ES6':
        return 'es2015'
      case 'ES2017':
        return 'es2017'
      case 'ES2018':
        return 'es2018'
      case 'ES2019':
        return 'es2019'
      case 'ES2020':
        return 'es2020'
      case 'ES2021':
        return 'es2021'
      case 'ES2022':
        return 'es2022'
      case 'ESNext':
        return 'esnext'
      default:
        return 'es2020'
    }
  }

  private convertModule(module?: string): string {
    switch (module) {
      case 'CommonJS':
        return 'cjs'
      case 'ES6':
      case 'ES2015':
      case 'ES2020':
      case 'ESNext':
        return 'esm'
      case 'None':
        return 'iife'
      default:
        return 'cjs'
    }
  }

  private convertErrors(messages: any[]): TranspilationError[] {
    return messages.map(msg => ({
      message: msg.text,
      file: msg.location?.file,
      line: msg.location?.line,
      column: msg.location?.column,
      code: msg.id,
      severity: 'error' as const,
      category: this.categorizeMessage(msg.text) as 'syntax' | 'type' | 'semantic' | 'config'
    }))
  }

  private convertWarnings(messages: any[]): TranspilationWarning[] {
    return messages.map(msg => ({
      message: msg.text,
      file: msg.location?.file,
      line: msg.location?.line,
      column: msg.location?.column,
      code: msg.id,
      severity: 'warning' as const,
      category: this.categorizeWarning(msg.text) as 'deprecation' | 'performance' | 'style' | 'compatibility'
    }))
  }

  private categorizeMessage(message: string): string {
    if (message.includes('syntax')) return 'syntax'
    if (message.includes('type')) return 'type'
    if (message.includes('import') || message.includes('export')) return 'semantic'
    return 'config'
  }

  private categorizeWarning(message: string): string {
    if (message.includes('deprecated')) return 'deprecation'
    if (message.includes('performance') || message.includes('slow')) return 'performance'
    if (message.includes('style') || message.includes('format')) return 'style'
    return 'compatibility'
  }

  private generateCacheKey(
    code: string,
    filename: string,
    options: Partial<TranspilationOptions>
  ): string {
    const optionsStr = JSON.stringify(options)
    const content = `${filename}:${code}:${optionsStr}`

    // Simple hash function
    let hash = 0
    for (let i = 0; i < content.length; i++) {
      const char = content.charCodeAt(i)
      hash = ((hash << 5) - hash) + char
      hash = hash & hash // Convert to 32-bit integer
    }

    return hash.toString(36)
  }

  private cleanupCache(): void {
    if (!this.config.caching) return

    const maxSize = this.config.caching.maxSize
    const ttl = this.config.caching.ttl * 1000
    const now = Date.now()

    // Remove expired entries
    for (const [key, value] of this.cache.entries()) {
      if (now - value.timestamp > ttl) {
        this.cache.delete(key)
      }
    }

    // Remove oldest entries if cache is too large
    if (this.cache.size > maxSize) {
      const entries = Array.from(this.cache.entries())
      entries.sort((a, b) => a[1].timestamp - b[1].timestamp)

      const toRemove = entries.slice(0, this.cache.size - maxSize)
      for (const [key] of toRemove) {
        this.cache.delete(key)
      }
    }
  }
}