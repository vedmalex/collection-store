import {
  QueryValue,
  createOperator,
  OperatorType,
  isOperator,
  QueryOperatorError,
  ElemMatchOperator,
} from '.' // Import necessary items from index.ts
import {
  type QueryType,
  isNotSingleField,
  isSingleField,
} from './QueryType'
import type { UnaryCondition } from './UnaryCondition'
import type { ValueType } from './ValueType' // Keep ValueType for build_query_new signature
import { compareBSONValues } from './comparison' // Import comparison utility for base case

// Renamed from buildIt
export function buildIt_new(
  obj: unknown,
  options?: { [op: string]: (...args: Array<any>) => UnaryCondition },
): UnaryCondition {
  // Handle RegExp objects (implicit $regex match)
  if (obj instanceof RegExp) {
    try {
      const op = createOperator('$regex', obj as QueryValue)
      return (fieldValue: any) => {
        // MongoDB behavior: if field value is an array, apply regex to each element
        if (Array.isArray(fieldValue)) {
          return fieldValue.some(item => op.evaluate(item))
        }
        return op.evaluate(fieldValue)
      }
    } catch (e) {
      if (e instanceof QueryOperatorError) throw e
      throw new Error(
        `Error creating RegExp operator: ${e instanceof Error ? e.message : String(e)}`,
      )
    }
  }

  // Handle non-objects (primitive values, arrays) - simulate $eq
  if (typeof obj !== 'object' || obj === null || Array.isArray(obj)) {
    // Use BSON comparison for equality check
    return (input: any) => compareBSONValues(input, obj) === 0
  }

  // --- FIXED CHECK FOR $regex OBJECT --- START
  if (typeof obj === 'object' && obj !== null && '$regex' in obj) {
    // Check if it is an object and has $regex key
    const keys = Object.keys(obj)
    const hasOnlyRegexAndOptions = keys.every(
      (k) => k === '$regex' || k === '$options',
    )

    if (hasOnlyRegexAndOptions && keys.length >= 1 && keys.length <= 2) {
      // It looks like a valid { $regex: string, $options?: string } object.
      // Create the regex operator directly with the whole object
      try {
        const op = createOperator('$regex', obj as QueryValue)
        return (fieldValue: any) => {
          // MongoDB behavior: if field value is an array, apply regex to each element
          if (Array.isArray(fieldValue)) {
            return fieldValue.some(item => op.evaluate(item))
          }
          return op.evaluate(fieldValue)
        }
      } catch (e) {
        if (e instanceof QueryOperatorError) throw e
        throw new Error(
          `Error creating $regex operator: ${e instanceof Error ? e.message : String(e)}`,
        )
      }
    } else {
      // It has $regex but also other unexpected keys.
      throw new Error(
        `Invalid object structure containing $regex mixed with other keys: ${JSON.stringify(obj)}`,
      )
    }
  }
  // --- FIXED CHECK FOR $regex OBJECT --- END

  // Handle objects with multiple fields - simulate $and
  if (isNotSingleField(obj)) {
    const keys = Object.keys(obj)
    const conditions = keys.map((prop) => {
      // Cast obj to Record after type check
      return make_call_new(obj as Record<string, unknown>, prop, options)
    })
    // Return a function that checks if all conditions are met
    return (input: any) => conditions.every((cond) => cond(input))
  }
  // Handle objects with a single field (operator or field name)
  else if (isSingleField(obj)) {
    const prop = Object.keys(obj)[0]
    // Cast obj to Record after type check
    const call = make_call_new(obj as Record<string, unknown>, prop, options)
    return (input: any) => call(input)
  }
  // This case should theoretically not be reached due to the initial check
  // but provides a fallback similar to the original $eq(obj)
  else {
    // Use BSON comparison for equality check
    return (input: any) => compareBSONValues(input, obj) === 0
  }
}

// Renamed from make_call
function make_call_new(
  obj: Record<string, unknown>, // Expect Record now
  prop: string,
  options?: { [op: string]: (...args: Array<any>) => UnaryCondition },
): UnaryCondition {
  // Return type is UnaryCondition
  // Handle custom options first
  if (options?.[prop]) {
    // Assume option returns a UnaryCondition
    return options[prop](obj[prop])
  }

  // Explicitly handle logical operators as they combine recursive calls
  switch (prop) {
    case '$and': {
      if (!Array.isArray(obj.$and)) {
        throw new QueryOperatorError('$and requires an array', '$and', obj.$and)
      }
      const conditions = (obj.$and as Array<unknown>).map((q) =>
        buildIt_new(q, options),
      )
      return (input: any) => conditions.every((cond) => cond(input))
    }
    case '$or': {
      if (!Array.isArray(obj.$or)) {
        throw new QueryOperatorError('$or requires an array', '$or', obj.$or)
      }
      const conditions = (obj.$or as Array<unknown>).map((q) =>
        buildIt_new(q, options),
      )
      return (input: any) => conditions.some((cond) => cond(input))
    }
    case '$not': {
      // $not takes a query object, not just a value
      const condition = buildIt_new(obj.$not, options)
      return (input: any) => !condition(input)
    }
    case '$nor': {
      if (!Array.isArray(obj.$nor)) {
        throw new QueryOperatorError('$nor requires an array', '$nor', obj.$nor)
      }
      const conditions = (obj.$nor as Array<unknown>).map((q) =>
        buildIt_new(q, options),
      )
      // NOR is true if *none* of the conditions are true (!some)
      return (input: any) => !conditions.some((cond) => cond(input))
    }
    // Handle $where separately as it uses context
    case '$where': {
      try {
        // Assert the type for obj.$where
        const op = createOperator('$where', obj.$where as QueryValue)
        // Return a function that expects the document and passes it as context
        return (doc: any) => op.evaluate(undefined, doc)
      } catch (e) {
        // Propagate QueryOperatorError or re-throw others
        if (e instanceof QueryOperatorError) throw e
        throw new Error(
          `Error creating $where operator: ${e instanceof Error ? e.message : String(e)}`,
        )
      }
    }
    // Special handling for $elemMatch
    case '$elemMatch': {
      if (
        typeof obj.$elemMatch !== 'object' ||
        obj.$elemMatch === null ||
        Array.isArray(obj.$elemMatch)
      ) {
        throw new QueryOperatorError(
          '$elemMatch requires a query object value',
          '$elemMatch',
          obj.$elemMatch,
        )
      }
      // Recursively build the condition for the elements *first*
      const elementCondition = buildIt_new(obj.$elemMatch, options)
      // Now create the ElemMatchOperator with the compiled element condition
      const op = new ElemMatchOperator(elementCondition)
      return (fieldValue: any) => op.evaluate(fieldValue)
    }
  }

  // Handle other known operators ($eq, $gt, $regex, etc.)
  if (isOperator(prop)) {
    try {
      // Assert the type for obj[prop]
      const op = createOperator(prop as OperatorType, obj[prop] as QueryValue)
      // Most operators evaluate based on the value passed to them.
      // This assumes the UnaryCondition receives the field value.
      return (fieldValue: any) => {
        // MongoDB behavior: if field value is an array, apply operator to each element
        // Exception: operators that are specifically designed for arrays or need to check the array itself
        if (Array.isArray(fieldValue) && !['$all', '$size', '$elemMatch', '$type', '$exists', '$nin', '$in'].includes(prop)) {
          return fieldValue.some(item => op.evaluate(item))
        }
        return op.evaluate(fieldValue)
      }
    } catch (e) {
      // Propagate QueryOperatorError or re-throw others
      if (e instanceof QueryOperatorError) throw e
      throw new Error(
        `Error creating ${prop} operator: ${e instanceof Error ? e.message : String(e)}`,
      )
    }
  }

  // Default case: Treat 'prop' as a field name
  // Compile the condition associated with the field name
  const compiledCondition = buildIt_new(obj[prop], options)
  // Return a function that applies the compiled condition to the field's value in the input document
  return (doc: any) => {
    // Check if doc is an object and has the property before accessing
    // Nested field access using dot notation
    const parts = prop.split('.')
    let fieldValue: any = doc
    for (const part of parts) {
      if (
        typeof fieldValue !== 'object' ||
        fieldValue === null ||
        !(part in fieldValue)
      ) {
        fieldValue = undefined
        break
      }
      fieldValue = fieldValue[part]
    }
    return compiledCondition(fieldValue)
  }
}

// Renamed from build_query
export function build_query_new(
  input: QueryType | ValueType | unknown,
  options?: { [op: string]: (...args: Array<any>) => UnaryCondition },
): UnaryCondition {
  try {
    const result = buildIt_new(input, options)
    return result
  } catch (e) {
    // Catch errors during building (e.g., invalid operator structure)
    const message = e instanceof Error ? e.message : String(e)
    // Provide more context in the error message
    let inputString = ''
    try {
      inputString = JSON.stringify(input, null, 2) // Pretty print input
    } catch {
      inputString = String(input) // Fallback if stringify fails
    }
    throw new Error(
      `Invalid query object or definition: ${message}. Input: ${inputString}`,
    )
  }
}
