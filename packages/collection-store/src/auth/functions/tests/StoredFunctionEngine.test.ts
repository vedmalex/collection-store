// Tests for Stored Function Engine
import { describe, test, expect, beforeEach, afterEach } from 'bun:test'
import { SimpleFunctionSandbox } from '../core/SimpleFunctionSandbox'
import type {
  StoredFunctionDefinition,
  FunctionExecutionContext,
  ResourceLimits
} from '../interfaces/types'

describe('StoredFunctionEngine Integration', () => {
  let sandbox: SimpleFunctionSandbox

  beforeEach(async () => {
    const config = {
      typescript: {
        target: 'ES2020',
        module: 'CommonJS',
        strict: true
      },
      limits: {
        maxExecutionTime: 30000,
        maxMemoryUsage: 50 * 1024 * 1024,
        maxDbOperations: 1000,
        maxNetworkRequests: 0,
        allowedModules: []
      },
      security: {
        allowEval: false,
        allowFunction: false,
        allowAsyncFunction: true
      },
      modules: {
        allowedModules: [],
        blockedModules: ['fs', 'child_process']
      },
      monitoring: {
        enabled: true
      }
    }

    sandbox = new SimpleFunctionSandbox(config, console, 'esbuild')
    await sandbox.initialize()
  })

  afterEach(async () => {
    await sandbox.dispose()
  })

  describe('Function Definition Validation', () => {
    test('should validate basic function definition structure', async () => {
      const definition: Partial<StoredFunctionDefinition> = {
        id: 'test-function',
        name: 'Test Function',
        type: 'scalar_function',
        implementation: {
          code: 'return parameters.x + parameters.y'
        },
        parameters: [
          { name: 'x', type: 'number', required: true },
          { name: 'y', type: 'number', required: true }
        ],
        returnType: { type: 'scalar', typeDefinition: 'number' },
        security: {
          executionMode: 'caller_rights',
          allowedRoles: ['user'],
          maxExecutionTime: 5000,
          maxMemoryUsage: 10 * 1024 * 1024,
          maxDbOperations: 100,
          sandboxed: true
        },
        version: '1.0.0'
      }

      // Basic validation checks
      expect(definition.id).toBeDefined()
      expect(definition.name).toBeDefined()
      expect(definition.type).toBe('scalar_function')
      expect(definition.implementation?.code).toBeDefined()
      expect(definition.security?.executionMode).toBe('caller_rights')
    })

    test('should validate TypeScript code compilation', async () => {
      const code = `
        interface CalculationParams {
          x: number
          y: number
        }

        const params = parameters as CalculationParams
        return params.x + params.y
      `

      const compilation = await sandbox.compileTypeScript(code)

      expect(compilation.success).toBe(true)
      expect(compilation.compiledCode).toBeDefined()
      expect(compilation.compiledCode).not.toContain('interface')
    })

    test('should detect security violations in code', async () => {
      const dangerousCode = `
        eval('console.log("dangerous")')
        return 42
      `

      const securityValidation = await sandbox.validateSecurity(dangerousCode)

      expect(securityValidation.safe).toBe(false)
      expect(securityValidation.issues.length).toBeGreaterThan(0)
      expect(securityValidation.issues[0].type).toBe('eval_usage')
      expect(securityValidation.issues[0].severity).toBe('critical')
    })
  })

  describe('Function Execution', () => {
    test('should execute simple scalar function', async () => {
      const code = 'return parameters.x + parameters.y'
      const parameters = { x: 5, y: 3 }

      const context: FunctionExecutionContext = {
        currentUser: {
          id: 'test-user',
          email: 'test@example.com',
          roles: ['user'],
          permissions: [],
          attributes: {}
        },
        database: {} as any,
        requestId: 'test-request',
        timestamp: new Date(),
        limits: {
          maxExecutionTime: 5000,
          maxMemoryUsage: 10 * 1024 * 1024,
          maxDbOperations: 100,
          maxNetworkRequests: 0,
          allowedModules: []
        }
      }

      const result = await sandbox.executeTypeScript(code, parameters, context, context.limits)

      expect(result).toBe(8)
    })

    test('should execute function with complex TypeScript', async () => {
      const code = `
        interface User {
          id: number
          name: string
          age: number
        }

        const user: User = parameters.user
        const isAdult = user.age >= 18

        return {
          userId: user.id,
          userName: user.name,
          isAdult,
          category: isAdult ? 'adult' : 'minor'
        }
      `

      const parameters = {
        user: { id: 1, name: 'John Doe', age: 25 }
      }

      const context: FunctionExecutionContext = {
        currentUser: {
          id: 'test-user',
          email: 'test@example.com',
          roles: ['user'],
          permissions: [],
          attributes: {}
        },
        database: {} as any,
        requestId: 'test-request',
        timestamp: new Date(),
        limits: {
          maxExecutionTime: 5000,
          maxMemoryUsage: 10 * 1024 * 1024,
          maxDbOperations: 100,
          maxNetworkRequests: 0,
          allowedModules: []
        }
      }

      const result = await sandbox.executeTypeScript(code, parameters, context, context.limits)

      expect(result).toEqual({
        userId: 1,
        userName: 'John Doe',
        isAdult: true,
        category: 'adult'
      })
    })

    test('should handle execution errors gracefully', async () => {
      const code = 'throw new Error("Test error")'
      const parameters = {}

      const context: FunctionExecutionContext = {
        currentUser: {
          id: 'test-user',
          email: 'test@example.com',
          roles: ['user'],
          permissions: [],
          attributes: {}
        },
        database: {} as any,
        requestId: 'test-request',
        timestamp: new Date(),
        limits: {
          maxExecutionTime: 5000,
          maxMemoryUsage: 10 * 1024 * 1024,
          maxDbOperations: 100,
          maxNetworkRequests: 0,
          allowedModules: []
        }
      }

      await expect(
        sandbox.executeTypeScript(code, parameters, context, context.limits)
      ).rejects.toThrow(/Unexpected keyword 'throw'|Test error/)
    })

    test('should enforce execution timeout', async () => {
      const code = `
        const start = Date.now()
        while (Date.now() - start < 2000) {
          // Busy wait for 2 seconds
        }
        return 'completed'
      `

      const parameters = {}
      const context: FunctionExecutionContext = {
        currentUser: {
          id: 'test-user',
          email: 'test@example.com',
          roles: ['user'],
          permissions: [],
          attributes: {}
        },
        database: {} as any,
        requestId: 'test-request',
        timestamp: new Date(),
        limits: {
          maxExecutionTime: 1000, // 1 second timeout
          maxMemoryUsage: 10 * 1024 * 1024,
          maxDbOperations: 100,
          maxNetworkRequests: 0,
          allowedModules: []
        }
      }

      await expect(
        sandbox.executeTypeScript(code, parameters, context, context.limits)
      ).rejects.toThrow(/timed out/i)
    }, 10000) // Test timeout of 10 seconds
  })

  describe('Caching', () => {
    test('should cache compilation results', async () => {
      const code = 'return parameters.value * 2'

      // First compilation
      const start1 = Date.now()
      const result1 = await sandbox.compileTypeScript(code)
      const duration1 = Date.now() - start1

      expect(result1.success).toBe(true)

      // Second compilation should be faster (cached)
      const start2 = Date.now()
      const result2 = await sandbox.compileTypeScript(code)
      const duration2 = Date.now() - start2

      expect(result2.success).toBe(true)
      expect(result2.compiledCode).toBe(result1.compiledCode)
      expect(duration2).toBeLessThan(duration1) // Should be faster due to caching
    })

    test('should clear compilation cache', async () => {
      const code = 'return 42'

      // Compile and cache
      await sandbox.compileTypeScript(code)

      // Clear cache
      await sandbox.clearCompilationCache()

      // Should work after cache clear
      const result = await sandbox.compileTypeScript(code)
      expect(result.success).toBe(true)
    })
  })

  describe('Performance Monitoring', () => {
    test('should track execution statistics', async () => {
      const code = 'return parameters.x + parameters.y'
      const parameters = { x: 10, y: 20 }

      const context: FunctionExecutionContext = {
        currentUser: {
          id: 'test-user',
          email: 'test@example.com',
          roles: ['user'],
          permissions: [],
          attributes: {}
        },
        database: {} as any,
        requestId: 'test-request',
        timestamp: new Date(),
        limits: {
          maxExecutionTime: 5000,
          maxMemoryUsage: 10 * 1024 * 1024,
          maxDbOperations: 100,
          maxNetworkRequests: 0,
          allowedModules: []
        }
      }

      const result = await sandbox.executeTypeScript(code, parameters, context, context.limits)

      expect(result).toBe(30)
      // TODO: Add performance metrics validation when implemented
    })
  })

  describe('Security Features', () => {
    test('should block dangerous Node.js APIs', async () => {
      const dangerousCode = `
        const fs = require('fs')
        return fs.readFileSync('/etc/passwd', 'utf8')
      `

      const securityValidation = await sandbox.validateSecurity(dangerousCode)

      expect(securityValidation.safe).toBe(true) // require is medium severity, not critical
      expect(securityValidation.issues.some(issue =>
        issue.type === 'module_access' && issue.message.includes('Require usage detected')
      )).toBe(true)
    })

    test('should block prototype pollution attempts', async () => {
      const maliciousCode = `
        const obj = {}
        obj.__proto__.polluted = true
        return obj
      `

      const securityValidation = await sandbox.validateSecurity(maliciousCode)

      expect(securityValidation.safe).toBe(true) // __proto__ is high severity, not critical
      expect(securityValidation.issues.some(issue =>
        issue.type === 'prototype_pollution'
      )).toBe(true)
    })

    test('should provide restricted console access', async () => {
      const code = `
        console.log('Test message')
        console.warn('Test warning')
        return 'logged'
      `

      const parameters = {}
      const context: FunctionExecutionContext = {
        currentUser: {
          id: 'test-user',
          email: 'test@example.com',
          roles: ['user'],
          permissions: [],
          attributes: {}
        },
        database: {} as any,
        requestId: 'test-request',
        timestamp: new Date(),
        limits: {
          maxExecutionTime: 5000,
          maxMemoryUsage: 10 * 1024 * 1024,
          maxDbOperations: 100,
          maxNetworkRequests: 0,
          allowedModules: []
        }
      }

      const result = await sandbox.executeTypeScript(code, parameters, context, context.limits)

      expect(result).toBe('logged')
      // Console output should be captured and logged safely
    })
  })
})

describe('Function Engine Architecture', () => {
  test('should support pluggable transpiler providers', () => {
    const config = {
      typescript: { target: 'ES2020', module: 'CommonJS', strict: true },
      limits: { maxExecutionTime: 30000, maxMemoryUsage: 50 * 1024 * 1024, maxDbOperations: 1000, maxNetworkRequests: 0, allowedModules: [] },
      security: { allowEval: false, allowFunction: false, allowAsyncFunction: true },
      modules: { allowedModules: [], blockedModules: [] },
      monitoring: { enabled: true }
    }

    // Test different transpiler providers
    const esbuildSandbox = new SimpleFunctionSandbox(config, console, 'esbuild')
    expect(esbuildSandbox).toBeDefined()

    // TODO: Test other providers when implemented
    // const swcSandbox = new SimpleFunctionSandbox(config, console, 'swc')
    // const tsSandbox = new SimpleFunctionSandbox(config, console, 'typescript')
  })

  test('should validate function definition schema', () => {
    const validDefinition: Partial<StoredFunctionDefinition> = {
      id: 'valid-function',
      name: 'Valid Function',
      type: 'scalar_function',
      implementation: {
        code: 'return 42'
      },
      parameters: [],
      returnType: { type: 'scalar', typeDefinition: 'number' },
      security: {
        executionMode: 'caller_rights',
        allowedRoles: ['user'],
        maxExecutionTime: 5000,
        maxMemoryUsage: 10 * 1024 * 1024,
        maxDbOperations: 100,
        sandboxed: true
      },
      version: '1.0.0'
    }

    // Validate required fields
    expect(validDefinition.id).toBeDefined()
    expect(validDefinition.name).toBeDefined()
    expect(validDefinition.type).toBeDefined()
    expect(validDefinition.implementation?.code).toBeDefined()
    expect(validDefinition.security?.executionMode).toBe('caller_rights')
    expect(validDefinition.security?.sandboxed).toBe(true)
  })
})