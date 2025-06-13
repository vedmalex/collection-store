// TypedCollection - Type-safe collection with unified schema and index support
// Extends Collection with full TypeScript integration and IntelliSense support

import { Item } from './types/Item'
import { ValueType } from 'b-pl-tree'
import Collection from './collection'
import { update_index } from './collection/update_index'
import {
  TypedSchemaDefinition,
  CompleteTypedSchema,
  TypedQuery,
  TypedInsert,
  TypedUpdate,
  TypedUpdateOperators,
  AtomicUpdateOperation,
  BulkUpdateOperation,
  UpdateResult,
  IndexOptions,
  extractIndexesFromSchema,
  SchemaValidationOptions
} from './types/typed-schema'
import { SchemaDefinition, FieldValidator } from './types/field-types'
import { SchemaAwareQueryBuilder, createSchemaAwareQuery } from './query/schema-aware-query'
import { Paths } from './types/Paths'
import { ICollectionConfig } from './ICollectionConfig'
import { IndexDef } from './types/IndexDef'
import { TraverseCondition } from './types/TraverseCondition'

// Schema validation result interface for typed collections
export interface TypedSchemaValidationResult<T> {
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

// Configuration for typed collections
export interface TypedCollectionConfig<T extends Item, S extends TypedSchemaDefinition<T>>
  extends Omit<ICollectionConfig<T>, 'indexList'> {
  schema: S | CompleteTypedSchema<T>
  schemaOptions?: SchemaValidationOptions
}

// Main TypedCollection class
export class TypedCollection<T extends Item, S extends TypedSchemaDefinition<T>> {
  private collection: Collection<T>
  private schema: S
  private validator: FieldValidator
  private queryBuilder: SchemaAwareQueryBuilder
  private schemaOptions: SchemaValidationOptions

  constructor(config: TypedCollectionConfig<T, S>) {
    const { schema, schemaOptions = {}, ...collectionConfig } = config

    // Extract schema and options
    if ('fields' in schema) {
      // CompleteTypedSchema format
      this.schema = schema.fields as S
      this.schemaOptions = { ...schema.options, ...schemaOptions }
    } else {
      // Direct TypedSchemaDefinition format
      this.schema = schema as S
      this.schemaOptions = schemaOptions
    }

    // Convert typed schema to legacy format for compatibility
    const legacySchema = this.convertToLegacySchema(this.schema)

    // Create field validator and query builder
    this.validator = new FieldValidator(legacySchema)
    this.queryBuilder = createSchemaAwareQuery(legacySchema, {
      validateTypes: true,
      coerceValues: this.schemaOptions.coerceTypes,
      strictMode: this.schemaOptions.strict,
      allowUnknownFields: this.schemaOptions.allowUnknownFields
    })

    // Extract and create indexes from schema
    const schemaIndexes = extractIndexesFromSchema(this.schema)
    const indexList: IndexDef<T>[] = schemaIndexes.map(({ field, options }) =>
      this.convertToIndexDef(field, options)
    )

    // Create underlying collection with generated indexes
    this.collection = Collection.create({
      ...collectionConfig,
      indexList
    })
  }

  // Type-safe query methods
  async find(query: TypedQuery<T, S>): Promise<T[]> {
    const { queryFn, validation } = this.queryBuilder.buildQuery(query)

    if (!validation.valid && this.schemaOptions.strict) {
      throw new Error(`Query validation failed: ${validation.errors.join(', ')}`)
    }

    return this.collection.find(queryFn as TraverseCondition<T>)
  }

  async findFirst(query: TypedQuery<T, S>): Promise<T | undefined> {
    const { queryFn, validation } = this.queryBuilder.buildQuery(query)

    if (!validation.valid && this.schemaOptions.strict) {
      throw new Error(`Query validation failed: ${validation.errors.join(', ')}`)
    }

    return this.collection.findFirst(queryFn as TraverseCondition<T>)
  }

  async findLast(query: TypedQuery<T, S>): Promise<T | undefined> {
    const { queryFn, validation } = this.queryBuilder.buildQuery(query)

    if (!validation.valid && this.schemaOptions.strict) {
      throw new Error(`Query validation failed: ${validation.errors.join(', ')}`)
    }

    return this.collection.findLast(queryFn as TraverseCondition<T>)
  }

  // Type-safe field-based queries
  async findBy<K extends keyof S>(
    field: K,
    value: any
  ): Promise<T[]> {
    return this.collection.findBy(field as unknown as Paths<T>, value as ValueType)
  }

  async findFirstBy<K extends keyof S>(
    field: K,
    value: any
  ): Promise<T | undefined> {
    return this.collection.findFirstBy(field as unknown as Paths<T>, value as ValueType)
  }

  async findLastBy<K extends keyof S>(
    field: K,
    value: any
  ): Promise<T | undefined> {
    return this.collection.findLastBy(field as unknown as Paths<T>, value as ValueType)
  }

  // Type-safe insert with validation
  async insert(item: TypedInsert<T, S>): Promise<T | undefined> {
    const validation = this.validateDocument(item)

    if (!validation.valid) {
      if (this.schemaOptions.strict) {
        throw new Error(`Document validation failed: ${validation.errors.map(e => e.message).join(', ')}`)
      } else {
        console.warn('Document validation warnings:', validation.warnings)
      }
    }

    const processedItem = validation.data || item
    return this.collection.create(processedItem as T)
  }

  async create(item: TypedInsert<T, S>): Promise<T | undefined> {
    return this.insert(item)
  }

  async save(item: T): Promise<T | undefined> {
    const validation = this.validateDocument(item)

    if (!validation.valid && this.schemaOptions.strict) {
      throw new Error(`Document validation failed: ${validation.errors.map(e => e.message).join(', ')}`)
    }

    return this.collection.save(item)
  }

  // Type-safe update methods
  async update(
    query: TypedQuery<T, S>,
    update: TypedUpdate<T, S>,
    merge: boolean = true
  ): Promise<T[]> {
    const { queryFn, validation } = this.queryBuilder.buildQuery(query)

    if (!validation.valid && this.schemaOptions.strict) {
      throw new Error(`Query validation failed: ${validation.errors.join(', ')}`)
    }

    return this.collection.update(queryFn as TraverseCondition<T>, update as Partial<T>, merge)
  }

  async updateFirst(
    query: TypedQuery<T, S>,
    update: TypedUpdate<T, S>,
    merge: boolean = true
  ): Promise<T | undefined> {
    const { queryFn, validation } = this.queryBuilder.buildQuery(query)

    if (!validation.valid && this.schemaOptions.strict) {
      throw new Error(`Query validation failed: ${validation.errors.join(', ')}`)
    }

    return this.collection.updateFirst(queryFn as TraverseCondition<T>, update as Partial<T>, merge)
  }

  async updateLast(
    query: TypedQuery<T, S>,
    update: TypedUpdate<T, S>,
    merge: boolean = true
  ): Promise<T | undefined> {
    const { queryFn, validation } = this.queryBuilder.buildQuery(query)

    if (!validation.valid && this.schemaOptions.strict) {
      throw new Error(`Query validation failed: ${validation.errors.join(', ')}`)
    }

    return this.collection.updateLast(queryFn as TraverseCondition<T>, update as Partial<T>, merge)
  }

  // Type-safe remove methods
  async remove(query: TypedQuery<T, S>): Promise<Array<T | undefined>> {
    const { queryFn, validation } = this.queryBuilder.buildQuery(query)

    if (!validation.valid && this.schemaOptions.strict) {
      throw new Error(`Query validation failed: ${validation.errors.join(', ')}`)
    }

    return this.collection.remove(queryFn as TraverseCondition<T>)
  }

  async removeFirst(query: TypedQuery<T, S>): Promise<T | undefined> {
    const { queryFn, validation } = this.queryBuilder.buildQuery(query)

    if (!validation.valid && this.schemaOptions.strict) {
      throw new Error(`Query validation failed: ${validation.errors.join(', ')}`)
    }

    return this.collection.removeFirst(queryFn as TraverseCondition<T>)
  }

  async removeLast(query: TypedQuery<T, S>): Promise<T | undefined> {
    const { queryFn, validation } = this.queryBuilder.buildQuery(query)

    if (!validation.valid && this.schemaOptions.strict) {
      throw new Error(`Query validation failed: ${validation.errors.join(', ')}`)
    }

    return this.collection.removeLast(queryFn as TraverseCondition<T>)
  }

  // Direct access to underlying collection for advanced operations
  get underlying(): Collection<T> {
    return this.collection
  }

  // Schema and validation utilities
  validateDocument(doc: any): TypedSchemaValidationResult<T> {
    const result = this.validator.validateDocument(doc)

    // Convert legacy format to typed format
    return {
      valid: result.valid,
      data: result.processedDoc,
      errors: result.errors.map(error => ({
        field: 'unknown',
        message: error,
        value: undefined
      })),
      warnings: result.warnings.map(warning => ({
        field: 'unknown',
        message: warning,
        value: undefined
      }))
    }
  }

  validateQuery(query: TypedQuery<T, S>) {
    return this.queryBuilder.validateQuery(query)
  }

  getSchema(): S {
    return this.schema
  }

  // Index management
  async createIndex(name: string, field: keyof S, options?: IndexOptions): Promise<void> {
    const indexDef = this.convertToIndexDef(field as string, options || {})
    return this.collection.createIndex(name, indexDef)
  }

  listIndexes(name?: string) {
    return this.collection.listIndexes(name)
  }

  dropIndex(name: string) {
    return this.collection.dropIndex(name)
  }

  // Collection management
  async load(name?: string): Promise<void> {
    return this.collection.load(name)
  }

  async persist(name?: string): Promise<void> {
    return this.collection.persist(name)
  }

  async reset(): Promise<void> {
    return this.collection.reset()
  }

  // Utility methods
  async first(): Promise<T> {
    return this.collection.first()
  }

  async last(): Promise<T> {
    return this.collection.last()
  }

  async findById(id: ValueType): Promise<T | undefined> {
    return this.collection.findById(id)
  }

  async updateWithId(
    id: ValueType,
    update: TypedUpdate<T, S>,
    merge: boolean = true
  ): Promise<T | undefined> {
    return this.collection.updateWithId(id, update as Partial<T>, merge)
  }

  async removeWithId(id: ValueType): Promise<T | undefined> {
    return this.collection.removeWithId(id)
  }

  // Private utility methods
  private convertToLegacySchema(schema: S): SchemaDefinition {
    const legacySchema: SchemaDefinition = {}

    for (const [fieldPath, fieldDef] of Object.entries(schema)) {
      legacySchema[fieldPath] = {
        type: fieldDef.type || 'object',
        required: fieldDef.required,
        default: fieldDef.default,
        coerce: fieldDef.coerce,
        strict: this.schemaOptions.strict,
        validator: fieldDef.validator,
        description: fieldDef.description
      }
    }

    return legacySchema
  }

  private convertToIndexDef(field: string, options: IndexOptions): IndexDef<T> {
    return {
      key: field as Paths<T>,
      order: options.order,
      unique: options.unique,
      sparse: options.sparse,
      auto: false,
      process: (value: any) => value // Identity function for simple fields
    }
  }

  // Enhanced update methods with Type-safe operations
  async updateAtomic(
    operation: AtomicUpdateOperation<T, S>
  ): Promise<UpdateResult<T>> {
    const { filter, update, options = {} } = operation
    const { upsert = false, multi = true, merge = true, validateSchema = true } = options

    let matchedCount = 0
    let modifiedCount = 0
    let upsertedCount = 0
    const upsertedIds: Array<T[keyof T]> = []
    const modifiedDocuments: T[] = []

    // Find matching documents
    const matches = await this.find(filter)
    matchedCount = matches.length

    if (matches.length === 0 && upsert) {
      // Handle upsert case
      const baseDoc = { ...filter } as Partial<T> // Start with filter fields
      const newDoc = this.applyUpdateToDocument(baseDoc as T, update, merge, false) // Don't validate yet

      // Apply defaults from schema
      for (const [field, fieldDef] of Object.entries(this.schema)) {
        if (fieldDef.default !== undefined && newDoc[field as keyof T] === undefined) {
          (newDoc as any)[field] = typeof fieldDef.default === 'function'
            ? fieldDef.default()
            : fieldDef.default
        }
      }

      // Validate after applying defaults
      if (validateSchema) {
        const validation = this.validateDocument(newDoc)
        if (!validation.valid) {
          throw new Error(`Schema validation failed: ${validation.errors.map(e => e.message).join(', ')}`)
        }
      }

      const inserted = await this.insert(newDoc as TypedInsert<T, S>)
      if (inserted) {
        upsertedCount = 1
        upsertedIds.push(inserted[this.collection.id as keyof T])
        modifiedDocuments.push(inserted)
      }
    } else {
      // Update existing documents
      const documentsToUpdate = multi ? matches : matches.slice(0, 1)

      for (const doc of documentsToUpdate) {
        const updatedDoc = this.applyUpdateToDocument(doc, update, merge, validateSchema)

        // For $unset to work properly, we need to replace the entire document
        const hasUnset = this.hasUpdateOperators(update) &&
          (update as TypedUpdateOperators<T, S>).$unset

        let result: T | undefined
        if (hasUnset) {
          // For $unset, we need to completely replace the document
          // First update indexes
          await update_index(this.collection, doc, updatedDoc as T, doc[this.collection.id as keyof T] as ValueType)
          // Then update the document
          await this.collection.list.update(doc[this.collection.id as keyof T] as ValueType, updatedDoc as T)
          result = updatedDoc as T
        } else {
          // For other operations, use normal updateWithId
          result = await this.collection.updateWithId(
            doc[this.collection.id as keyof T] as ValueType,
            updatedDoc as T,
            merge
          )
        }

        if (result) {
          modifiedCount++
          modifiedDocuments.push(result)
        }
      }
    }

    return {
      matchedCount,
      modifiedCount,
      upsertedCount,
      upsertedIds,
      modifiedDocuments
    }
  }

  async updateBulk(
    bulkOperation: BulkUpdateOperation<T, S>
  ): Promise<UpdateResult<T>[]> {
    const { operations, options = {} } = bulkOperation
    const { ordered = true, validateAll = true } = options

    const results: UpdateResult<T>[] = []

    if (ordered) {
      // Execute operations in order, stop on first error
      for (const operation of operations) {
        try {
          const result = await this.updateAtomic(operation)
          results.push(result)
        } catch (error) {
          if (validateAll) {
            throw error
          }
          // Continue with next operation if validateAll is false
        }
      }
    } else {
      // Execute all operations in parallel
      const promises = operations.map(operation => this.updateAtomic(operation))
      const parallelResults = await Promise.allSettled(promises)

      for (const result of parallelResults) {
        if (result.status === 'fulfilled') {
          results.push(result.value)
        } else if (validateAll) {
          throw result.reason
        }
      }
    }

    return results
  }

  // Apply update operations to a document
  private applyUpdateToDocument(
    doc: T,
    update: TypedUpdate<T, S>,
    merge: boolean = true,
    validateSchema: boolean = true
  ): Partial<T> {
    let result = merge ? { ...doc } : {} as Partial<T>

    // Handle direct field updates
    if (this.isDirectUpdate(update)) {
      result = merge ? { ...result, ...update } : update
    }

    // Handle operator-based updates
    if (this.hasUpdateOperators(update)) {
      result = this.applyUpdateOperators(result, update as TypedUpdateOperators<T, S>)
    }

    // Validate schema if required
    if (validateSchema) {
      const validation = this.validateDocument(result)
      if (!validation.valid) {
        throw new Error(`Schema validation failed: ${validation.errors.map(e => e.message).join(', ')}`)
      }
    }

    return result
  }

  // Check if update contains direct field updates
  private isDirectUpdate(update: TypedUpdate<T, S>): update is Partial<T> {
    return Object.keys(update).some(key => !key.startsWith('$'))
  }

  // Check if update contains operator-based updates
  private hasUpdateOperators(update: TypedUpdate<T, S>): update is TypedUpdateOperators<T, S> {
    return Object.keys(update).some(key => key.startsWith('$'))
  }

  // Apply MongoDB-style update operators
  private applyUpdateOperators(
    doc: Partial<T>,
    operators: TypedUpdateOperators<T, S>
  ): Partial<T> {
    let result = { ...doc }

    // $set operator
    if (operators.$set) {
      result = { ...result, ...operators.$set }
    }

    // $unset operator
    if (operators.$unset) {
      const fieldsToUnset = Object.keys(operators.$unset).filter(field => operators.$unset![field])
      if (fieldsToUnset.length > 0) {
        // Create a new object without the unset fields
        const newResult = {} as any
        for (const [key, value] of Object.entries(result)) {
          if (!fieldsToUnset.includes(key)) {
            newResult[key] = value
          }
        }
        result = newResult as Partial<T>
      }
    }

    // $inc operator
    if (operators.$inc) {
      for (const [field, increment] of Object.entries(operators.$inc)) {
        if (typeof increment === 'number' && typeof result[field as keyof T] === 'number') {
          (result as any)[field] = ((result[field as keyof T] as number) || 0) + increment
        }
      }
    }

    // $mul operator
    if (operators.$mul) {
      for (const [field, multiplier] of Object.entries(operators.$mul)) {
        if (typeof multiplier === 'number' && typeof result[field as keyof T] === 'number') {
          (result as any)[field] = ((result[field as keyof T] as number) || 0) * multiplier
        }
      }
    }

    // $min operator
    if (operators.$min) {
      for (const [field, minValue] of Object.entries(operators.$min)) {
        const currentValue = result[field as keyof T]
        if (currentValue !== undefined && minValue !== undefined && (minValue as any) < (currentValue as any)) {
          (result as any)[field] = minValue
        }
      }
    }

    // $max operator
    if (operators.$max) {
      for (const [field, maxValue] of Object.entries(operators.$max)) {
        const currentValue = result[field as keyof T]
        if (currentValue !== undefined && maxValue !== undefined && (maxValue as any) > (currentValue as any)) {
          (result as any)[field] = maxValue
        }
      }
    }

    // $currentDate operator
    if (operators.$currentDate) {
      for (const [field, dateSpec] of Object.entries(operators.$currentDate)) {
        if (dateSpec === true || (typeof dateSpec === 'object' && dateSpec.$type === 'date')) {
          (result as any)[field] = new Date()
        } else if (typeof dateSpec === 'object' && dateSpec.$type === 'timestamp') {
          (result as any)[field] = new Date()
        }
      }
    }

    // Array operators
    this.applyArrayOperators(result, operators)

    return result
  }

  // Apply array-specific update operators
  private applyArrayOperators(
    doc: Partial<T>,
    operators: TypedUpdateOperators<T, S>
  ): void {
    // $addToSet operator
    if (operators.$addToSet) {
      for (const [field, valueSpec] of Object.entries(operators.$addToSet)) {
        const currentArray = doc[field as keyof T] as any[]
        if (Array.isArray(currentArray)) {
          if (typeof valueSpec === 'object' && valueSpec.$each) {
            // Add multiple values
            for (const value of valueSpec.$each) {
              if (!currentArray.includes(value)) {
                currentArray.push(value)
              }
            }
          } else {
            // Add single value
            if (!currentArray.includes(valueSpec)) {
              currentArray.push(valueSpec)
            }
          }
        }
      }
    }

    // $push operator
    if (operators.$push) {
      for (const [field, valueSpec] of Object.entries(operators.$push)) {
        const currentArray = doc[field as keyof T] as any[]
        if (Array.isArray(currentArray)) {
          if (typeof valueSpec === 'object' && valueSpec.$each) {
            // Push multiple values with options
            let valuesToPush = valueSpec.$each

            // Apply sort if specified
            if (valueSpec.$sort !== undefined) {
              if (typeof valueSpec.$sort === 'number') {
                valuesToPush = valuesToPush.sort((a, b) =>
                  valueSpec.$sort === 1 ? (a > b ? 1 : -1) : (a < b ? 1 : -1)
                )
              }
            }

            // Insert at position if specified
            if (valueSpec.$position !== undefined) {
              currentArray.splice(valueSpec.$position, 0, ...valuesToPush)
            } else {
              currentArray.push(...valuesToPush)
            }

            // Apply slice if specified
            if (valueSpec.$slice !== undefined) {
              if (valueSpec.$slice > 0) {
                currentArray.splice(valueSpec.$slice)
              } else if (valueSpec.$slice < 0) {
                currentArray.splice(0, currentArray.length + valueSpec.$slice)
              }
            }
          } else {
            // Push single value
            currentArray.push(valueSpec)
          }
        }
      }
    }

    // $pull operator
    if (operators.$pull) {
      for (const [field, condition] of Object.entries(operators.$pull)) {
        const currentArray = doc[field as keyof T] as any[]
        if (Array.isArray(currentArray)) {
          // Remove elements matching condition
          for (let i = currentArray.length - 1; i >= 0; i--) {
            if (this.matchesCondition(currentArray[i], condition)) {
              currentArray.splice(i, 1)
            }
          }
        }
      }
    }

    // $pullAll operator
    if (operators.$pullAll) {
      for (const [field, valuesToRemove] of Object.entries(operators.$pullAll)) {
        const currentArray = doc[field as keyof T] as any[]
        if (Array.isArray(currentArray) && Array.isArray(valuesToRemove)) {
          for (let i = currentArray.length - 1; i >= 0; i--) {
            if (valuesToRemove.includes(currentArray[i])) {
              currentArray.splice(i, 1)
            }
          }
        }
      }
    }

    // $pop operator
    if (operators.$pop) {
      for (const [field, direction] of Object.entries(operators.$pop)) {
        const currentArray = doc[field as keyof T] as any[]
        if (Array.isArray(currentArray)) {
          if (direction === 1) {
            currentArray.pop() // Remove last element
          } else if (direction === -1) {
            currentArray.shift() // Remove first element
          }
        }
      }
    }
  }

  // Helper method to check if a value matches a condition
  private matchesCondition(value: any, condition: any): boolean {
    if (typeof condition === 'object' && condition !== null) {
      // Handle complex query conditions
      return Object.entries(condition).every(([key, condValue]) => {
        if (key.startsWith('$')) {
          // Handle query operators
          switch (key) {
            case '$eq': return value === condValue
            case '$ne': return value !== condValue
            case '$gt': return value > condValue
            case '$gte': return value >= condValue
            case '$lt': return value < condValue
            case '$lte': return value <= condValue
            case '$in': return Array.isArray(condValue) && condValue.includes(value)
            case '$nin': return Array.isArray(condValue) && !condValue.includes(value)
            default: return false
          }
        } else {
          // Handle field matching
          return value && value[key] === condValue
        }
      })
    } else {
      // Simple equality check
      return value === condition
    }
  }
}

// Factory function for creating typed collections
export function createTypedCollection<T extends Item, S extends TypedSchemaDefinition<T>>(
  config: TypedCollectionConfig<T, S>
): TypedCollection<T, S> {
  return new TypedCollection(config)
}

// Helper for creating schema-first collections
export function createSchemaCollection<T extends Item>(
  schema: CompleteTypedSchema<T>,
  config: Omit<TypedCollectionConfig<T, any>, 'schema'>
): TypedCollection<T, TypedSchemaDefinition<T>> {
  return new TypedCollection({
    ...config,
    schema
  })
}