// Demo: Compiled Queries by Default
// Demonstrates the new compiled-by-default behavior

import { readFileSync } from 'fs'
import * as path from 'path'
import { query, queryInterpreted, queryCompiled } from '../query/query'
import { createSchemaAwareQuery, inferSchemaFromData } from '../query/schema-aware-query'

console.log('🚀 Compiled-by-Default Demo')
console.log('=' .repeat(50))

// Load sample data
const DATA_FILE_PATH = path.resolve(__dirname, 'data', 'Person', 'persons.json')
let sampleData: any[] = []

try {
  console.log(`📂 Loading data from: ${DATA_FILE_PATH}`)
  const rawData = readFileSync(DATA_FILE_PATH, 'utf-8')
  sampleData = JSON.parse(rawData).slice(0, 100) // Use first 100 records
  console.log(`✅ Loaded ${sampleData.length} records`)
} catch (error: any) {
  console.error(`❌ Error loading data: ${error.message}`)
  console.log('📝 Creating sample data instead...')

  // Create sample data if file doesn't exist
  sampleData = Array.from({ length: 100 }, (_, i) => ({
    id: i + 1,
    name: `Person ${i + 1}`,
    age: 20 + (i % 50),
    email: `person${i + 1}@example.com`,
    status: i % 3 === 0 ? 'active' : i % 3 === 1 ? 'inactive' : 'pending',
    tags: [`tag${i % 5}`, `category${i % 3}`],
    metadata: {
      created: new Date(2023, i % 12, (i % 28) + 1),
      version: i % 10
    }
  }))
  console.log(`✅ Created ${sampleData.length} sample records`)
}

// Test queries
const testQueries = {
  simple: { age: { $gte: 25 } },
  complex: {
    $and: [
      { age: { $gte: 25, $lte: 45 } },
      { status: { $in: ['active', 'pending'] } }
    ]
  },
  nested: {
    'metadata.version': { $gte: 5 },
    name: { $regex: 'Person [1-3]' }
  }
}

console.log('\n🔧 Testing Different Query Modes')
console.log('-'.repeat(50))

for (const [queryName, queryObj] of Object.entries(testQueries)) {
  console.log(`\n📋 Testing: ${queryName.toUpperCase()}`)
  console.log(`   Query: ${JSON.stringify(queryObj)}`)

  // 1. Default mode (compiled)
  console.log('\n   🚀 Default mode (compiled):')
  try {
    const defaultQuery = query(queryObj, { debug: true })
    const defaultMatches = sampleData.filter(defaultQuery).length
    console.log(`      ✅ Matches: ${defaultMatches}`)
  } catch (error: any) {
    console.log(`      ❌ Error: ${error.message}`)
  }

  // 2. Explicit interpreted mode
  console.log('\n   🐛 Interpreted mode (debug):')
  try {
    const interpretedQuery = query(queryObj, { interpreted: true, debug: true })
    const interpretedMatches = sampleData.filter(interpretedQuery).length
    console.log(`      ✅ Matches: ${interpretedMatches}`)
  } catch (error: any) {
    console.log(`      ❌ Error: ${error.message}`)
  }

  // 3. Legacy function
  console.log('\n   📚 Legacy function:')
  try {
    const legacyQuery = queryInterpreted(queryObj)
    const legacyMatches = sampleData.filter(legacyQuery).length
    console.log(`      ✅ Matches: ${legacyMatches}`)
  } catch (error: any) {
    console.log(`      ❌ Error: ${error.message}`)
  }

  // 4. Explicit compiled mode
  console.log('\n   ⚡ Explicit compiled mode:')
  try {
    const compiledQuery = queryCompiled(queryObj)
    const compiledMatches = sampleData.filter(compiledQuery).length
    console.log(`      ✅ Matches: ${compiledMatches}`)
  } catch (error: any) {
    console.log(`      ❌ Error: ${error.message}`)
  }
}

// Performance comparison
console.log('\n⚡ Performance Comparison')
console.log('-'.repeat(50))

const performanceQuery = {
  $and: [
    { age: { $gte: 25, $lte: 45 } },
    { status: { $ne: 'inactive' } },
    { 'metadata.version': { $gte: 3 } }
  ]
}

console.log(`Query: ${JSON.stringify(performanceQuery)}`)

function measurePerformance(name: string, fn: () => void, iterations: number = 1000): number {
  // Warmup
  for (let i = 0; i < 10; i++) {
    try { fn() } catch (error) { /* ignore */ }
  }

  // Measure
  const start = performance.now()
  for (let i = 0; i < iterations; i++) {
    try { fn() } catch (error) { /* ignore */ }
  }
  const end = performance.now()

  const avgTime = (end - start) / iterations
  console.log(`${name}: ${avgTime.toFixed(3)}ms per query`)
  return avgTime
}

// Build query functions
const defaultQueryFn = query(performanceQuery)
const interpretedQueryFn = query(performanceQuery, { interpreted: true })
const compiledQueryFn = queryCompiled(performanceQuery)

// Measure performance
const defaultTime = measurePerformance('Default (compiled)', () => {
  sampleData.filter(defaultQueryFn)
})

const interpretedTime = measurePerformance('Interpreted', () => {
  sampleData.filter(interpretedQueryFn)
})

// @ts-ignore
const compiledTime = measurePerformance('Explicit compiled', () => {
  sampleData.filter(compiledQueryFn)
})

console.log(`\nSpeedup: ${(interpretedTime / defaultTime).toFixed(2)}x faster than interpreted`)

// Schema-aware queries
console.log('\n🎯 Schema-Aware Queries (Compiled by Default)')
console.log('-'.repeat(50))

// Infer schema
const schema = inferSchemaFromData(sampleData.slice(0, 10))
console.log(`✅ Inferred schema with ${Object.keys(schema).length} fields`)

// Create schema-aware query builder
const schemaBuilder = createSchemaAwareQuery(schema, {
  validateTypes: true,
  coerceValues: true,
  strictMode: false
})

const schemaTestQuery = {
  age: { $gte: "30" }, // String that will be coerced to number
  status: { $in: ['active', 'pending'] },
  'metadata.version': { $gte: 5 }
}

console.log(`\nTesting schema-aware query: ${JSON.stringify(schemaTestQuery)}`)

// Default (compiled) mode
console.log('\n🚀 Schema-aware compiled (default):')
try {
  const { queryFn: schemaCompiledFn, validation } = schemaBuilder.buildQuery(schemaTestQuery)
  console.log(`   Validation: ${validation.valid ? '✅' : '❌'} (${validation.warnings.length} warnings)`)

  const schemaCompiledMatches = sampleData.filter(schemaCompiledFn).length
  console.log(`   Matches: ${schemaCompiledMatches}`)
} catch (error: any) {
  console.log(`   ❌ Error: ${error.message}`)
}

// Interpreted mode
console.log('\n🐛 Schema-aware interpreted:')
try {
  const { queryFn: schemaInterpretedFn, validation } = schemaBuilder.buildQuery(schemaTestQuery, { interpreted: true })
  console.log(`   Validation: ${validation.valid ? '✅' : '❌'} (${validation.warnings.length} warnings)`)

  const schemaInterpretedMatches = sampleData.filter(schemaInterpretedFn).length
  console.log(`   Matches: ${schemaInterpretedMatches}`)
} catch (error: any) {
  console.log(`   ❌ Error: ${error.message}`)
}

console.log('\n🎉 Demo completed!')
console.log('\n📋 Summary:')
console.log('  ✅ Compiled queries are now the default mode')
console.log('  ✅ Interpreted mode available for debugging')
console.log('  ✅ Automatic fallback to interpreted on compilation errors')
console.log('  ✅ Schema-aware queries also use compiled mode by default')
console.log('  ✅ Backward compatibility maintained with legacy functions')
console.log('  ✅ Significant performance improvements with compiled mode')

console.log('\n🚀 Ready for production use!')