import { readFileSync } from 'fs'
import * as path from 'path'
import { build_query_new } from '../query/build_query'
import { compileQuery as compileQuery_pure } from '../query/compile_query'
import {
  allQueries,
  queryCategories,
  QueryCategory,
  getQueriesByCategory,
  getBasicQueries
} from './queries'

// Configuration
const DATA_SIZE = process.env.BENCH_DATA_SIZE || '1000'
const ITERATIONS = parseInt(process.env.BENCH_ITERATIONS || '10')
const WARMUP_ITERATIONS = parseInt(process.env.BENCH_WARMUP || '3')
const TEST_CATEGORY = process.env.BENCH_CATEGORY as QueryCategory || null
const QUICK_MODE = process.env.BENCH_QUICK === 'true'

// Load data
const DATA_FILE_PATH = path.resolve(__dirname, 'data', `benchmark_data_${DATA_SIZE}.json`)

console.log('🚀 Enhanced Performance Test for Query Systems')
console.log('=' .repeat(80))

// Function to convert string dates to Date objects
function convertDates(obj: any): any {
  if (obj === null || obj === undefined) return obj

  if (typeof obj === 'string') {
    // Check if it's an ISO date string
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

let benchmarkData: any[] = []
try {
  console.log(`📂 Loading data from: ${DATA_FILE_PATH}`)
  const rawData = readFileSync(DATA_FILE_PATH, 'utf-8')
  const parsedData = JSON.parse(rawData)

  // Convert string dates to Date objects
  benchmarkData = parsedData.map(convertDates)
  console.log(`✅ Loaded ${benchmarkData.length} records (dates converted)`)
} catch (error: any) {
  console.error(`❌ Error loading data:`, error.message)
  console.error(`💡 Generate data with: bun src/benchmark/generate_data.ts`)
  process.exit(1)
}

// Determine which queries to test
let queriesToTest: { [key: string]: any } = {}

if (QUICK_MODE) {
  console.log('⚡ Quick mode: Testing basic queries only')
  queriesToTest = getBasicQueries()
} else if (TEST_CATEGORY) {
  console.log(`📋 Testing category: ${TEST_CATEGORY}`)
  queriesToTest = getQueriesByCategory(TEST_CATEGORY)
} else {
  console.log('🔍 Testing all queries')
  queriesToTest = allQueries
}

console.log(`🎯 Will test ${Object.keys(queriesToTest).length} queries`)

// Compile functions
type CompiledFunctions = {
  [key: string]: {
    interpreted: (data: any) => boolean
    compiled: (data: any) => boolean
  }
}

const compiledFuncs = {} as CompiledFunctions

console.log('\n🔧 Compiling query functions...')
let compilationErrors = 0

for (const key in queriesToTest) {
  const query = queriesToTest[key]

  try {
    const interpretedFn = build_query_new(query)
    const compiledResult = compileQuery_pure(query)

    if (!compiledResult.func) {
      throw new Error(`compileQuery_pure failed for ${key}`)
    }

    compiledFuncs[key] = {
      interpreted: interpretedFn,
      compiled: compiledResult.func
    }

    console.log(`  ✅ ${key}: Compiled successfully`)
  } catch (error: any) {
    console.error(`  ❌ ${key}: Compilation failed -`, error.message)
    compilationErrors++
  }
}

if (compilationErrors > 0) {
  console.error(`\n❌ ${compilationErrors} queries failed to compile. Continuing with successful ones...`)
}

if (Object.keys(compiledFuncs).length === 0) {
  console.error('❌ No queries compiled successfully. Exiting.')
  process.exit(1)
}

// Verification
console.log('\n🔍 Verifying results consistency...')
const verificationResults: { [key: string]: { interpreted: number, compiled: number, errors: number } } = {}

for (const key in compiledFuncs) {
  const funcs = compiledFuncs[key]
  let counts = { interpreted: 0, compiled: 0, errors: 0 }

  for (const record of benchmarkData) {
    try {
      const interpretedResult = funcs.interpreted(record)
      const compiledResult = funcs.compiled(record)

      if (interpretedResult) counts.interpreted++
      if (compiledResult) counts.compiled++

      if (interpretedResult !== compiledResult) {
        console.error(`  ❌ ${key}: Mismatch on record ID ${record.id}`)
        counts.errors++
        if (counts.errors >= 5) {
          console.error(`  ⚠️  ${key}: Too many errors, stopping verification for this query`)
          break
        }
      }
    } catch (error: any) {
      counts.errors++
      if (counts.errors === 1) {
        console.error(`  ⚠️  ${key}: Runtime error - ${error.message}`)
      }
    }
  }

  verificationResults[key] = counts

  if (counts.errors === 0) {
    console.log(`  ✅ ${key}: ${counts.interpreted} matches (identical results)`)
  } else {
    console.log(`  ⚠️  ${key}: ${counts.interpreted} matches (${counts.errors} errors)`)
  }
}

// Performance testing function
function measurePerformance(name: string, fn: () => void, iterations: number = ITERATIONS): number {
  // Warmup
  for (let i = 0; i < WARMUP_ITERATIONS; i++) {
    try {
      fn()
    } catch (error) {
      // Ignore warmup errors
    }
  }

  // Actual measurement
  const start = performance.now()
  for (let i = 0; i < iterations; i++) {
    try {
      fn()
    } catch (error) {
      // Count errors but continue
    }
  }
  const end = performance.now()

  return (end - start) / iterations // Average time per iteration
}

// Performance tests
console.log('\n⚡ Performance Testing')
console.log('=' .repeat(80))

const results: { [key: string]: { interpreted: number, compiled: number, speedup: number, category?: string } } = {}

// Group queries by category for better organization
const categorizedQueries: { [category: string]: string[] } = {}

for (const key in compiledFuncs) {
  let category = 'other'

  // Find which category this query belongs to
  for (const [catName, catQueries] of Object.entries(queryCategories)) {
    if (key in catQueries) {
      category = catName
      break
    }
  }

  if (!categorizedQueries[category]) {
    categorizedQueries[category] = []
  }
  categorizedQueries[category].push(key)
}

for (const [category, queryKeys] of Object.entries(categorizedQueries)) {
  console.log(`\n📂 Category: ${category.toUpperCase()}`)
  console.log('-'.repeat(60))

  for (const key of queryKeys) {
    const funcs = compiledFuncs[key]
    const verification = verificationResults[key]
    const matchCount = verification.interpreted

    console.log(`\n📋 Testing ${key.toUpperCase()} query (${matchCount} matches from ${benchmarkData.length} records)`)

    // Show query for reference (truncated if too long)
    const queryStr = JSON.stringify(queriesToTest[key])
    const displayQuery = queryStr.length > 100 ? queryStr.substring(0, 100) + '...' : queryStr
    console.log(`🔍 Query: ${displayQuery}`)

    if (verification.errors > 0) {
      console.log(`⚠️  Warning: ${verification.errors} verification errors detected`)
    }

    // Test interpreted version
    const interpretedTime = measurePerformance(
      `${key} interpreted`,
      () => {
        let count = 0
        for (const record of benchmarkData) {
          try {
            if (funcs.interpreted(record)) count++
          } catch (error) {
            // Count errors but continue
          }
        }
      }
    )

    // Test compiled version
    const compiledTime = measurePerformance(
      `${key} compiled`,
      () => {
        let count = 0
        for (const record of benchmarkData) {
          try {
            if (funcs.compiled(record)) count++
          } catch (error) {
            // Count errors but continue
          }
        }
      }
    )

    const speedup = interpretedTime / compiledTime
    results[key] = { interpreted: interpretedTime, compiled: compiledTime, speedup, category }

    console.log(`  🐌 Interpreted: ${interpretedTime.toFixed(2)} ms/iteration`)
    console.log(`  ⚡ Compiled:    ${compiledTime.toFixed(2)} ms/iteration`)
    console.log(`  🚀 Speedup:     ${speedup.toFixed(2)}x ${speedup > 1 ? '(compiled faster)' : '(interpreted faster)'}`)
  }
}

// Summary
console.log('\n📊 PERFORMANCE SUMMARY')
console.log('=' .repeat(80))
console.log('Query Type'.padEnd(20) + 'Category'.padEnd(15) + 'Interpreted'.padEnd(15) + 'Compiled'.padEnd(15) + 'Speedup'.padEnd(12) + 'Matches')
console.log('-'.repeat(80))

for (const [queryKey, perf] of Object.entries(results)) {
  const verification = verificationResults[queryKey]
  const matchStr = `${verification.interpreted} records`
  const categoryStr = perf.category || 'other'

  console.log(
    queryKey.padEnd(20) +
    categoryStr.padEnd(15) +
    perf.interpreted.toFixed(2).padEnd(15) +
    perf.compiled.toFixed(2).padEnd(15) +
    `${perf.speedup.toFixed(2)}x`.padEnd(12) +
    matchStr
  )
}

console.log('=' .repeat(80))

// Calculate overall statistics
const speedups = Object.values(results).map(r => r.speedup)
const avgSpeedup = speedups.reduce((a, b) => a + b, 0) / speedups.length
const maxSpeedup = Math.max(...speedups)
const minSpeedup = Math.min(...speedups)

// Category statistics
const categoryStats: { [category: string]: { avg: number, count: number } } = {}
for (const [, perf] of Object.entries(results)) {
  const cat = perf.category || 'other'
  if (!categoryStats[cat]) {
    categoryStats[cat] = { avg: 0, count: 0 }
  }
  categoryStats[cat].avg += perf.speedup
  categoryStats[cat].count++
}

for (const cat in categoryStats) {
  categoryStats[cat].avg /= categoryStats[cat].count
}

console.log(`📈 Overall Statistics:`)
console.log(`   Average Speedup: ${avgSpeedup.toFixed(2)}x`)
console.log(`   Maximum Speedup: ${maxSpeedup.toFixed(2)}x`)
console.log(`   Minimum Speedup: ${minSpeedup.toFixed(2)}x`)

console.log(`\n📂 Category Performance:`)
for (const [cat, stats] of Object.entries(categoryStats)) {
  console.log(`   ${cat}: ${stats.avg.toFixed(2)}x average (${stats.count} queries)`)
}

if (avgSpeedup > 1) {
  console.log(`\n🎉 Compiled queries are on average ${avgSpeedup.toFixed(2)}x faster than interpreted queries!`)
} else {
  console.log(`\n⚠️  Interpreted queries are on average ${(1/avgSpeedup).toFixed(2)}x faster than compiled queries.`)
}

console.log(`\n🔧 Test Configuration:`)
console.log(`   📊 Records: ${benchmarkData.length}`)
console.log(`   🔄 Iterations: ${ITERATIONS}`)
console.log(`   🔥 Warmup: ${WARMUP_ITERATIONS}`)
console.log(`   📁 Data Size: ${DATA_SIZE}`)
console.log(`   📋 Queries Tested: ${Object.keys(results).length}`)
console.log(`   🎯 Test Mode: ${QUICK_MODE ? 'Quick' : TEST_CATEGORY ? `Category: ${TEST_CATEGORY}` : 'All queries'}`)

console.log('\n💡 Usage Tips:')
console.log('   🚀 Quick test: BENCH_QUICK=true bun src/benchmark/simple_performance_test.ts')
console.log('   📂 Test category: BENCH_CATEGORY=basic bun src/benchmark/simple_performance_test.ts')
console.log('   📊 Large data: BENCH_DATA_SIZE=100000 bun src/benchmark/simple_performance_test.ts')
console.log('   ⚡ More iterations: BENCH_ITERATIONS=20 bun src/benchmark/simple_performance_test.ts')

console.log('\n✅ Enhanced performance test completed!')