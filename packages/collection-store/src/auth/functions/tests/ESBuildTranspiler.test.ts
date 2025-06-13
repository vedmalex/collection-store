// Tests for ESBuild TypeScript Transpiler
import { describe, test, expect, beforeEach, afterEach } from 'bun:test'
import { ESBuildTranspiler } from '../transpilers/ESBuildTranspiler'
import { getDefaultTranspilerConfig } from '../transpilers/TypeScriptTranspilerFactory'
import type { TypeScriptTranspilerConfig } from '../interfaces/ITypeScriptTranspiler'

describe('ESBuildTranspiler', () => {
  let transpiler: ESBuildTranspiler
  let config: TypeScriptTranspilerConfig

  beforeEach(async () => {
    config = getDefaultTranspilerConfig('esbuild')
    transpiler = new ESBuildTranspiler(config)
    await transpiler.initialize()
  })

  afterEach(async () => {
    await transpiler.dispose()
  })

  describe('Basic Functionality', () => {
    test('should initialize successfully', async () => {
      const info = transpiler.getInfo()

      expect(info.name).toBe('ESBuild TypeScript Transpiler')
      expect(info.provider).toBe('esbuild')
      expect(info.capabilities).toContain('typescript')
      expect(info.capabilities).toContain('javascript')
    })

        test('should transpile simple TypeScript code', async () => {
      const code = `
        interface User {
          id: number
          name: string
        }

        const user: User = { id: 1, name: 'Test' }
        console.log(user.name)
      `

      const result = await transpiler.transpile(code)

      expect(result.success).toBe(true)
      expect(result.code).toBeDefined()
      expect(result.code).not.toContain('interface')
      expect(result.code).not.toContain(': User')
      expect(result.metadata?.transpiler).toBe('esbuild')
    })

    test('should handle TypeScript with return statement', async () => {
      const code = `
        function calculate(a: number, b: number): number {
          return a + b
        }

        const result = calculate(5, 3)
        return result
      `

      const result = await transpiler.transpile(code)

      expect(result.success).toBe(true)
      expect(result.code).toBeDefined()
      expect(result.code).toContain('return')
      expect(result.code).not.toContain(': number')
    })

    test('should detect syntax errors', async () => {
      const code = `
        const x =
        // incomplete statement
      `

      const result = await transpiler.transpile(code)

      expect(result.success).toBe(false)
      expect(result.errors).toBeDefined()
      expect(result.errors!.length).toBeGreaterThan(0)
    })
  })

  describe('Configuration', () => {
    test('should support different targets', async () => {
      const code = `const x = () => { return 42 }`

      const result = await transpiler.transpile(code, 'test.ts', {
        target: 'ES2015'
      })

      expect(result.success).toBe(true)
      expect(result.code).toBeDefined()
      expect(result.code).toContain('42')
    })

    test('should support source maps', async () => {
      const code = `const x: number = 42`

      const result = await transpiler.transpile(code, 'test.ts', {
        sourceMap: true
      })

      expect(result.success).toBe(true)
      expect(result.sourceMap).toBeDefined()
    })
  })

  describe('Validation', () => {
    test('should validate correct TypeScript code', async () => {
      const code = `
        const x: number = 42
        const y: string = 'hello'
      `

      const validation = await transpiler.validate(code)

      expect(validation.valid).toBe(true)
      expect(validation.errors).toHaveLength(0)
    })

    test('should detect validation errors', async () => {
      const code = `
        const x =
        // incomplete
      `

      const validation = await transpiler.validate(code)

      expect(validation.valid).toBe(false)
      expect(validation.errors.length).toBeGreaterThan(0)
    })
  })

  describe('Features Support', () => {
    test('should support TypeScript features', () => {
      expect(transpiler.supports('typescript')).toBe(true)
      expect(transpiler.supports('javascript')).toBe(true)
      expect(transpiler.supports('jsx')).toBe(true)
      expect(transpiler.supports('sourcemaps')).toBe(true)
    })

    test('should not support unsupported features', () => {
      expect(transpiler.supports('unknown-feature')).toBe(false)
    })
  })

  describe('Default Configuration', () => {
    test('should provide sensible defaults', () => {
      const defaults = transpiler.getDefaultConfig()

      expect(defaults.target).toBe('ES2020')
      expect(defaults.module).toBe('CommonJS')
      expect(defaults.strict).toBe(true)
      expect(defaults.sourceMap).toBe(true)
    })
  })

  describe('Multiple Files', () => {
    test('should transpile multiple files', async () => {
      const files = [
        {
          filename: 'file1.ts',
          code: 'const x: number = 1'
        },
        {
          filename: 'file2.ts',
          code: 'const y: string = "hello"'
        }
      ]

      const results = await transpiler.transpileFiles(files)

      expect(results).toHaveLength(2)
      expect(results[0].success).toBe(true)
      expect(results[1].success).toBe(true)
      expect(results[0].filename).toBe('file1.ts')
      expect(results[1].filename).toBe('file2.ts')
    })
  })

  describe('Caching', () => {
    test('should cache transpilation results', async () => {
      const code = 'const x: number = 42'

      // First transpilation
      const result1 = await transpiler.transpile(code)
      expect(result1.success).toBe(true)

      // Second transpilation should be faster (cached)
      const start = Date.now()
      const result2 = await transpiler.transpile(code)
      const duration = Date.now() - start

      expect(result2.success).toBe(true)
             expect(result2.code).toBe(result1.code || '')
      expect(duration).toBeLessThan(10) // Should be very fast due to caching
    })
  })
})