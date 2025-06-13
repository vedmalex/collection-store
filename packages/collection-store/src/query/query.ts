import type { QueryType } from './QueryType'
import type { UnaryCondition } from './UnaryCondition'
import { build_query_new } from './build_query'
import { compileQuery } from './compile_query'

export interface QueryOptions {
  /** Custom operators for query building */
  operators?: { [op: string]: (...args: Array<any>) => UnaryCondition }
  /** Use interpreted mode instead of compiled (for debugging) */
  interpreted?: boolean
  /** Enable debug logging */
  debug?: boolean
  /** Custom logical operators */
  $and?: (...args: Array<any>) => UnaryCondition
  $or?: (...args: Array<any>) => UnaryCondition
}

/**
 * Main query function for building query conditions
 *
 * By default uses compiled queries for maximum performance.
 * Set options.interpreted = true for debugging or development.
 *
 * @param obj - Query object (MongoDB-style query)
 * @param options - Query options including mode selection
 * @returns UnaryCondition function that can be used to test documents
 *
 * @example
 * ```typescript
 * // Compiled mode (default, fastest)
 * const condition = query({ age: { $gt: 18 }, status: 'active' })
 *
 * // Interpreted mode (for debugging)
 * const debugCondition = query({ age: { $gt: 18 } }, { interpreted: true })
 *
 * const isMatch = condition(document)
 * ```
 */
export function query(
  obj: QueryType,
  options: QueryOptions = {}
): UnaryCondition {
  const { operators, interpreted = false, debug = false } = options

  if (debug) {
    console.log(`🔍 Query mode: ${interpreted ? 'interpreted' : 'compiled'}`)
    console.log('🔍 Query object:', JSON.stringify(obj, null, 2))
  }

  // Use interpreted mode for debugging
  if (interpreted) {
    if (debug) console.log('🐛 Using interpreted mode for debugging')
    return build_query_new(obj, operators)
  }

    // Use compiled mode by default for performance
  try {
    // Note: compileQuery expects operators that return code strings, not UnaryConditions
    // For now, we pass undefined for operators in compiled mode
    const compiledResult = compileQuery(obj, undefined)

    if (compiledResult.func) {
      if (debug) {
        console.log('⚡ Using compiled mode')
        console.log('⚡ Compiled code:', compiledResult.code)
      }
      return compiledResult.func
    } else {
      if (debug) console.log('⚠️  Compilation failed, falling back to interpreted mode')
      console.warn('Query compilation failed, falling back to interpreted mode:', compiledResult.error)
      return build_query_new(obj, operators)
    }
  } catch (error: any) {
    if (debug) console.log('⚠️  Compilation error, falling back to interpreted mode:', error.message)
    console.warn('Query compilation error, falling back to interpreted mode:', error.message)
    return build_query_new(obj, operators)
  }
}

// Re-export for convenience and backward compatibility
export { build_query_new as buildQuery } from './build_query'
export { compileQuery } from './compile_query'

// Legacy function for backward compatibility
export function queryInterpreted(
  obj: QueryType,
  options?: { [op: string]: (...args: Array<any>) => UnaryCondition }
): UnaryCondition {
  return build_query_new(obj, options)
}

// Compiled-only function for explicit compiled usage
export function queryCompiled(
  obj: QueryType,
  options?: { [op: string]: (...args: Array<any>) => string }
): UnaryCondition {
  const compiledResult = compileQuery(obj, options)

  if (!compiledResult.func) {
    throw new Error(`Query compilation failed: ${compiledResult.error || 'Unknown error'}`)
  }

  return compiledResult.func
}