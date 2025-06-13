// Typed Schema System for Collection Store
// Unifies field definitions and index configurations with TypeScript support

import { BSONType, FieldTypeDefinition } from './field-types'
import { SortOrder } from './IndexDef'
import { Item } from './Item'
import { Paths } from './Paths'

// TypeScript to BSON type mapping
export type TSTypeToBSON<T> =
  T extends string ? 'string' :
  T extends number ? 'number' | 'int' | 'double' :
  T extends boolean ? 'boolean' :
  T extends Date ? 'date' :
  T extends Array<any> ? 'array' :
  T extends object ? 'object' :
  T extends null ? 'null' :
  T extends undefined ? 'undefined' :
  'object' // fallback

// BSON to TypeScript type mapping
export type BSONToTSType<B extends BSONType> =
  B extends 'string' ? string :
  B extends 'number' | 'int' | 'double' | 'long' ? number :
  B extends 'boolean' ? boolean :
  B extends 'date' ? Date :
  B extends 'array' ? Array<any> :
  B extends 'object' ? object :
  B extends 'null' ? null :
  B extends 'undefined' ? undefined :
  B extends 'regex' | 'regexp' ? RegExp :
  B extends 'binary' | 'binData' | 'buffer' ? Buffer :
  B extends 'objectId' ? string :
  any

// Index configuration options
export interface IndexOptions {
  order?: SortOrder
  unique?: boolean
  sparse?: boolean
  background?: boolean
  partialFilterExpression?: any
  expireAfterSeconds?: number
  name?: string
}

// Enhanced field definition with index support
export interface TypedFieldDefinition<T = any> extends Omit<FieldTypeDefinition, 'type'> {
  // Type specification (can be inferred from TypeScript)
  type?: BSONType | BSONType[] | TSTypeToBSON<T>

  // Value constraints
  required?: boolean
  default?: T
  coerce?: boolean
  validator?: (value: T) => boolean

  // Index configuration
  index?: boolean | IndexOptions
  unique?: boolean
  sparse?: boolean

  // Additional metadata
  description?: string
  examples?: T[]
  deprecated?: boolean
}

// Typed schema definition with full TypeScript support
export type TypedSchemaDefinition<T extends Item> = {
  // Direct field mapping with type inference
  [K in keyof T]?: TypedFieldDefinition<T[K]>
} & {
  // Support for nested paths and custom field paths
  [path: string]: TypedFieldDefinition<any>
}

// Composite index definition for typed schemas
export interface TypedCompositeIndex<T extends Item> {
  name: string
  fields: Array<{
    field: keyof T | Paths<T> | string
    order?: SortOrder
  }>
  options?: Omit<IndexOptions, 'order'>
}

// Complete typed schema with composite indexes
export interface CompleteTypedSchema<T extends Item> {
  fields: TypedSchemaDefinition<T>
  indexes?: TypedCompositeIndex<T>[]
  options?: {
    strict?: boolean
    validateOnInsert?: boolean
    validateOnUpdate?: boolean
    coerceTypes?: boolean
  }
}

// Type-safe query types
export type TypedQueryValue<T> =
  T |
  { $eq?: T } |
  { $ne?: T } |
  { $gt?: T } |
  { $gte?: T } |
  { $lt?: T } |
  { $lte?: T } |
  { $in?: T[] } |
  { $nin?: T[] } |
  { $exists?: boolean } |
  { $type?: BSONType } |
  (T extends string ? {
    $regex?: string | RegExp
    $options?: string
  } : {}) |
  (T extends number ? {
    $mod?: [number, number]
    $bitsAllSet?: number
    $bitsAnySet?: number
  } : {}) |
  (T extends Array<any> ? {
    $all?: T
    $elemMatch?: any
    $size?: number
  } : {})

export type TypedQuery<T extends Item, S extends TypedSchemaDefinition<T>> = {
  [K in keyof S]?: S[K] extends TypedFieldDefinition<infer U>
    ? TypedQueryValue<U>
    : any
} & {
  [path: string]: any
  $and?: TypedQuery<T, S>[]
  $or?: TypedQuery<T, S>[]
  $nor?: TypedQuery<T, S>[]
  $not?: TypedQuery<T, S>
}

// Type-safe insert type
export type TypedInsert<T extends Item, S extends TypedSchemaDefinition<T>> = {
  [K in keyof T]: S[K] extends TypedFieldDefinition<infer U>
    ? S[K] extends { required: true }
      ? U
      : S[K] extends { default: infer D }
        ? U | undefined
        : U | undefined
    : T[K]
}

// Enhanced Type-safe update type with MongoDB-style operators
export type TypedUpdateOperators<T extends Item, S extends TypedSchemaDefinition<T>> = {
  // Field-level updates
  $set?: Partial<T>
  $unset?: { [K in keyof T]?: boolean | 1 }

  // Numeric operations
  $inc?: { [K in keyof T]?: T[K] extends number ? number : never }
  $mul?: { [K in keyof T]?: T[K] extends number ? number : never }
  $min?: Partial<T>
  $max?: Partial<T>

  // Date operations
  $currentDate?: { [K in keyof T]?: T[K] extends Date ? boolean | { $type: 'date' | 'timestamp' } : never }

  // Array operations
  $addToSet?: { [K in keyof T]?: T[K] extends Array<infer V> ? V | { $each: V[] } : never }
  $push?: { [K in keyof T]?: T[K] extends Array<infer V> ?
    V | {
      $each: V[]
      $position?: number
      $slice?: number
      $sort?: 1 | -1 | Record<string, 1 | -1>
    } : never }
  $pull?: { [K in keyof T]?: T[K] extends Array<infer V> ? V | Partial<V> | TypedQuery<V, any> : never }
  $pullAll?: { [K in keyof T]?: T[K] extends Array<infer V> ? V[] : never }
  $pop?: { [K in keyof T]?: T[K] extends Array<any> ? 1 | -1 : never }

  // String operations
  $rename?: { [K in keyof T]?: string }
}

// Enhanced update type that combines direct field updates with operators
export type TypedUpdate<T extends Item, S extends TypedSchemaDefinition<T>> =
  // Direct field updates (for simple cases)
  Partial<T> |
  // Operator-based updates (for complex cases)
  TypedUpdateOperators<T, S> |
  // Mixed updates (both direct and operators)
  (Partial<T> & TypedUpdateOperators<T, S>)

// Type for atomic update operations
export type AtomicUpdateOperation<T extends Item, S extends TypedSchemaDefinition<T>> = {
  filter: TypedQuery<T, S>
  update: TypedUpdate<T, S>
  options?: {
    upsert?: boolean
    multi?: boolean
    merge?: boolean
    validateSchema?: boolean
  }
}

// Type for bulk update operations
export type BulkUpdateOperation<T extends Item, S extends TypedSchemaDefinition<T>> = {
  operations: AtomicUpdateOperation<T, S>[]
  options?: {
    ordered?: boolean
    validateAll?: boolean
  }
}

// Type for update result
export type UpdateResult<T extends Item> = {
  matchedCount: number
  modifiedCount: number
  upsertedCount: number
  upsertedIds: Array<T[keyof T]>
  modifiedDocuments: T[]
}

// Type for field path validation (fixed)
export type ValidFieldPath<T> = {
  [K in keyof T]: K extends string
    ? T[K] extends object
      ? K | `${K}.${ValidFieldPath<T[K]> extends string ? ValidFieldPath<T[K]> : never}`
      : K
    : never
}[keyof T]

// Type for nested field updates (simplified)
export type NestedFieldUpdate<T extends Item> = {
  [K in string]?: any
}

// Utility types for schema inference
export type InferSchemaType<S extends TypedSchemaDefinition<any>> = {
  [K in keyof S]: S[K] extends TypedFieldDefinition<infer T> ? T : any
}

export type InferRequiredFields<S extends TypedSchemaDefinition<any>> = {
  [K in keyof S]: S[K] extends { required: true } ? K : never
}[keyof S]

export type InferOptionalFields<S extends TypedSchemaDefinition<any>> = {
  [K in keyof S]: S[K] extends { required: true } ? never : K
}[keyof S]

// Schema validation utilities
export interface SchemaValidationOptions {
  strict?: boolean
  coerceTypes?: boolean
  validateRequired?: boolean
  allowUnknownFields?: boolean
}

export interface SchemaValidationResult<T> {
  valid: boolean
  data?: T
  errors: Array<{
    field: string
    message: string
    value?: any
  }>
  warnings: Array<{
    field: string
    message: string
    value?: any
  }>
}

// Index extraction utilities
export function extractIndexesFromSchema<T extends Item>(
  schema: TypedSchemaDefinition<T>
): Array<{ field: string; options: IndexOptions }> {
  const indexes: Array<{ field: string; options: IndexOptions }> = []

  for (const [fieldPath, fieldDef] of Object.entries(schema)) {
    if (fieldDef.index) {
      const options: IndexOptions = typeof fieldDef.index === 'boolean'
        ? {}
        : fieldDef.index

      // Add field-level index options
      if (fieldDef.unique) options.unique = true
      if (fieldDef.sparse) options.sparse = true

      indexes.push({ field: fieldPath, options })
    }
  }

  return indexes
}

// Type inference from data
export function inferTypedSchemaFromData<T extends Item>(
  data: T[],
  options: {
    includeIndexes?: boolean
    inferRequired?: boolean
    sampleSize?: number
  } = {}
): TypedSchemaDefinition<T> {
  const { includeIndexes = false, inferRequired = false, sampleSize = 100 } = options
  const sample = data.slice(0, sampleSize)
  const schema = {} as Record<string, TypedFieldDefinition<any>>

  // Analyze each field across all samples
  const fieldAnalysis: Record<string, {
    types: Set<BSONType>
    nullCount: number
    totalCount: number
    uniqueValues: Set<any>
  }> = {}

  sample.forEach(item => {
    analyzeObjectForSchema(item, '', fieldAnalysis)
  })

  // Convert analysis to schema
  for (const [fieldPath, analysis] of Object.entries(fieldAnalysis)) {
    const types = Array.from(analysis.types)
    const isRequired = inferRequired && analysis.nullCount === 0
    const isUnique = includeIndexes && analysis.uniqueValues.size === analysis.totalCount

    schema[fieldPath] = {
      type: types.length === 1 ? types[0] : types,
      required: isRequired,
      index: isUnique ? { unique: true } : includeIndexes && analysis.uniqueValues.size > analysis.totalCount * 0.8
    }
  }

  return schema as TypedSchemaDefinition<T>
}

function analyzeObjectForSchema(
  obj: any,
  prefix: string,
  analysis: Record<string, any>
): void {
  if (obj === null || obj === undefined) {
    const fieldPath = prefix || 'root'
    if (!analysis[fieldPath]) {
      analysis[fieldPath] = {
        types: new Set(),
        nullCount: 0,
        totalCount: 0,
        uniqueValues: new Set()
      }
    }
    analysis[fieldPath].types.add(obj === null ? 'null' : 'undefined')
    analysis[fieldPath].nullCount++
    analysis[fieldPath].totalCount++
    return
  }

  if (typeof obj === 'object' && !Array.isArray(obj) && !(obj instanceof Date)) {
    for (const [key, value] of Object.entries(obj)) {
      const fieldPath = prefix ? `${prefix}.${key}` : key
      analyzeValueForSchema(value, fieldPath, analysis)
    }
  } else {
    analyzeValueForSchema(obj, prefix, analysis)
  }
}

function analyzeValueForSchema(
  value: any,
  fieldPath: string,
  analysis: Record<string, any>
): void {
  if (!analysis[fieldPath]) {
    analysis[fieldPath] = {
      types: new Set(),
      nullCount: 0,
      totalCount: 0,
      uniqueValues: new Set()
    }
  }

  const bsonType = getBSONTypeForValue(value)
  analysis[fieldPath].types.add(bsonType)
  analysis[fieldPath].totalCount++
  analysis[fieldPath].uniqueValues.add(value)

  if (value === null || value === undefined) {
    analysis[fieldPath].nullCount++
  }
}

function getBSONTypeForValue(value: any): BSONType {
  if (value === null) return 'null'
  if (value === undefined) return 'undefined'
  if (typeof value === 'string') return 'string'
  if (typeof value === 'boolean') return 'boolean'
  if (typeof value === 'number') {
    return Number.isInteger(value) ? 'int' : 'double'
  }
  if (value instanceof Date) return 'date'
  if (value instanceof RegExp) return 'regex'
  if (Buffer.isBuffer(value)) return 'binary'
  if (Array.isArray(value)) return 'array'
  if (typeof value === 'object') return 'object'
  return 'object'
}