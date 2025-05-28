import { type ValueType } from './ValueType'

// Basic comparison operators
export type $eq = { $eq: ValueType }
export type $gt = { $gt: ValueType }
export type $gte = { $gte: ValueType }
export type $lt = { $lt: ValueType }
export type $lte = { $lte: ValueType }
export type $ne = { $ne: ValueType }
export type $in = { $in: Array<ValueType> }
export type $nin = { $nin: Array<ValueType> }

// Logical operators
export type $and = { $and: Array<QueryType> }
export type $or = { $or: Array<QueryType> }
export type $not = { $not: QueryType }
export type $nor = { $nor: Array<QueryType> }

// Array operators
export type $all = { $all: Array<ValueType> }
export type $elemMatch = { $elemMatch: QueryType }
export type $size = { $size: number }

// Element operators
export type $exists = { $exists: boolean }
export type $type = { $type: string | number | Array<string | number> }

// Evaluation operators
export type $mod = { $mod: [number, number] }
export type $regex = {
  $regex: RegExp | string | { $regex: string; $options?: string }
}
export type $where = {
  $where: string | ((this: any, obj: any) => boolean)
}

// Text search
export type $text = {
  $text: {
    $search: string
    $language?: string
    $caseSensitive?: boolean
    $diacriticSensitive?: boolean
  }
}

// Bitwise operators
export type BitwiseArgument = number | Array<number>
export type $bitsAllSet = { $bitsAllSet: BitwiseArgument }
export type $bitsAnySet = { $bitsAnySet: BitwiseArgument }
export type $bitsAllClear = { $bitsAllClear: BitwiseArgument }
export type $bitsAnyClear = { $bitsAnyClear: BitwiseArgument }

// Union types for operators
export type ComparisonOperators = $eq | $gt | $gte | $lt | $lte | $ne | $in | $nin
export type LogicalOperators = $and | $or | $not | $nor
export type ArrayOperators = $all | $elemMatch | $size
export type ElementOperators = $exists | $type
export type EvaluationOperators = $mod | $regex | $where | $text
export type BitwiseOperators = $bitsAllSet | $bitsAnySet | $bitsAllClear | $bitsAnyClear

export type Operators =
  | ComparisonOperators
  | LogicalOperators
  | ArrayOperators
  | ElementOperators
  | EvaluationOperators
  | BitwiseOperators

// Main QueryType - более гибкий тип для совместимости
export type QueryType = {
  [key: string]: any
} | Operators

// Helper functions
export function isSingleField(inp: unknown): inp is Record<string, unknown> {
  return (
    typeof inp === 'object' &&
    inp !== null &&
    !Array.isArray(inp) &&
    Object.keys(inp).length === 1
  )
}

export function isNotSingleField(inp: unknown): inp is Record<string, unknown> {
  return (
    typeof inp === 'object' &&
    inp !== null &&
    !Array.isArray(inp) &&
    Object.keys(inp).length > 1
  )
}

export function prepareQueryToRun(inp: unknown): unknown {
  return inp
}

export function isQueryType(input: unknown): input is QueryType {
  return typeof input === 'object' && input !== null
}