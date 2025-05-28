import { EvaluationOperator, QueryValue, QueryOperatorError } from './types'

// $mod operator - Updated for bigint support
export class ModOperator implements EvaluationOperator {
  type = 'evaluation' as const
  private divisor: number | bigint
  private remainder: number | bigint

  constructor(value: QueryValue) {
    if (
      !Array.isArray(value) ||
      value.length !== 2 ||
      (typeof value[0] !== 'number' && typeof value[0] !== 'bigint') ||
      (typeof value[1] !== 'number' && typeof value[1] !== 'bigint')
    ) {
      throw new QueryOperatorError(
        '$mod requires an array of two numbers or bigints [divisor, remainder]',
        '$mod',
        value,
      )
    }

    const [divisor, remainder] = value

    // Check if divisor is zero, handling both types
    if (
      (typeof divisor === 'number' && divisor === 0) ||
      (typeof divisor === 'bigint' && divisor === BigInt(0))
    ) {
      throw new QueryOperatorError('$mod divisor cannot be zero', '$mod', value)
    }

    // Note: MongoDB might have specific truncation rules for non-integer remainders/values.
    // This implementation uses standard JS modulo.
    this.divisor = divisor
    this.remainder = remainder
  }

  evaluate(value: any): boolean {
    // Ensure the field value is a number or bigint
    if (typeof value !== 'number' && typeof value !== 'bigint') {
      return false
    }

    // Perform the modulo check, handling bigint
    try {
      if (
        typeof value === 'bigint' ||
        typeof this.divisor === 'bigint' ||
        typeof this.remainder === 'bigint'
      ) {
        // Promote all to BigInt for the operation
        const bigIntValue = BigInt(value)
        const bigIntDivisor = BigInt(this.divisor)
        const bigIntRemainder = BigInt(this.remainder)
        // Divisor zero check already done in constructor
        return bigIntValue % bigIntDivisor === bigIntRemainder
      }
      // Standard number modulo
      return value % (this.divisor as number) === (this.remainder as number)
    } catch (e) {
      // Handle potential errors during BigInt conversion or modulo (though unlikely with checks)
      return false
    }
  }
}

// $regex operator - Updated constructor and evaluate
export class RegexOperator implements EvaluationOperator {
  type = 'evaluation' as const
  private pattern: RegExp

  constructor(value: QueryValue) {
    let regexValue: string
    let options: string | undefined = undefined

    if (value instanceof RegExp) {
      this.pattern = value
      return
    } else if (typeof value === 'string') {
      regexValue = value
    } else if (
      typeof value === 'object' &&
      value !== null &&
      '$regex' in value
    ) {
      // Handle { $regex: string|RegExp, $options?: string }
      const regexPart = (value as any).$regex

      if (regexPart instanceof RegExp) {
        // If $regex is a RegExp object, use it directly
        this.pattern = regexPart
        return
      } else if (typeof regexPart === 'string') {
        // If $regex is a string, create RegExp with options
        regexValue = regexPart
        options = (value as any).$options
        if (options !== undefined && typeof options !== 'string') {
          throw new QueryOperatorError(
            '$regex operator $options must be a string',
            '$regex',
            value,
          )
        }
      } else {
        throw new QueryOperatorError(
          '$regex value must be a string or RegExp',
          '$regex',
          value,
        )
      }
    } else {
      throw new QueryOperatorError(
        '$regex requires a string, RegExp, or { $regex, $options } object',
        '$regex',
        value,
      )
    }

    try {
      this.pattern = new RegExp(regexValue, options)
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e)
      throw new QueryOperatorError(
        `Invalid regular expression or options: ${message}`,
        '$regex',
        value,
      )
    }
  }

  evaluate(value: any): boolean {
    // MongoDB $regex only applies to string values.
    if (typeof value !== 'string') {
      return false
    }
    // Test the string value against the pattern.
    return this.pattern.test(value)
  }
}

// $where operator - Updated evaluate to use context
export class WhereOperator implements EvaluationOperator {
  type = 'evaluation' as const
  private fn: (this: any, obj: any) => boolean

  constructor(value: QueryValue) {
    if (typeof value === 'function') {
      this.fn = value as (this: any, obj: any) => boolean
    } else if (typeof value === 'string') {
      console.warn(
        'Using string-based $where is a potential security risk and may impact performance. Ensure the code is trusted.',
      )
      try {
        // Create function expecting the document ('obj') as argument and this context
        this.fn = new Function('obj', `return (${value})`) as (
          this: any,
          obj: any,
        ) => boolean
      } catch (e) {
        const message = e instanceof Error ? e.message : String(e)
        throw new QueryOperatorError(
          `Invalid $where JavaScript expression: ${message}`,
          '$where',
          value,
        )
      }
    } else {
      throw new QueryOperatorError(
        '$where requires a string expression or a function',
        '$where',
        value,
      )
    }
  }

  evaluate(_value: any, context?: any): boolean {
    // $where operates on the document (context), not the field value (_value)
    if (typeof context !== 'object' || context === null) {
      return false // Needs document context
    }
    try {
      // Call with document as 'this' and as the first argument ('obj')
      return Boolean(this.fn.call(context, context))
    } catch (e) {
      console.error(
        `Error executing $where function: ${e instanceof Error ? e.message : String(e)}`,
        context,
      )
      return false // Errors result in non-match
    }
  }
}

// Export a map of evaluation operators
export const evaluationOperators = {
  $mod: ModOperator,
  $regex: RegexOperator,
  $where: WhereOperator,
} as const

// Type guard for evaluation operators
export function isEvaluationOperator(value: any): value is EvaluationOperator {
  return value && typeof value === 'object' && value.type === 'evaluation'
}
