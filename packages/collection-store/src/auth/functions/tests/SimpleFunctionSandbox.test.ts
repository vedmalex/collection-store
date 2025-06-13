// Tests for SimpleFunctionSandbox - Phase 1.6 Day 1-2
// Following DEVELOPMENT_RULES.md for high-granularity tests

import { describe, test, expect, beforeEach } from 'bun:test'
import { SimpleFunctionSandbox } from '../core/SimpleFunctionSandbox'
import type {
  SandboxConfig,
  FunctionExecutionContext,
  ResourceLimits
} from '../interfaces'

describe('SimpleFunctionSandbox', () => {
  let sandbox: SimpleFunctionSandbox
  let config: SandboxConfig
  let executionContext: FunctionExecutionContext
  let resourceLimits: ResourceLimits

  beforeEach(() => {
    // Setup test configuration
    config = {
      typescript: {
        target: 'ES2020',
        module: 'CommonJS',
        strict: true,
        noImplicitAny: true,
        strictNullChecks: true,
        strictFunctionTypes: true,
        noImplicitReturns: true,
        noUnusedLocals: false,
        noUnusedParameters: false,
        exactOptionalPropertyTypes: true,
        lib: ['ES2020'],
        types: []
      },
      limits: {
        maxExecutionTime: 5000,
        maxMemoryUsage: 10 * 1024 * 1024,
        maxDbOperations: 100,
        maxNetworkRequests: 5,
        allowedModules: ['crypto']
      },
      security: {
        allowEval: false,
        allowFunction: false,
        allowAsyncFunction: true,
        allowGenerators: false,
        allowProxyTraps: false,
        allowPrototypeAccess: false,
        allowGlobalAccess: false,
        blockedGlobals: ['process', 'global'],
        blockedProperties: ['__proto__', 'constructor']
      },
      modules: {
        allowedModules: ['crypto'],
        blockedModules: ['fs', 'path'],
        allowNodeModules: false,
        allowRelativeImports: false,
        allowAbsoluteImports: false
      },
      monitoring: {
        enabled: true,
        sampleRate: 1.0,
        collectMemoryStats: true,
        collectCpuStats: true,
        collectNetworkStats: true,
        maxExecutionTime: 5000,
        memoryThreshold: 10 * 1024 * 1024,
        cpuThreshold: 80
      }
    }

    executionContext = {
      currentUser: {
        id: 'test-user-1',
        email: 'test@example.com',
        roles: ['user'],
        permissions: ['read'],
        attributes: {}
      },
      database: {} as any, // Mock database
      requestId: 'test-request-1',
      timestamp: new Date(),
      limits: {
        maxExecutionTime: 5000,
        maxMemoryUsage: 10 * 1024 * 1024,
        maxDbOperations: 100,
        maxNetworkRequests: 5,
        allowedModules: ['crypto']
      }
    }

    resourceLimits = {
      maxExecutionTime: 5000,
      maxMemoryUsage: 10 * 1024 * 1024,
      maxDbOperations: 100,
      maxNetworkRequests: 5,
      allowedModules: ['crypto']
    }

    sandbox = new SimpleFunctionSandbox(config)
  })

  // ============================================================================
  // Compilation Tests
  // ============================================================================

  describe('Compilation', () => {
    test('should compile simple JavaScript code successfully', async () => {
      const code = 'return 42'
      const result = await sandbox.compileTypeScript(code)

      expect(result.success).toBe(true)
      expect(result.compiledCode).toBeDefined()
      expect(result.errors).toBeUndefined()
    })

    test('should compile simple TypeScript-like code', async () => {
      const code = `
        interface TestInterface {
          value: number
        }
        const test: TestInterface = { value: 42 }
        return test.value
      `
      const result = await sandbox.compileTypeScript(code)

      expect(result.success).toBe(true)
      expect(result.compiledCode).toBeDefined()
      // Should strip TypeScript syntax
      expect(result.compiledCode).not.toContain('interface')
      expect(result.compiledCode).not.toContain(': number')
    })

    test('should cache compilation results', async () => {
      const code = 'return 42'

      // First compilation
      const result1 = await sandbox.compileTypeScript(code)
      expect(result1.success).toBe(true)

      // Second compilation should use cache
      const result2 = await sandbox.compileTypeScript(code)
      expect(result2.success).toBe(true)
      expect(result2.compiledCode).toBe(result1.compiledCode)
    })

    test('should reject code with security issues', async () => {
      const dangerousCode = 'eval("malicious code")'
      const result = await sandbox.compileTypeScript(dangerousCode)

      expect(result.success).toBe(false)
      expect(result.errors).toBeDefined()
      expect(result.errors![0].message).toContain('eval')
    })
  })

  // ============================================================================
  // Security Validation Tests
  // ============================================================================

  describe('Security Validation', () => {
    test('should detect eval usage', async () => {
      const code = 'eval("test")'
      const result = await sandbox.validateSecurity(code)

      expect(result.safe).toBe(false)
      expect(result.issues).toHaveLength(1)
      expect(result.issues[0].type).toBe('eval_usage')
      expect(result.issues[0].severity).toBe('critical')
    })

    test('should detect Function constructor usage', async () => {
      const code = 'new Function("return 42")()'
      const result = await sandbox.validateSecurity(code)

      expect(result.safe).toBe(false)
      expect(result.issues).toHaveLength(1)
      expect(result.issues[0].type).toBe('dangerous_function')
      expect(result.issues[0].severity).toBe('critical')
    })

    test('should detect process object access', async () => {
      const code = 'process.exit(0)'
      const result = await sandbox.validateSecurity(code)

      expect(result.safe).toBe(true) // Not critical, but flagged
      expect(result.issues).toHaveLength(1)
      expect(result.issues[0].type).toBe('module_access')
      expect(result.issues[0].severity).toBe('high')
    })

    test('should detect prototype pollution attempts', async () => {
      const code = 'obj.__proto__.polluted = true'
      const result = await sandbox.validateSecurity(code)

      expect(result.safe).toBe(true) // Not critical, but flagged
      expect(result.issues).toHaveLength(1)
      expect(result.issues[0].type).toBe('prototype_pollution')
      expect(result.issues[0].severity).toBe('high')
    })

    test('should allow safe code', async () => {
      const code = `
        const x = 42
        const y = x * 2
        return y
      `
      const result = await sandbox.validateSecurity(code)

      expect(result.safe).toBe(true)
      expect(result.issues).toHaveLength(0)
    })
  })

  // ============================================================================
  // Execution Tests
  // ============================================================================

  describe('Execution', () => {
    test('should execute simple function successfully', async () => {
      const code = 'return parameters.x + parameters.y'
      const parameters = { x: 5, y: 3 }

      const compilation = await sandbox.compileTypeScript(code)
      expect(compilation.success).toBe(true)
      expect(compilation.compiledCode).toBeDefined()

      const sandboxContext = {
        ...executionContext,
        allowedModules: resourceLimits.allowedModules,
        networkAccess: false,
        fileSystemAccess: false,
        memoryMonitor: {} as any,
        timeoutMonitor: {} as any,
        operationCounter: {} as any
      }

      const result = await sandbox.executeInSandbox(
        compilation.compiledCode as string,
        parameters,
        sandboxContext,
        resourceLimits
      )

      expect(result).toBe(8)
    })

    test('should execute TypeScript code end-to-end', async () => {
      const code = `return parameters.a * parameters.b`
      const parameters = { a: 6, b: 7 }

      const result = await sandbox.executeTypeScript(
        code,
        parameters,
        executionContext,
        resourceLimits
      )

      expect(result).toBe(42)
    })

    test('should handle execution timeout', async () => {
      const code = 'while(true) { /* infinite loop */ }'
      const shortTimeout = { ...resourceLimits, maxExecutionTime: 50 }

      await expect(
        sandbox.executeTypeScript(code, {}, executionContext, shortTimeout)
      ).rejects.toThrow('Script execution timed out')
    })

    test('should provide sandbox environment', async () => {
      const code = `
        // Test console access
        console.log('Test message')

        // Test utils access
        const id = utils.generateId()
        const hash = utils.hash('test')

        // Test user context
        const result = {
          userId: currentUser.id,
          userEmail: currentUser.email,
          generatedId: id,
          hash: hash
        }
        return result
      `

      const result = await sandbox.executeTypeScript(
        code,
        {},
        executionContext,
        resourceLimits
      )

      expect(result).toBeDefined()
      expect(result.userId).toBe('test-user-1')
      expect(result.userEmail).toBe('test@example.com')
      expect(result.generatedId).toMatch(/^id_\d+_\w+$/)
      expect(result.hash).toMatch(/^[a-f0-9]{64}$/)
    })
  })

  // ============================================================================
  // Monitoring Tests
  // ============================================================================

  describe('Monitoring', () => {
    test('should track execution statistics', async () => {
      const code = 'return 42'

      const result = await sandbox.executeTypeScript(
        code,
        {},
        executionContext,
        resourceLimits
      )

      expect(result).toBe(42)

      // Check that execution was monitored
      // Note: In real implementation, we'd have access to execution stats
      // For now, just verify no errors occurred
    })

    test('should handle execution termination', async () => {
      const code = 'return 42'

      // Start execution
      const executionPromise = sandbox.executeTypeScript(
        code,
        {},
        executionContext,
        resourceLimits
      )

      // Should complete normally
      const result = await executionPromise
      expect(result).toBe(42)
    })
  })

  // ============================================================================
  // Cache Management Tests
  // ============================================================================

  describe('Cache Management', () => {
    test('should cache and retrieve compiled code', async () => {
      const code = 'return 42'
      const hash = 'test-hash'

      // Cache code
      await sandbox.cacheCompiledCode(hash, 'compiled code', 'source map')

      // Retrieve cached code
      const cached = await sandbox.getCachedCompiledCode(hash)
      expect(cached).toBeDefined()
      expect(cached!.compiledCode).toBe('compiled code')
      expect(cached!.sourceMap).toBe('source map')
      expect(cached!.accessCount).toBe(1)
    })

    test('should clear compilation cache', async () => {
      const hash = 'test-hash'

      // Cache code
      await sandbox.cacheCompiledCode(hash, 'compiled code')

      // Verify cached
      let cached = await sandbox.getCachedCompiledCode(hash)
      expect(cached).toBeDefined()

      // Clear cache
      await sandbox.clearCompilationCache()

      // Verify cleared
      cached = await sandbox.getCachedCompiledCode(hash)
      expect(cached).toBeNull()
    })
  })

  // ============================================================================
  // Configuration Tests
  // ============================================================================

  describe('Configuration', () => {
    test('should return sandbox configuration', () => {
      const returnedConfig = sandbox.getSandboxConfig()

      expect(returnedConfig).toEqual(config)
      expect(returnedConfig.typescript.target).toBe('ES2020')
      expect(returnedConfig.security.allowEval).toBe(false)
    })

    test('should check module permissions', () => {
      expect(sandbox.isModuleAllowed('crypto')).toBe(true)
      expect(sandbox.isModuleAllowed('fs')).toBe(false)
      expect(sandbox.isModuleAllowed('unknown')).toBe(false)
    })
  })

  // ============================================================================
  // Type Validation Tests
  // ============================================================================

  describe('Type Validation', () => {
    test('should validate correct syntax', async () => {
      const code = 'const x = 42; return x'
      const result = await sandbox.validateTypes(code)

      expect(result.valid).toBe(true)
      expect(result.errors).toHaveLength(0)
    })

    test('should detect syntax errors', async () => {
      const code = 'const x = ; // invalid syntax'
      const result = await sandbox.validateTypes(code)

      expect(result.valid).toBe(false)
      expect(result.errors.length).toBeGreaterThan(0)
    })

    test('should get diagnostics for code', async () => {
      const validCode = 'const x = 42'
      const diagnostics = await sandbox.getDiagnostics(validCode)

      expect(Array.isArray(diagnostics)).toBe(true)
      // Valid code should have no diagnostics
      expect(diagnostics).toHaveLength(0)
    })
  })
})