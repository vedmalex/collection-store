// TypeScript Transpiler Factory
// Factory for creating different TypeScript transpiler implementations

import type {
  ITypeScriptTranspiler,
  ITypeScriptTranspilerFactory,
  TypeScriptTranspilerConfig
} from '../interfaces/ITypeScriptTranspiler'

import { ESBuildTranspiler } from './ESBuildTranspiler'

/**
 * Factory for creating TypeScript transpilers
 * Supports multiple providers: esbuild, swc, typescript, rollup, rolldown, babel
 */
export class TypeScriptTranspilerFactory implements ITypeScriptTranspilerFactory {
  private static instance: TypeScriptTranspilerFactory

  static getInstance(): TypeScriptTranspilerFactory {
    if (!TypeScriptTranspilerFactory.instance) {
      TypeScriptTranspilerFactory.instance = new TypeScriptTranspilerFactory()
    }
    return TypeScriptTranspilerFactory.instance
  }

  async create(config: TypeScriptTranspilerConfig): Promise<ITypeScriptTranspiler> {
    const isAvailable = await this.isProviderAvailable(config.provider)

    if (!isAvailable) {
      throw new Error(`Transpiler provider '${config.provider}' is not available`)
    }

    switch (config.provider) {
      case 'esbuild':
        return this.createESBuildTranspiler(config)

      case 'swc':
        return this.createSWCTranspiler(config)

      case 'typescript':
        return this.createTypeScriptTranspiler(config)

      case 'rollup':
        return this.createRollupTranspiler(config)

      case 'rolldown':
        return this.createRolldownTranspiler(config)

      case 'babel':
        return this.createBabelTranspiler(config)

      default:
        throw new Error(`Unsupported transpiler provider: ${config.provider}`)
    }
  }

  getAvailableProviders(): Array<{
    name: string
    version?: string
    available: boolean
    capabilities: string[]
  }> {
    return [
      {
        name: 'esbuild',
        available: this.checkESBuildAvailability(),
        capabilities: [
          'typescript',
          'javascript',
          'jsx',
          'tsx',
          'sourcemaps',
          'minification',
          'bundling',
          'tree-shaking',
          'fast-compilation'
        ]
      },
      {
        name: 'swc',
        available: this.checkSWCAvailability(),
        capabilities: [
          'typescript',
          'javascript',
          'jsx',
          'tsx',
          'sourcemaps',
          'minification',
          'fast-compilation',
          'decorators'
        ]
      },
      {
        name: 'typescript',
        available: this.checkTypeScriptAvailability(),
        capabilities: [
          'typescript',
          'javascript',
          'jsx',
          'tsx',
          'sourcemaps',
          'type-checking',
          'diagnostics',
          'intellisense'
        ]
      },
      {
        name: 'rollup',
        available: this.checkRollupAvailability(),
        capabilities: [
          'typescript',
          'javascript',
          'bundling',
          'tree-shaking',
          'plugins',
          'code-splitting'
        ]
      },
      {
        name: 'rolldown',
        available: this.checkRolldownAvailability(),
        capabilities: [
          'typescript',
          'javascript',
          'bundling',
          'tree-shaking',
          'fast-compilation',
          'rust-based'
        ]
      },
      {
        name: 'babel',
        available: this.checkBabelAvailability(),
        capabilities: [
          'typescript',
          'javascript',
          'jsx',
          'tsx',
          'plugins',
          'presets',
          'transforms'
        ]
      }
    ]
  }

  async isProviderAvailable(provider: string): Promise<boolean> {
    switch (provider) {
      case 'esbuild':
        return this.checkESBuildAvailability()
      case 'swc':
        return this.checkSWCAvailability()
      case 'typescript':
        return this.checkTypeScriptAvailability()
      case 'rollup':
        return this.checkRollupAvailability()
      case 'rolldown':
        return this.checkRolldownAvailability()
      case 'babel':
        return this.checkBabelAvailability()
      default:
        return false
    }
  }

  // Private factory methods for each provider

  private async createESBuildTranspiler(config: TypeScriptTranspilerConfig): Promise<ITypeScriptTranspiler> {
    const transpiler = new ESBuildTranspiler(config)
    await transpiler.initialize()
    return transpiler
  }

  private async createSWCTranspiler(config: TypeScriptTranspilerConfig): Promise<ITypeScriptTranspiler> {
    // TODO: Implement SWC transpiler
    throw new Error('SWC transpiler not yet implemented')
  }

  private async createTypeScriptTranspiler(config: TypeScriptTranspilerConfig): Promise<ITypeScriptTranspiler> {
    // TODO: Implement TypeScript compiler API transpiler
    throw new Error('TypeScript compiler transpiler not yet implemented')
  }

  private async createRollupTranspiler(config: TypeScriptTranspilerConfig): Promise<ITypeScriptTranspiler> {
    // TODO: Implement Rollup transpiler
    throw new Error('Rollup transpiler not yet implemented')
  }

  private async createRolldownTranspiler(config: TypeScriptTranspilerConfig): Promise<ITypeScriptTranspiler> {
    // TODO: Implement Rolldown transpiler
    throw new Error('Rolldown transpiler not yet implemented')
  }

  private async createBabelTranspiler(config: TypeScriptTranspilerConfig): Promise<ITypeScriptTranspiler> {
    // TODO: Implement Babel transpiler
    throw new Error('Babel transpiler not yet implemented')
  }

  // Availability check methods

  private checkESBuildAvailability(): boolean {
    try {
      require.resolve('esbuild')
      return true
    } catch {
      return false
    }
  }

  private checkSWCAvailability(): boolean {
    try {
      require.resolve('@swc/core')
      return true
    } catch {
      return false
    }
  }

  private checkTypeScriptAvailability(): boolean {
    try {
      require.resolve('typescript')
      return true
    } catch {
      return false
    }
  }

  private checkRollupAvailability(): boolean {
    try {
      require.resolve('rollup')
      require.resolve('@rollup/plugin-typescript')
      return true
    } catch {
      return false
    }
  }

  private checkRolldownAvailability(): boolean {
    try {
      require.resolve('rolldown')
      return true
    } catch {
      return false
    }
  }

  private checkBabelAvailability(): boolean {
    try {
      require.resolve('@babel/core')
      require.resolve('@babel/preset-typescript')
      return true
    } catch {
      return false
    }
  }
}

/**
 * Default transpiler configurations for different providers
 */
export const DEFAULT_TRANSPILER_CONFIGS = {
  esbuild: {
    provider: 'esbuild' as const,
    options: {
      target: 'ES2020' as const,
      module: 'CommonJS' as const,
      strict: true,
      sourceMap: true,
      minify: false,
      removeComments: false,
      allowJs: true,
      skipLibCheck: true,
      esModuleInterop: true,
      allowSyntheticDefaultImports: true,
      isolatedModules: true
    },
    caching: {
      enabled: true,
      maxSize: 1000,
      ttl: 3600 // 1 hour
    },
    performance: {
      timeout: 30000, // 30 seconds
      memoryLimit: 512 * 1024 * 1024 // 512MB
    },
    security: {
      allowedImports: ['crypto', 'util', 'path'] as string[],
      blockedImports: ['fs', 'child_process', 'cluster'] as string[],
      allowNodeModules: false,
      allowRelativeImports: false,
      allowAbsoluteImports: false
    }
  },

  swc: {
    provider: 'swc' as const,
    options: {
      target: 'ES2020' as const,
      module: 'CommonJS' as const,
      strict: true,
      sourceMap: true,
      minify: false,
      removeComments: false,
      allowJs: true,
      experimentalDecorators: true,
      emitDecoratorMetadata: true
    },
    caching: {
      enabled: true,
      maxSize: 1000,
      ttl: 3600
    },
    performance: {
      timeout: 30000,
      memoryLimit: 512 * 1024 * 1024
    }
  },

  typescript: {
    provider: 'typescript' as const,
    options: {
      target: 'ES2020' as const,
      module: 'CommonJS' as const,
      strict: true,
      sourceMap: true,
      declaration: false,
      removeComments: false,
      skipLibCheck: true,
      esModuleInterop: true,
      allowSyntheticDefaultImports: true,
      forceConsistentCasingInFileNames: true,
      moduleResolution: 'node' as const,
      resolveJsonModule: true,
      isolatedModules: true,
      noEmitOnError: false
    },
    caching: {
      enabled: true,
      maxSize: 500, // TypeScript is slower, smaller cache
      ttl: 7200 // 2 hours
    },
    performance: {
      timeout: 60000, // 1 minute for TypeScript
      memoryLimit: 1024 * 1024 * 1024 // 1GB
    }
  }
} as const

/**
 * Get default configuration for a specific provider
 */
export function getDefaultTranspilerConfig(
  provider: 'esbuild' | 'swc' | 'typescript' | 'rollup' | 'rolldown' | 'babel'
): TypeScriptTranspilerConfig {
  switch (provider) {
    case 'esbuild':
      return DEFAULT_TRANSPILER_CONFIGS.esbuild
    case 'swc':
      return DEFAULT_TRANSPILER_CONFIGS.swc
    case 'typescript':
      return DEFAULT_TRANSPILER_CONFIGS.typescript
    default:
      // Return esbuild as fallback
      return DEFAULT_TRANSPILER_CONFIGS.esbuild
  }
}