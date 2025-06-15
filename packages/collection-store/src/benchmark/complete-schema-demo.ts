// Comprehensive demonstration of type-safe collections and performance

import { readFileSync } from 'fs'
import * as path from 'path'
import AdapterMemory from '../storage/adapters/AdapterMemory'
import { List } from '../storage/List'
import {
  createTypedCollection
} from '../core/TypedCollection'
import { TypedSchemaDefinition } from '../types/typed-schema'
import { Item } from '../types/Item'
import {
  SchemaDefinition,
  createFieldValidator,
  validateOperator
} from '../types/field-types'
import {
  createSchemaAwareQuery,
  inferSchemaFromData
} from '../query/schema-aware-query'

// Configuration
const DATASET_SIZE = parseInt(process.env.BENCH_SIZE || '1000')

console.log('🎯 Complete TypedCollection Demo & Benchmark')
console.log('=' .repeat(70))

// Define TypeScript interface for our benchmark data
interface BenchmarkUser extends Item {
  id: number
  name: string
  age: number
  email: string
  category: string
  status: string
  rating: number
  score: number
  counter: number
  tags: string[]
  items: any[]
  values: any[]
  scores: number[]
  permissions: string[]
  nested: {
    value: string | null
    deep: {
      level: number
      active: boolean
    }
  }
  profile: {
    bio: string | null
    settings: {
      theme: string
      notifications: boolean
      language: string
    }
    preferences: any[]
  }
  location: {
    country: string
    city: string
    coordinates: {
      lat: number
      lng: number
    }
  }
  metadata: {
    created: Date
    updated: Date | null
    version: number
    tags: string[]
  }
  stats: {
    loginCount: number
    lastActive: Date
    totalSpent: number
  }
  features: {
    darkMode: boolean
    betaAccess: boolean
    premiumFeatures: boolean
    apiAccess: boolean
    maxProjects: number
    storageLimit: number
    priority: string
  }
}

// Load data
const DATA_FILE_PATH = path.resolve(__dirname, 'data', `benchmark_data_${DATASET_SIZE}.json`)
let benchmarkData: BenchmarkUser[] = []

try {
  console.log(`📂 Loading data from: ${DATA_FILE_PATH}`)
  const rawData = readFileSync(DATA_FILE_PATH, 'utf-8')
  benchmarkData = JSON.parse(rawData)
  console.log(`✅ Loaded ${benchmarkData.length} records`)
} catch (error: any) {
  console.error(`❌ Error loading data: ${error.message}`)
  process.exit(1)
}

// Convert dates for compatibility
function convertDates(obj: any): any {
  if (obj === null || obj === undefined) return obj

  if (typeof obj === 'string') {
    if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d{3})?Z$/.test(obj)) {
      return new Date(obj)
    }
    return obj
  }

  if (Array.isArray(obj)) {
    return obj.map(convertDates)
  }

  if (typeof obj === 'object') {
    const converted: any = {}
    for (const [key, value] of Object.entries(obj)) {
      converted[key] = convertDates(value)
    }
    return converted
  }

  return obj
}

benchmarkData = benchmarkData.map(convertDates)
console.log(`✅ Dates converted`)

// ============================================================================
// PART 1: SCHEMA INFERENCE AND BASIC DEMO
// ============================================================================

console.log('\n' + '='.repeat(70))
console.log('📋 PART 1: SCHEMA INFERENCE AND BASIC FEATURES')
console.log('='.repeat(70))

// 1. Infer schema from sample data
console.log('\n🔍 Step 1: Inferring schema from sample data...')
const sampleData = benchmarkData.slice(0, 10)
const inferredSchema = inferSchemaFromData(sampleData)

console.log(`✅ Inferred schema with ${Object.keys(inferredSchema).length} fields`)
console.log('🔍 Sample inferred fields (first 10):')
const schemaEntries = Object.entries(inferredSchema).slice(0, 10)
for (const [field, def] of schemaEntries) {
  const typeStr = Array.isArray(def.type) ? def.type.join(' | ') : def.type
  console.log(`  ${field}: ${typeStr}`)
}
console.log(`  ... and ${Object.keys(inferredSchema).length - 10} more fields`)

// 2. Create a comprehensive custom schema
console.log('\n📋 Step 2: Creating comprehensive custom schema...')
const customSchema: SchemaDefinition = {
  // Basic fields
  'id': { type: 'int', required: true, description: 'Unique identifier' },
  'name': { type: 'string', required: true, validator: (v) => typeof v === 'string' && v.length > 0 },
  'age': { type: ['int', 'double'], coerce: true, validator: (v) => typeof v === 'number' && v >= 0 && v <= 150 },
  'email': { type: 'string', validator: (v) => typeof v === 'string' && v.includes('@') },
  'category': { type: 'string' },
  'status': { type: 'string' },
  'rating': { type: 'double', coerce: true, validator: (v) => typeof v === 'number' && v >= 1.0 && v <= 5.0 },
  'score': { type: 'int', coerce: true },
  'counter': { type: 'int', coerce: true },

  // Array fields
  'tags': { type: 'array', required: false },
  'items': { type: 'array' },
  'values': { type: 'array' },
  'scores': { type: 'array' },
  'permissions': { type: 'array' },

  // Nested object fields
  'nested.value': { type: ['string', 'null'] },
  'nested.deep.level': { type: 'int' },
  'nested.deep.active': { type: 'boolean' },

  // Profile fields
  'profile.bio': { type: ['string', 'null'] },
  'profile.settings.theme': { type: 'string' },
  'profile.settings.notifications': { type: 'boolean', coerce: true, default: true },
  'profile.settings.language': { type: 'string' },
  'profile.preferences': { type: 'array' },

  // Location fields
  'location.country': { type: 'string' },
  'location.city': { type: 'string' },
  'location.coordinates.lat': { type: 'double' },
  'location.coordinates.lng': { type: 'double' },

  // Metadata fields
  'metadata.created': { type: 'date', coerce: true },
  'metadata.updated': { type: ['date', 'null'], coerce: true },
  'metadata.version': { type: 'int' },
  'metadata.tags': { type: 'array' },

  // Stats fields
  'stats.loginCount': { type: 'int', coerce: true, validator: (v) => typeof v === 'number' && v >= 0 },
  'stats.lastActive': { type: 'date', coerce: true },
  'stats.totalSpent': { type: 'double', coerce: true },

  // Features fields
  'features.darkMode': { type: 'boolean' },
  'features.betaAccess': { type: 'boolean' },
  'features.premiumFeatures': { type: 'boolean' },
  'features.apiAccess': { type: 'boolean' },
  'features.maxProjects': { type: 'int' },
  'features.storageLimit': { type: 'int' },
  'features.priority': { type: 'string' }
}

console.log(`✅ Created comprehensive schema with ${Object.keys(customSchema).length} field definitions`)

// 3. Create schema-aware query builder
console.log('\n🔧 Step 3: Creating schema-aware query builder...')
const queryBuilder = createSchemaAwareQuery(customSchema, {
  validateTypes: true,
  coerceValues: true,
  strictMode: false,
  allowUnknownFields: true
})

console.log('✅ Schema-aware query builder created')

// 4. Test various query validation scenarios
console.log('\n🧪 Step 4: Testing query validation scenarios...')

const testQueries = [
  {
    name: 'Valid query',
    query: {
      age: { $gte: 25, $lte: 45 },
      rating: { $gte: 4.0 },
      'profile.settings.notifications': true
    }
  },
  {
    name: 'Query with type coercion',
    query: {
      age: { $gte: "25" }, // String that can be coerced to number
      rating: { $gte: "4.0" }, // String that can be coerced to number
      'stats.loginCount': { $gt: "10" } // String that can be coerced to int
    }
  },
  {
    name: 'Query with type errors',
    query: {
      age: { $regex: "test" }, // $regex not compatible with number field
      rating: { $bitsAllSet: 5 }, // Bitwise operator on non-integer field
      tags: { $gt: 10 } // Comparison operator on array field
    }
  },
  {
    name: 'Query with unknown fields',
    query: {
      unknownField: { $eq: "value" },
      'deep.unknown.path': { $ne: null }
    }
  }
]

for (const testCase of testQueries) {
  console.log(`\n  🧪 Testing: ${testCase.name}`)

  const validation = queryBuilder.validateQuery(testCase.query)
  console.log(`     Valid: ${validation.valid ? '✅' : '❌'}`)

  if (validation.errors.length > 0) {
    console.log('     Errors:')
    validation.errors.forEach(error => console.log(`       ❌ ${error}`))
  }

  if (validation.warnings.length > 0) {
    console.log('     Warnings:')
    validation.warnings.slice(0, 2).forEach(warning => console.log(`       ⚠️  ${warning}`))
    if (validation.warnings.length > 2) {
      console.log(`       ... and ${validation.warnings.length - 2} more warnings`)
    }
  }
}

// 5. Test document validation
console.log('\n📄 Step 5: Testing document validation...')

const testDocuments = [
  {
    name: 'Valid document',
    doc: {
      id: 1,
      name: "John Doe",
      age: 30,
      email: "john@example.com",
      rating: 4.5,
      tags: ["developer", "senior"],
      metadata: { created: new Date() },
      stats: { loginCount: 42 },
      profile: { settings: { notifications: true } }
    }
  },
  {
    name: 'Document with coercion needed',
    doc: {
      id: "2", // String that can be coerced to int
      name: "Jane Doe",
      age: "25", // String that can be coerced to number
      email: "jane@example.com",
      rating: "4.0", // String that can be coerced to double
      stats: { loginCount: "15" } // String that can be coerced to int
    }
  },
  {
    name: 'Document with validation errors',
    doc: {
      id: null, // Required field is null
      name: "", // Empty string fails custom validator
      age: -5, // Negative age fails validator
      email: "invalid-email", // No @ symbol
      rating: 6.0 // Rating > 5.0 fails validator
    }
  }
]

const validator = createFieldValidator(customSchema)

for (const testCase of testDocuments) {
  console.log(`\n  📄 Testing: ${testCase.name}`)

  const validation = validator.validateDocument(testCase.doc)
  console.log(`     Valid: ${validation.valid ? '✅' : '❌'}`)

  if (validation.errors.length > 0) {
    console.log('     Errors:')
    validation.errors.slice(0, 3).forEach(error => console.log(`       ❌ ${error}`))
    if (validation.errors.length > 3) {
      console.log(`       ... and ${validation.errors.length - 3} more errors`)
    }
  }

  if (validation.warnings.length > 0) {
    console.log('     Warnings:')
    validation.warnings.slice(0, 3).forEach(warning => console.log(`       ⚠️  ${warning}`))
    if (validation.warnings.length > 3) {
      console.log(`       ... and ${validation.warnings.length - 3} more warnings`)
    }
  }
}

// 6. Test operator compatibility
console.log('\n🔧 Step 6: Testing operator compatibility...')

const operatorTests = [
  { operator: '$regex', fieldType: 'string' as const, value: 'test.*' },
  { operator: '$regex', fieldType: 'int' as const, value: 'test.*' },
  { operator: '$bitsAllSet', fieldType: 'int' as const, value: 5 },
  { operator: '$bitsAllSet', fieldType: 'string' as const, value: 5 },
  { operator: '$size', fieldType: 'array' as const, value: 3 },
  { operator: '$size', fieldType: 'string' as const, value: 3 },
]

for (const test of operatorTests) {
  const result = validateOperator(test.operator, test.fieldType, test.value)
  const status = result.valid ? '✅' : '❌'
  console.log(`  ${status} ${test.operator} on ${test.fieldType}: ${result.valid ? 'Compatible' : result.error}`)
}

// ============================================================================
// PART 2: TYPEDCOLLECTION DEMONSTRATION
// ============================================================================

console.log('\n' + '='.repeat(70))
console.log('🚀 PART 2: TYPEDCOLLECTION DEMONSTRATION')
console.log('='.repeat(70))

// 1. Create TypedCollection schema
console.log('\n📋 Step 1: Creating TypedCollection schema...')
const typedSchema: TypedSchemaDefinition<BenchmarkUser> = {
  id: {
    type: 'int',
    required: true,
    index: { unique: true }
  },
  name: {
    type: 'string',
    required: true,
    index: true,
    validator: (v: string) => v.length > 0
  },
  age: {
    type: 'int',
    required: true,
    index: true,
    validator: (v: number) => v >= 0 && v <= 150
  },
  email: {
    type: 'string',
    required: true,
    unique: true,
    validator: (v: string) => v.includes('@')
  },
  category: {
    type: 'string',
    index: true
  },
  status: {
    type: 'string',
    index: true
  },
  rating: {
    type: 'double',
    index: true,
    validator: (v: number) => v >= 1.0 && v <= 5.0
  },
  score: {
    type: 'int',
    index: true
  },
  counter: {
    type: 'int'
  },
  tags: {
    type: 'array',
    default: []
  },
  items: {
    type: 'array',
    default: []
  },
  values: {
    type: 'array',
    default: []
  },
  scores: {
    type: 'array',
    default: []
  },
  permissions: {
    type: 'array',
    default: []
  },
  'nested.value': {
    type: 'string'
  },
  'nested.deep.level': {
    type: 'int'
  },
  'nested.deep.active': {
    type: 'boolean'
  },
  'profile.bio': {
    type: 'string'
  },
  'profile.settings.theme': {
    type: 'string',
    default: 'light'
  },
  'profile.settings.notifications': {
    type: 'boolean',
    default: true
  },
  'profile.settings.language': {
    type: 'string',
    default: 'en'
  },
  'profile.preferences': {
    type: 'array',
    default: []
  },
  'location.country': {
    type: 'string',
    index: true
  },
  'location.city': {
    type: 'string',
    index: true
  },
  'location.coordinates.lat': {
    type: 'double'
  },
  'location.coordinates.lng': {
    type: 'double'
  },
  'metadata.created': {
    type: 'date',
    required: true,
    index: true
  },
  'metadata.updated': {
    type: 'date'
  },
  'metadata.version': {
    type: 'int',
    default: 1
  },
  'metadata.tags': {
    type: 'array',
    default: []
  },
  'stats.loginCount': {
    type: 'int',
    default: 0,
    validator: (v: number) => v >= 0
  },
  'stats.lastActive': {
    type: 'date'
  },
  'stats.totalSpent': {
    type: 'double',
    default: 0.0
  },
  'features.darkMode': {
    type: 'boolean',
    default: false
  },
  'features.betaAccess': {
    type: 'boolean',
    default: false
  },
  'features.premiumFeatures': {
    type: 'boolean',
    default: false
  },
  'features.apiAccess': {
    type: 'boolean',
    default: false
  },
  'features.maxProjects': {
    type: 'int',
    default: 5
  },
  'features.storageLimit': {
    type: 'int',
    default: 1000
  },
  'features.priority': {
    type: 'string',
    default: 'normal'
  }
}

console.log(`✅ Created TypedCollection schema with ${Object.keys(typedSchema).length} field definitions`)

// 2. Create TypedCollection
console.log('\n🏗️ Step 2: Creating TypedCollection...')
const typedCollection = createTypedCollection({
  name: 'benchmark-users',
  schema: typedSchema,
  root: './benchmark-data',
  list: new List<BenchmarkUser>(),
  adapter: new AdapterMemory<BenchmarkUser>(),
  schemaOptions: {
    strict: false,
    coerceTypes: true,
    validateRequired: true
  }
})

console.log('✅ TypedCollection created with automatic indexes')

// 3. Insert sample data
console.log('\n📝 Step 3: Inserting sample data into TypedCollection...')
const sampleUsers = benchmarkData.slice(0, 100) // Use first 100 records

let insertedCount = 0
let validationErrors = 0

for (const user of sampleUsers) {
  try {
    await typedCollection.insert(user)
    insertedCount++
  } catch (error) {
    validationErrors++
    if (validationErrors <= 3) {
      const errorMessage = error instanceof Error ? error.message : String(error)
      console.log(`   ⚠️ Validation error: ${errorMessage}`)
    }
  }
}

console.log(`✅ Inserted ${insertedCount} users (${validationErrors} validation errors)`)

// 4. Demonstrate type-safe queries
console.log('\n🔍 Step 4: Demonstrating type-safe queries...')

// Simple queries
const activeUsers = await typedCollection.find({
  'features.premiumFeatures': true,
  age: { $gte: 25, $lte: 45 }
})
console.log(`   Found ${activeUsers.length} premium users aged 25-45`)

const highRatedUsers = await typedCollection.find({
  rating: { $gte: 4.0 },
  'stats.loginCount': { $gt: 10 }
})
console.log(`   Found ${highRatedUsers.length} high-rated active users`)

// Complex queries
const complexQuery = await typedCollection.find({
  $and: [
    { age: { $gte: 30 } },
    { rating: { $gte: 4.0 } },
    { 'location.country': { $in: ['USA', 'Canada', 'UK'] } }
  ]
})
console.log(`   Found ${complexQuery.length} users matching complex criteria`)

// 5. Demonstrate type-safe updates
console.log('\n🔄 Step 5: Demonstrating type-safe update operations...')

// Atomic updates
const updateResult1 = await typedCollection.updateAtomic({
  filter: { age: { $gte: 30 } },
  update: {
    $set: { 'features.premiumFeatures': true },
    $inc: { 'stats.loginCount': 1 },
    $addToSet: { tags: 'senior' }
  },
  options: { multi: true }
})
console.log(`   Updated ${updateResult1.modifiedCount} senior users`)

// Bulk updates
const bulkResults = await typedCollection.updateBulk({
  operations: [
    {
      filter: { rating: { $gte: 4.5 } },
      update: { $addToSet: { tags: 'top-rated' } },
      options: { multi: true }
    },
    {
      filter: { 'features.betaAccess': false },
      update: { $set: { 'features.betaAccess': true } },
      options: { multi: true }
    }
  ]
})
console.log(`   Bulk operation 1: ${bulkResults[0].modifiedCount} top-rated users tagged`)
console.log(`   Bulk operation 2: ${bulkResults[1].modifiedCount} users given beta access`)

// 6. Performance comparison
console.log('\n⚡ Step 6: Performance comparison...')

const performanceQueries = [
  {
    name: 'Simple field query',
    query: { age: { $gte: 30 } }
  },
  {
    name: 'Complex nested query',
    query: {
      $and: [
        { 'profile.settings.notifications': true },
        { rating: { $gte: 4.0 } },
        { 'location.country': 'USA' }
      ]
    }
  },
  {
    name: 'Array field query',
    query: {
      tags: { $in: ['developer', 'senior'] }
    }
  }
]

for (const testQuery of performanceQueries) {
  console.log(`\n   🏃 Testing: ${testQuery.name}`)

  // TypedCollection query
  const startTyped = performance.now()
  const typedResults = await typedCollection.find(testQuery.query)
  const typedTime = performance.now() - startTyped

  console.log(`     TypedCollection: ${typedResults.length} results in ${typedTime.toFixed(2)}ms`)
}

console.log('\n✅ TypedCollection demonstration completed!')

// ============================================================================
// PART 3: LEGACY PERFORMANCE BENCHMARKS
// ============================================================================

console.log('\n' + '='.repeat(70))
console.log('📊 PART 3: LEGACY PERFORMANCE BENCHMARKS')
console.log('='.repeat(70))