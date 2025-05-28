import AdapterFile from './AdapterFile'
import Collection from './collection'
import { IDataCollection } from './IDataCollection'
import { List } from './storage/List'
import { copy_collection } from './collection/copy_collection'
import AdapterMemory from './AdapterMemory'
import { FileStorage } from './storage/FileStorage'
import type { Item } from './types/Item'

// Main TypedCollection API - recommended for all new projects
export { TypedCollection, createTypedCollection, createSchemaCollection } from './TypedCollection'
export type {
  TypedCollectionConfig,
  TypedSchemaValidationResult
} from './TypedCollection'

// Typed Schema System
export type {
  TypedSchemaDefinition,
  TypedFieldDefinition,
  CompleteTypedSchema,
  TypedQuery,
  TypedInsert,
  TypedUpdate,
  TypedUpdateOperators,
  AtomicUpdateOperation,
  BulkUpdateOperation,
  UpdateResult,
  IndexOptions,
  SchemaValidationOptions,
  SchemaValidationResult
} from './types/typed-schema'

// Legacy Collection API - for internal use and backward compatibility
export { Collection }

// Storage and Adapters
export { AdapterMemory }
export { AdapterFile as AdapterFile }
export { List }
export { FileStorage }

// Utilities
export { copy_collection }

// Database and Transactions
export { CSDatabase } from './CSDatabase'
export type { CSTransaction } from './CSDatabase'

// Types
export type { Item, IDataCollection }

// Field Types System (for advanced schema definitions)
export type {
  BSONType,
  FieldTypeDefinition,
  SchemaDefinition
} from './types/field-types'

// Query System
export type {
  TraverseCondition
} from './types/TraverseCondition'

// Index Types
export type {
  IndexDef,
  SortOrder
} from './types/IndexDef'
