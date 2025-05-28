import { getJsType } from './js_types' // UPDATED Import
import { compareValues, deepCompare } from './compare_utils' // Нам понадобится сравнение // UPDATED Import
import { OperatorType, isOperator, QueryOperatorError, WhereOperator } from '.' // Операторы // IMPORT WhereOperator

// Helper function to check for logical operators that are top-level keys
function isLogicalOperator(
  key: string,
): key is '$and' | '$or' | '$not' | '$nor' {
  return key === '$and' || key === '$or' || key === '$not' || key === '$nor'
}

// Interface for the compilation context
interface CompilationContext {
  values: unknown[] // To store literal values from the query
  options?: { [op: string]: (...args: Array<any>) => string }
  regexCache: { [cacheKey: string]: string } // Map cacheKey to varName
  regexToCreate: Array<{
    varName: string
    patternIndex: string
    flagsIndex: string
  }>
  whereOperators: WhereOperator[] // ADDED: Store WhereOperator instances
  getNextValueIndex: () => number
  getRegexVar: (pattern: string, flags: string) => string
}

// Интерфейс для результата компиляции
interface CompiledQuery {
  /**
   * The generated JavaScript code string.
   * Expects 'doc' as the input document variable.
   */
  code: string
  /**
   * The compiled function.
   */
  func: (doc: any) => boolean
  /**
   * Any errors encountered during compilation.
   */
  error?: string
  errorDetails?: unknown // Keep original error details if needed
}

/**
 * Compiles a query object into a JavaScript function string and a callable function.
 *
 * @param query - The MongoDB-like query object.
 * @param options - Optional custom operators (not implemented yet).
 * @returns A CompiledQuery object.
 */
export function compileQuery(
  query: unknown,
  options?: { [op: string]: (...args: Array<any>) => string }, // Options might return code snippets
): CompiledQuery {
  const context: CompilationContext = {
    values: [],
    options,
    regexCache: {},
    regexToCreate: [], // Store info needed to create regex instances
    whereOperators: [], // ADDED: Initialize whereOperators array
    getNextValueIndex: () => context.values.length,
    getRegexVar: (pattern: string, flags: string) => {
      const cacheKey = `${pattern}\0${flags}` // Use null char as separator
      if (context.regexCache[cacheKey]) {
        return context.regexCache[cacheKey]
      }
      const varName = `_regex${context.regexToCreate.length}`
      const patternIndex = addValueAndGetCode(pattern, context, true) // Store pattern string
      const flagsIndex = addValueAndGetCode(flags, context, true) // Store flags string
      context.regexToCreate.push({ varName, patternIndex, flagsIndex })
      context.regexCache[cacheKey] = varName
      return varName
    },
  }

  try {
    // 1. Build the main logic string, it will reference variables like _regex0, _values[1], deepCompare etc.
    const mainCodeString = buildCodeRecursive(query, 'doc', context)

    // 2. Prepare necessary values/helpers for the runtime function's scope
    const queryValues = [...context.values] // Clone to be safe? Or just use context.values
    const whereOperators = context.whereOperators
    const externalHelpers = {
      compareValues, // UPDATED helper name
      deepCompare,
      _getJsTypeHelper: getJsType, // UPDATED helper name
    }
    const helperNames = Object.keys(externalHelpers)
    // const regexVarNames = context.regexToCreate.map(r => r.varName);

    // 3. Create RegExp instances *before* defining the runtime function
    const regexInstances: (RegExp | null)[] = []
    // Initialize as empty strings, not arrays
    let regexDeclarationForCodeString: string = ''
    let regexAssignmentForFuncBody: string = ''

    context.regexToCreate.forEach(
      ({ varName, patternIndex, flagsIndex }, index) => {
        const pattern = context.values[
          parseInt(patternIndex.substring(8, patternIndex.length - 1))
        ] as string
        const flags = context.values[
          parseInt(flagsIndex.substring(8, flagsIndex.length - 1))
        ] as string

        // Append declaration/assignment strings
        regexDeclarationForCodeString += `    let ${varName}; // Declaration\n`
        regexAssignmentForFuncBody += `  ${varName} = _regexInstances[${index}]; // Assignment from bound array\n`

        // Try creating the RegExp instance
        try {
          regexInstances.push(new RegExp(pattern, flags))
        } catch (regexError) {
          // Handle invalid regex pattern gracefully
          regexInstances.push(null) // Store null for invalid regex
          console.error(
            `Error creating RegExp (${varName}):`,
            regexError instanceof Error ? regexError.message : regexError,
          )
        }
      },
    )

    // 4. Construct the representative code string for the 'code' property
    const codeString = `
(doc) => {
    // --- Outer Scope Variables (captured/bound dependencies) ---
    // Helpers (available via closure/binding):
    ${helperNames.map((name) => `// const ${name} = /* bound helper function */;`).join('\n    ')}
    // Query Values (available via closure/binding):
    const _values = ${JSON.stringify(queryValues)}; // Show values used
    // Where Operators (available via closure/binding):
    const _whereOps = [ /* bound WhereOperator instances */ ];
    // RegExp Instances (created once, available via closure/binding):
${regexDeclarationForCodeString.trim()}

    // --- Runtime Logic ---
    try {
        // Note: Inside this block, references like _regex0, _values[N], compareBSONValues are resolved
        // using the variables made available from the outer scope/binding.
        const result = !!(${mainCodeString});

        // $where operator check (runs within the runtime function)
        if (result && _whereOps.length > 0) {
            if (!_whereOps.every(op => {
                let whereResult = false;
                try {
                    whereResult = op.evaluate(null, doc);
                    return whereResult;
                } catch (whereError) {
                    console.error("Error during compiled $where execution:", whereError);
                    return false; // Treat $where error as false match
                }
            })) {
                return false;
            }
        }
        return result;
      } catch (e) {
        console.error("Error during compiled query execution:", e instanceof Error ? e.message : String(e));
        return false;
      }
}`

    // 5. Construct the actual function body for the Function constructor
    // This body will receive helpers, values, operators, and regex instances via arguments/binding
    const runtimeFuncBody = `
            // Make helpers and values available from bound arguments
            ${helperNames.map((name) => `const ${name} = _helpers.${name};`).join('\n')}
            const _values = _queryValues;
            const _whereOps = _whereOperators;
            // Assign pre-compiled regex instances from bound arguments
            ${regexAssignmentForFuncBody.trim()}

            // --- Runtime Logic ---
            try {
                const result = !!(${mainCodeString});

                // $where check logic
                 if (result && _whereOps.length > 0) {
                     if (!_whereOps.every(op => {
                         let whereResult = false;
                         try {
                             whereResult = op.evaluate(null, doc);
                             return whereResult;
                         } catch (whereError) {
                             console.error("Error during compiled $where execution:", whereError);
                             return false;
                         }
                     })) {
                         return false;
                     }
                 }
                return result;
            } catch (e) {
                console.error("Error during compiled query execution:", e instanceof Error ? e.message : String(e));
                return false;
            }
        `

    // 6. Create the actual runtime function using Function constructor
    const CompiledRuntimeFunction = new Function(
      '_helpers', // Object containing helper functions (e.g., compareBSONValues)
      '_queryValues', // Array of literal values from the query
      '_whereOperators', // Array of WhereOperator instances
      '_regexInstances', // Array of pre-compiled RegExp instances
      'doc', // The document argument
      runtimeFuncBody,
    )

    // 7. Bind the pre-calculated/created dependencies
    const compiledFunc = CompiledRuntimeFunction.bind(
      null, // thisArg
      externalHelpers, // _helpers
      queryValues, // _queryValues
      whereOperators, // _whereOperators
      regexInstances, // _regexInstances (pass the actual RegExp objects)
    )

    return {
      code: codeString.trim(), // Use the constructed representative string
      func: compiledFunc as (doc: any) => boolean,
    }
  } catch (e) {
    // Preserve original error type if it's QueryOperatorError
    const message = e instanceof Error ? e.message : String(e)
    console.error('Error during query compilation:', message, e) // Log original error too
    return {
      code: `// Compilation Error: ${message}`,
      func: () => {
        throw new Error(`Query compilation failed: ${message}`)
      },
      error: message,
      errorDetails: e, // Store original error
    }
  }
}

/**
 * Adds a value to the context and returns the code snippet to access it.
 */
function addValueAndGetCode(
  value: unknown,
  context: CompilationContext,
  store: boolean = false,
): string {
  // Remove special handling for BSONRegExp
  /*
  if (value instanceof BSONRegExp) {
    const pattern = value.pattern
    const flags = value.options
    // Validate flags during compilation
    if (/[^gimsuy]/.test(flags)) {
      throw new QueryOperatorError(
        `Invalid regex flags specified in BSONRegExp: ${flags}`,
        '$regex',
        value,
      )
    }
    const regexVar = context.getRegexVar(pattern, flags)
    return regexVar
  }
  */
  // Add other values normally
  const index = context.getNextValueIndex()
  context.values.push(value)
  return store ? `_values[${index}]` : `_values[${index}]`
}

/**
 * Recursively builds the JavaScript code string for a given query part.
 *
 * @param queryPart - The part of the query object to compile.
 * @param docVar - The string representing the variable name of the document/subdocument/value being accessed/tested.
 * @param context - The compilation context containing values and options.
 * @returns A string containing the JavaScript code for the condition.
 */
function buildCodeRecursive(
  queryPart: unknown,
  docVar: string,
  context: CompilationContext,
): string {
  // Remove BSONRegExp check
  /*
  if (queryPart instanceof BSONRegExp) {
    const pattern = queryPart.pattern
    const flags = queryPart.options
    // Validate flags at compile time
    if (/[^gimsuy]/.test(flags)) {
      throw new QueryOperatorError(
        `Invalid regex flags specified in BSONRegExp: ${flags}`,
        '$regex',
        queryPart,
      )
    }
    const regexVar = context.getRegexVar(pattern, flags)
    return `(${regexVar} !== null && typeof ${docVar} === 'string' && ${regexVar}.test(${docVar}))`
  }
  */

  // Handle standard RegExp directly (implicit $regex match)
  if (queryPart instanceof RegExp) {
    const pattern = queryPart.source
    const flags = queryPart.flags
    // Validate flags at compile time
    if (/[^gimsuy]/.test(flags)) {
      throw new QueryOperatorError(
        `Invalid regex flags specified in RegExp: ${flags}`,
        '$regex',
        queryPart,
      )
    }
    const regexVar = context.getRegexVar(pattern, flags)
    return `(${regexVar} !== null && typeof ${docVar} === 'string' && ${regexVar}.test(${docVar}))`
  }

  // Handle non-objects (primitive values, arrays but not RegExp) -> Implicit $eq
  if (
    typeof queryPart !== 'object' ||
    queryPart === null ||
    Array.isArray(queryPart)
  ) {
    const valueCode = addValueAndGetCode(queryPart, context)
    return `deepCompare(${docVar}, ${valueCode})`
  }

  // --- At this point, queryPart is a non-null, non-array object ---
  const keys = Object.keys(queryPart)
  const queryRecord = queryPart as Record<string, unknown>

  // 3. Handle single-key objects: Could be a logical operator or a field operator expression
  if (keys.length === 1) {
    const key = keys[0]
    const value = queryRecord[key]

    // 3a. Top-level/Field-level Logical Operators ($and, $or, $not, $nor) or $where
    if (isLogicalOperator(key) || key === '$where') {
      // Handle $where by adding to context via compileOperator
      if (key === '$where') {
        compileOperator(key, value, docVar, context) // Adds op to context
        return 'true' // $where condition is checked at the end
      }
      // Handle logical operators
      switch (key) {
        case '$and':
          if (!Array.isArray(value))
            throw new QueryOperatorError('$and requires an array', key, value)
          return (
            value
              .map(
                (subQuery) =>
                  `(${buildCodeRecursive(subQuery, docVar, context)})`,
              )
              .join(' && ') || 'true'
          )
        case '$or':
          if (!Array.isArray(value))
            throw new QueryOperatorError('$or requires an array', key, value)
          return (
            value
              .map(
                (subQuery) =>
                  `(${buildCodeRecursive(subQuery, docVar, context)})`,
              )
              .join(' || ') || 'false'
          )
        case '$not':
          // Note: This handles top-level $not. Field-level $not is handled in compileOperator.
          return `!(${buildCodeRecursive(value, docVar, context)})`
        case '$nor':
          if (!Array.isArray(value))
            throw new QueryOperatorError('$nor requires an array', key, value)
          return (
            value
              .map(
                (subQuery) =>
                  `!(${buildCodeRecursive(subQuery, docVar, context)})`,
              )
              .join(' && ') || 'true'
          )
      }
    }

    // 3b. Field Operator Expression (e.g., { $gt: 10 } or { age: { $gt: 10 } })
    // This handles the case where queryPart IS the operator expression, e.g. { $gt: 10 }
    if (key.startsWith('$')) {
      return compileOperator(key, value, docVar, context)
    }
    // 3c. Single Field Check (e.g., { name: "John" }) falls through to section 5
  }

  // 4. Handle objects representing specific BSON types or operator expressions like { $regex: ..., $options: ... }
  // This check handles cases where such an object is a *value* within the query.
  if ('$regex' in queryRecord && keys.includes('$regex')) {
    // Check it's actually a regex obj
    // If the object itself is { $regex: ..., $options?: ... }, compile it.
    // This handles cases like `buildCodeRecursive({ $regex: 'pattern', $options: 'i' }, docVar, context)`
    // which can happen if a regex object is passed directly as queryPart.
    return compileOperator('$regex', queryPart, docVar, context)
  }

  // 4b. Handle objects that contain only operators (e.g., { $gte: 25, $lte: 45 })
  // This is a field condition with multiple operators applied to the same field
  if (keys.length > 1 && keys.every(key => key.startsWith('$'))) {
    // All keys are operators, combine them with AND
    const operatorConditions = keys.map(key => {
      const value = queryRecord[key]
      return compileOperator(key, value, docVar, context)
    })
    return operatorConditions.join(' && ')
  }
  // TODO: Potentially add checks for other BSON types if they are passed as queryPart directly.

  // 5. Handle multiple fields (implicit $and) or a single field that is not an operator
  const fieldConditions = keys.map((key) => {
    // If a key is $where at this level (e.g., { field: 'val', $where: '...' }), handle it.
    if (key === '$where') {
      compileOperator(key, queryRecord[key], docVar, context) // Adds op to context
      return 'true' // Condition checked at the end
    }

    // Handle logical operators at this level (e.g., { field: 'val', $or: [...] })
    if (isLogicalOperator(key)) {
      const value = queryRecord[key]
      switch (key) {
        case '$and':
          if (!Array.isArray(value))
            throw new QueryOperatorError('$and requires an array', key, value)
          return (
            '(' + (value
              .map(
                (subQuery) =>
                  `(${buildCodeRecursive(subQuery, docVar, context)})`,
              )
              .join(' && ') || 'true') + ')'
          )
        case '$or':
          if (!Array.isArray(value))
            throw new QueryOperatorError('$or requires an array', key, value)
          return (
            '(' + (value
              .map(
                (subQuery) =>
                  `(${buildCodeRecursive(subQuery, docVar, context)})`,
              )
              .join(' || ') || 'false') + ')'
          )
        case '$not':
          return `!(${buildCodeRecursive(value, docVar, context)})`
        case '$nor':
          if (!Array.isArray(value))
            throw new QueryOperatorError('$nor requires an array', key, value)
          return (
            '(' + (value
              .map(
                (subQuery) =>
                  `!(${buildCodeRecursive(subQuery, docVar, context)})`,
              )
              .join(' && ') || 'true') + ')'
          )
      }
    }

    const value = queryRecord[key]
    const safeAccessVar = key.split('.').reduce((acc, part) => {
      if (!/^[a-zA-Z_$][0-9a-zA-Z_$]*$/.test(part)) {
        const escapedPart = part.replace(/\\/g, '\\\\').replace(/"/g, '\\"')
        return `${acc}?.["${escapedPart}"]`
      }
      return `${acc}?.${part}`
    }, docVar)
    // Recursively build code for the field's value/condition
    return buildCodeRecursive(value, safeAccessVar, context)
  })

  // Combine field conditions with &&
  const actualConditions = fieldConditions.filter((c) => c !== 'true')
  if (actualConditions.length === 0) return 'true'
  return actualConditions.join(' && ')
}

/**
 * Compiles a specific operator into JavaScript code.
 *
 * @param operator - The operator string (e.g., "$eq", "$gt", "$regex").
 * @param value - The operand value for the operator.
 * @param docVar - The variable name representing the field value being tested.
 * @param context - Compilation context.
 * @returns JavaScript code string for the operator.
 */
function compileOperator(
  operator: string,
  value: unknown,
  docVar: string,
  context: CompilationContext,
): string {
  const safeCompare = (op: '>' | '>=' | '<' | '<=') => {
    const valueCode = addValueAndGetCode(value, context)
    const comparison = `compareValues(${docVar}, ${valueCode})`
    switch (op) {
      case '>':
        return `(${comparison} === 1)`
      case '<':
        return `(${comparison} === -1)`
      case '>=':
        return `(res => res === 1 || res === 0)(${comparison})`
      case '<=':
        return `(res => res === -1 || res === 0)(${comparison})`
    }
  }

  switch (operator) {
    // --- Comparison Operators ---
    case '$eq': {
      const valueCode = addValueAndGetCode(value, context)
      return `deepCompare(${docVar}, ${valueCode})`
    }
    case '$gt':
      return safeCompare('>')
    case '$gte':
      return safeCompare('>=')
    case '$lt':
      return safeCompare('<')
    case '$lte':
      return safeCompare('<=')
    case '$ne': {
      const valueCode = addValueAndGetCode(value, context)
      return `!deepCompare(${docVar}, ${valueCode})`
    }
    case '$in': {
      if (!Array.isArray(value))
        throw new QueryOperatorError('$in requires an array', '$in', value)
      const valueCode = addValueAndGetCode(value, context)
      // MongoDB $in behavior: check if field value matches any value in the query array
      // If field value is an array, check if any element in field array matches any query value
      return `(
        Array.isArray(${docVar})
          ? ${docVar}.some(fieldItem => ${valueCode}.some(queryItem => deepCompare(fieldItem, queryItem)))
          : ${valueCode}.some(queryItem => deepCompare(${docVar}, queryItem))
      )`
    }
    case '$nin': {
      if (!Array.isArray(value))
        throw new QueryOperatorError('$nin requires an array', '$nin', value)
      const valueCode = addValueAndGetCode(value, context)
      // MongoDB $nin behavior: negation of $in
      return `!(
        Array.isArray(${docVar})
          ? ${docVar}.some(fieldItem => ${valueCode}.some(queryItem => deepCompare(fieldItem, queryItem)))
          : ${valueCode}.some(queryItem => deepCompare(${docVar}, queryItem))
      )`
    }

    // --- Logical Operator (applied to field) ---
    case '$not':
      if (typeof value !== 'object' || value === null || Array.isArray(value)) {
        // Allow basic negation like { field: { $not: /regex/ } }
        if (!(value instanceof RegExp)) {
          throw new QueryOperatorError(
            '$not requires an operator expression or a regular expression',
            '$not',
            value,
          )
        }
        // If it's a regex, compileOperator('$not') will wrap !compileOperator('$regex') essentially
      }
      // Let buildCodeRecursive handle the inner expression compilation
      // This works for { field: { $not: { $gt: 10 } } }
      // And { field: { $not: /pattern/ } }
      return `!(${buildCodeRecursive(value, docVar, context)})`

    // --- Element Operators ---
    case '$exists': {
      if (typeof value !== 'boolean') {
        throw new QueryOperatorError(
          '$exists requires a boolean value',
          '$exists',
          value,
        )
      }
      return `${docVar} ${value ? '!==' : '==='} undefined`
    }

    case '$type': {
      // let expectedTypes: Array<string | number> // Keep number for potential future use? No, only strings now.
      let expectedTypeStrings: string[]

      if (Array.isArray(value)) {
        expectedTypeStrings = value.map((v) => String(v).toLowerCase())
      } else if (typeof value === 'string') {
        expectedTypeStrings = [value.toLowerCase()]
      } else {
        throw new QueryOperatorError(
          '$type requires a type name string or an array of type name strings',
          '$type',
          value,
        )
      }

      // Validate type strings during compilation (optional but good practice)
      const validTypes = [
        'string',
        'number',
        'boolean',
        'object',
        'array',
        'null',
        'undefined',
        'date',
        'regexp',
        'buffer',
      ]
      for (const typeStr of expectedTypeStrings) {
        if (!validTypes.includes(typeStr)) {
          // Allow unrecognized types for flexibility? Or throw error?
          // Let's throw for now to be stricter.
          throw new QueryOperatorError(
            `Invalid type name specified for $type: ${typeStr}`,
            '$type',
            value,
          )
        }
      }

      // Add the array of validated target type *names* to the values
      const targetTypesCode = addValueAndGetCode(expectedTypeStrings, context)

      // Generate code to get the actual type and check if it's in the target list
      // Use the renamed helper directly
      return `(actualType => actualType !== null && ${targetTypesCode}.includes(actualType))(_helpers._getJsTypeHelper(${docVar}))`
    }

    // --- Evaluation Operators ---
    case '$regex': {
      let pattern: string
      let flags: string = ''

      if (typeof value === 'string') {
        pattern = value
      } else if (value instanceof RegExp) {
        pattern = value.source
        flags = value.flags
      } else if (
        typeof value === 'object' &&
        value !== null &&
        '$regex' in value
      ) {
        const regexObj = value as { $regex: unknown; $options?: unknown }
        if (typeof regexObj.$regex !== 'string') {
          throw new QueryOperatorError(
            `$regex: $regex requires a string, RegExp, or { $regex, $options } object`,
            operator,
            value,
          )
        }
        pattern = regexObj.$regex
        if (regexObj.$options !== undefined) {
          if (typeof regexObj.$options !== 'string') {
            throw new QueryOperatorError(
              `$regex: $options requires a string`,
              operator,
              value,
            )
          }
          flags = regexObj.$options
        }
      } else {
        throw new QueryOperatorError(
          `$regex: $regex requires a string, RegExp, or { $regex, $options } object`,
          operator,
          value,
        )
      }

      // Validate flags at compile time
      if (/[^gimsuy]/.test(flags)) {
        throw new QueryOperatorError(
          `$regex: Invalid regex flags specified: ${flags}`,
          operator,
          value,
        )
      }

      const regexVar = context.getRegexVar(pattern, flags)
      // MongoDB behavior: if field value is an array, apply regex to each element
      // Check if docVar is an array, and if so, iterate and test each element.
      return `(
        Array.isArray(${docVar})
          ? ${docVar}.some(item => typeof item === 'string' && ${regexVar} !== null && ${regexVar}.test(item))
          : (typeof ${docVar} === 'string' && ${regexVar} !== null && ${regexVar}.test(${docVar}))
      )`
    }
    case '$mod': {
      if (!Array.isArray(value) || value.length !== 2) {
        throw new QueryOperatorError(
          '$mod requires an array with [ divisor, remainder ]',
          '$mod',
          value,
        )
      }
      const [divisor, remainder] = value
      if (
        typeof divisor !== 'number' ||
        typeof remainder !== 'number' ||
        !Number.isInteger(divisor) ||
        !Number.isInteger(remainder)
      ) {
        // TODO: Add BigInt support check later if needed
        throw new QueryOperatorError(
          '$mod requires divisor and remainder to be integers',
          '$mod',
          value,
        )
      }
      if (divisor === 0) {
        throw new QueryOperatorError('$mod divisor cannot be 0', '$mod', value)
      }

      const divisorCode = addValueAndGetCode(divisor, context)
      const remainderCode = addValueAndGetCode(remainder, context)
      // Check if docVar is a number and perform modulo
      return `(typeof ${docVar} === 'number' && Number.isInteger(${docVar}) && ${docVar} % ${divisorCode} === ${remainderCode})`
    }

    case '$where': {
      // Handle $where by creating operator and adding to context
      if (typeof value !== 'string' && typeof value !== 'function') {
        throw new QueryOperatorError(
          '$where requires a string or function argument',
          '$where',
          value,
        )
      }
      try {
        const whereOp = new WhereOperator(value as any)
        context.whereOperators.push(whereOp)
        return 'true' // Let the final check handle the evaluation
      } catch (e) {
        if (e instanceof QueryOperatorError) {
          throw e
        } else {
          throw new QueryOperatorError(
            `Invalid $where argument: ${e instanceof Error ? e.message : String(e)}`,
            '$where',
            value,
          )
        }
      }
    }

    // ADDED: $text operator (simplified)
    case '$text': {
      if (
        typeof value !== 'object' ||
        value === null ||
        !('$search' in value)
      ) {
        throw new QueryOperatorError(
          '$text requires an object with a $search property',
          '$text',
          value,
        )
      }
      const textQuery = value as { $search: unknown; $caseSensitive?: unknown }

      if (typeof textQuery.$search !== 'string') {
        throw new QueryOperatorError(
          '$text operator requires $search to be a string',
          '$text',
          value,
        )
      }
      const searchString = textQuery.$search.trim()
      if (searchString === '') {
        throw new QueryOperatorError(
          '$text operator $search string cannot be empty',
          '$text',
          value,
        )
      }

      let caseSensitive = false
      if ('$caseSensitive' in textQuery) {
        if (typeof textQuery.$caseSensitive !== 'boolean') {
          throw new QueryOperatorError(
            '$text operator $caseSensitive must be a boolean',
            '$text',
            value,
          )
        }
        caseSensitive = textQuery.$caseSensitive
      }

      // Split search string into words (simple space split)
      const searchWords = searchString.split(/\s+/) // Split by whitespace
      const wordsCode = addValueAndGetCode(searchWords, context)
      const caseSensitiveCode = addValueAndGetCode(caseSensitive, context)

      // Generate code to check if docVar is a string and contains all words
      return `(
                (fieldVal =>
                    typeof fieldVal === 'string' && ${wordsCode}.length > 0 && (
                        ${wordsCode}.every(word => {
                            const compareWord = ${caseSensitiveCode} ? word : word.toLowerCase();
                            const compareField = ${caseSensitiveCode} ? fieldVal : fieldVal.toLowerCase();
                            // Basic check: does the field include the word?
                            // This doesn't handle stemming, language specifics, etc.
                            return compareField.includes(compareWord);
                        })
                    )
                )(${docVar})
            )`
    }

    // --- Bitwise Operators ---
    case '$bitsAllSet':
    case '$bitsAnySet':
    case '$bitsAllClear':
    case '$bitsAnyClear': {
      let bitmask: number
      if (typeof value === 'number' && Number.isInteger(value) && value >= 0) {
        bitmask = value
      } else if (Array.isArray(value)) {
        bitmask = 0
        for (const pos of value) {
          if (typeof pos !== 'number' || !Number.isInteger(pos) || pos < 0) {
            throw new QueryOperatorError(
              `Bit positions must be non-negative integers in ${operator}`,
              operator,
              value,
            )
          }
          bitmask |= 1 << pos
        }
      } else {
        throw new QueryOperatorError(
          `${operator} requires a non-negative integer bitmask or an array of non-negative bit positions`,
          operator,
          value,
        )
      }

      const maskCode = addValueAndGetCode(bitmask, context)
      const numCheck = `(typeof ${docVar} === 'number' && Number.isInteger(${docVar}))`

      switch (operator) {
        case '$bitsAllSet':
          return `${numCheck} && (${docVar} & ${maskCode}) === ${maskCode}`
        case '$bitsAnySet':
          return `${numCheck} && (${docVar} & ${maskCode}) !== 0`
        case '$bitsAllClear':
          return `${numCheck} && (${docVar} & ${maskCode}) === 0`
        case '$bitsAnyClear':
          // Check if *any* of the masked bits are 0 in docVar
          // This means the result of (docVar & mask) must *not* have all the mask bits set
          // Equivalent to: (docVar & mask) !== mask
          return `${numCheck} && (${docVar} & ${maskCode}) !== ${maskCode}`
      }
      break // Should not be reached due to inner switch return
    }

    // --- Array Operators ---
    case '$all': {
      if (!Array.isArray(value)) {
        throw new QueryOperatorError(
          '$all requires an array value',
          '$all',
          value,
        )
      }
      const queryArrayCode = addValueAndGetCode(value, context)
      // Check if docVar is an array and if every element in queryArrayCode
      // can be found in docVar using deepCompare.
      // Handle the edge case where queryArrayCode is empty (matches any array).
      const check = `
                Array.isArray(${docVar}) && (
                    ${queryArrayCode}.length === 0 ||
                    ${queryArrayCode}.every(queryVal =>
                        (${docVar}).some(docItem => deepCompare(docItem, queryVal))
                    )
                )
            `
      // Also handle the specific non-array case: matches if docVar equals the single element in queryArray
      const nonArrayCheck = `
                !Array.isArray(${docVar}) && ${queryArrayCode}.length === 1 && deepCompare(${docVar}, ${queryArrayCode}[0])
            `
      return `((${check.trim()}) || (${nonArrayCheck.trim()}))`
    }
    case '$size': {
      if (typeof value !== 'number' || !Number.isInteger(value) || value < 0) {
        throw new QueryOperatorError(
          '$size requires a non-negative integer',
          '$size',
          value,
        )
      }
      const sizeCode = addValueAndGetCode(value, context)
      // Check if docVar is an array and its length matches sizeCode
      return `(Array.isArray(${docVar}) && ${docVar}.length === ${sizeCode})`
    }
    case '$elemMatch': {
      // $elemMatch requires a query object as its value
      if (typeof value !== 'object' || value === null || Array.isArray(value)) {
        throw new QueryOperatorError(
          '$elemMatch requires a query object',
          '$elemMatch',
          value,
        )
      }

      // Generate the code for the sub-query condition
      // We pass 'elem' as the docVar for the sub-query
      const subQueryCode = buildCodeRecursive(value, 'elem', context)

      // Generate code that checks if docVar is an array and if at least one element ('elem')
      // satisfies the subQueryCode.
      return `(
                Array.isArray(${docVar}) &&
                ${docVar}.some(elem => {
                    try {
                        return (${subQueryCode});
                    } catch (e) {
                        // Errors during sub-query execution on an element should result in false
                        // console.error("Error during $elemMatch sub-query execution:", e instanceof Error ? e.message : String(e));
                        return false;
                    }
                })
            )`
    }

    // TODO: Add other operators ($type, $all, $elemMatch, $size, bitwise)
    // TODO: $text operator is complex and might require a separate compilation strategy or not be suitable for full compilation.

    default:
      if (isOperator(operator as OperatorType)) {
        console.warn(
          `Operator '${operator}' is recognized but not implemented in compileQuery.`,
        )
      }
      throw new QueryOperatorError(
        `Unsupported operator: ${operator}`,
        operator,
        value,
      )
  }
  // Explicitly return something here to satisfy TypeScript, although it shouldn't be reached
  // due to the default case throwing an error.
  return 'false'
}
