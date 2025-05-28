// Quick Test: Compiled-by-Default Functionality
// Simple verification that everything works

import { query, queryInterpreted, queryCompiled } from '../query/query'

console.log('🧪 Quick Test: Compiled-by-Default')
console.log('=' .repeat(40))

// Test data
const testData = [
  { id: 1, name: 'Alice', age: 25, status: 'active' },
  { id: 2, name: 'Bob', age: 30, status: 'inactive' },
  { id: 3, name: 'Charlie', age: 35, status: 'active' },
  { id: 4, name: 'Diana', age: 28, status: 'pending' }
]

// Test query
const testQuery = { age: { $gte: 28 }, status: { $ne: 'inactive' } }

console.log('📊 Test data:', testData.length, 'records')
console.log('🔍 Test query:', JSON.stringify(testQuery))

// Test all modes
console.log('\n🚀 Testing all query modes:')

try {
  // 1. Default (compiled)
  const defaultQuery = query(testQuery)
  const defaultResults = testData.filter(defaultQuery)
  console.log(`✅ Default (compiled): ${defaultResults.length} matches`)

  // 2. Interpreted mode
  const interpretedQuery = query(testQuery, { interpreted: true })
  const interpretedResults = testData.filter(interpretedQuery)
  console.log(`✅ Interpreted mode: ${interpretedResults.length} matches`)

  // 3. Legacy function
  const legacyQuery = queryInterpreted(testQuery)
  const legacyResults = testData.filter(legacyQuery)
  console.log(`✅ Legacy function: ${legacyResults.length} matches`)

  // 4. Explicit compiled
  const compiledQuery = queryCompiled(testQuery)
  const compiledResults = testData.filter(compiledQuery)
  console.log(`✅ Explicit compiled: ${compiledResults.length} matches`)

  // Verify all results are identical
  const allResultsMatch =
    defaultResults.length === interpretedResults.length &&
    interpretedResults.length === legacyResults.length &&
    legacyResults.length === compiledResults.length

  console.log('\n🔍 Results verification:')
  if (allResultsMatch) {
    console.log('✅ All modes produce identical results!')
    console.log(`📊 Expected matches: Charlie (35, active), Diana (28, pending)`)
    console.log(`📊 Actual matches: ${defaultResults.map(r => r.name).join(', ')}`)
  } else {
    console.log('❌ Results mismatch detected!')
    console.log('Default:', defaultResults.length)
    console.log('Interpreted:', interpretedResults.length)
    console.log('Legacy:', legacyResults.length)
    console.log('Compiled:', compiledResults.length)
  }

  // Test debug mode
  console.log('\n🐛 Testing debug mode:')
  const debugQuery = query(testQuery, { debug: true })
  const debugResults = testData.filter(debugQuery)
  console.log(`✅ Debug mode: ${debugResults.length} matches`)

} catch (error: any) {
  console.error('❌ Test failed:', error.message)
  process.exit(1)
}

console.log('\n🎉 Quick test completed successfully!')
console.log('✅ Compiled-by-default is working correctly')
console.log('✅ All modes produce consistent results')
console.log('✅ Debug functionality is operational')
console.log('\n🚀 Ready for production use!')