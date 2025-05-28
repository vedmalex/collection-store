import { BitwiseOperator, QueryValue, QueryOperatorError } from './types'

// Вспомогательная функция для проверки битовой маски
function validateBitMask(value: QueryValue): number {
  if (typeof value === 'number') {
    // Check if it's a number first
    const numValue = value as number // Assert type after check
    if (!Number.isInteger(numValue)) {
      throw new QueryOperatorError(
        'Bitmask must be an integer',
        'bitwise',
        value,
      )
    }
    // Now we know value is an integer number
    if (numValue < 0) {
      throw new QueryOperatorError(
        'Bitmask must be a non-negative integer',
        'bitwise',
        value,
      )
    }
    return numValue
  }
  if (Array.isArray(value)) {
    // Check for array second
    if (
      value.every(
        (bit) => typeof bit === 'number' && Number.isInteger(bit) && bit >= 0,
      )
    ) {
      // Assert type after validation
      const numericArray = value as number[]
      return numericArray.reduce(
        (mask: number, bit: number) => mask | (1 << bit),
        0,
      )
    } else {
      // Throw error if array contains invalid elements
      throw new QueryOperatorError(
        'Bit position array must contain only non-negative integers',
        'bitwise',
        value,
      )
    }
  }
  // If not a valid number or valid array, throw error
  throw new QueryOperatorError(
    'Invalid bit mask or positions: Must be a non-negative integer or array of non-negative integers',
    'bitwise',
    value,
  )
}

// $bitsAllSet operator
export class BitsAllSetOperator implements BitwiseOperator {
  type = 'bitwise' as const
  private bitmask: number

  constructor(value: QueryValue) {
    this.bitmask = validateBitMask(value)
  }

  evaluate(value: any): boolean {
    if (typeof value !== 'number' || !Number.isInteger(value)) {
      return false
    }
    return (value & this.bitmask) === this.bitmask
  }
}

// $bitsAnySet operator
export class BitsAnySetOperator implements BitwiseOperator {
  type = 'bitwise' as const
  private bitmask: number

  constructor(value: QueryValue) {
    this.bitmask = validateBitMask(value)
  }

  evaluate(value: any): boolean {
    if (typeof value !== 'number' || !Number.isInteger(value)) {
      return false
    }
    return (value & this.bitmask) !== 0
  }
}

// $bitsAllClear operator
export class BitsAllClearOperator implements BitwiseOperator {
  type = 'bitwise' as const
  private bitmask: number

  constructor(value: QueryValue) {
    this.bitmask = validateBitMask(value)
  }

  evaluate(value: any): boolean {
    if (typeof value !== 'number' || !Number.isInteger(value)) {
      return false
    }
    return (value & this.bitmask) === 0
  }
}

// $bitsAnyClear operator
export class BitsAnyClearOperator implements BitwiseOperator {
  type = 'bitwise' as const
  private bitmask: number

  constructor(value: QueryValue) {
    this.bitmask = validateBitMask(value)
  }

  evaluate(value: any): boolean {
    if (typeof value !== 'number' || !Number.isInteger(value)) {
      return false
    }
    return (value & this.bitmask) !== this.bitmask
  }
}

// Export a map of bitwise operators
export const bitwiseOperators = {
  $bitsAllSet: BitsAllSetOperator,
  $bitsAnySet: BitsAnySetOperator,
  $bitsAllClear: BitsAllClearOperator,
  $bitsAnyClear: BitsAnyClearOperator,
} as const

// Type guard for bitwise operators
export function isBitwiseOperator(value: any): value is BitwiseOperator {
  return value && typeof value === 'object' && value.type === 'bitwise'
}
