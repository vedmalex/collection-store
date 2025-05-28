// src/query-ast/benchmark/queries.ts
// Extended definitions for diverse benchmark queries

// --- Basic Queries ---

export const baselineQuery = {
  name: 'test',
  age: { $gt: 30 },
  tags: { $in: ['a', 'b', 'c'] },
  nested: {
    value: { $ne: null },
  },
  $or: [{ status: 'active' }, { score: { $gte: 100 } }],
}

export const arrayQuery = {
  items: { $size: 3 },
  values: { $all: [10, 20] },
  scores: { $elemMatch: { $gte: 95 } },
}

export const bitwiseQuery = {
  flags: { $bitsAllSet: 0b101 }, // 5
  mask: { $bitsAnySet: [1, 3] }, // bits 1 and 3
  counter: { $bitsAllClear: 2 }, // bit 1 must be clear in counter field
}

export const evaluationQuery = {
  counter: { $mod: [4, 1] },
  name: { $regex: '^test', $options: 'i' },
}

// --- Extended Queries for More Diversity ---

export const complexLogicalQuery = {
  $and: [
    { age: { $gte: 25, $lte: 45 } },
    {
      $or: [
        { category: 'premium' },
        { rating: { $gte: 4.0 } }
      ]
    }
  ],
  status: { $ne: 'suspended' },
  'profile.settings.notifications': { $ne: false }
}

export const deepNestedQuery = {
  'nested.deep.level': { $gt: 5 },
  'nested.deep.active': true,
  'profile.settings.theme': { $in: ['dark', 'auto'] },
  'location.coordinates.lat': { $gte: 0 },
  'metadata.version': { $ne: 1 }
}

export const textSearchQuery = {
  $or: [
    { 'profile.bio': { $regex: 'developer', $options: 'i' } },
    { email: { $regex: '\\.com$' } },
    { 'location.city': { $regex: '^New' } }
  ],
  'profile.preferences': { $in: ['email', 'push'] }
}

export const numericRangeQuery = {
  rating: { $gte: 3.5, $lte: 4.8 },
  'stats.loginCount': { $gt: 50 },
  'stats.totalSpent': { $gte: 100.0 },
  score: { $mod: [10, 0] }
}

export const arrayOperationsQuery = {
  tags: { $all: ['developer', 'senior'] },
  permissions: { $size: 3 },
  'metadata.tags': { $nin: ['deprecated', 'legacy'] },
  values: { $elemMatch: { $gte: 50, $lte: 80 } }
}

export const dateTimeQuery = {
  'metadata.created': { $gte: new Date('2022-01-01') },
  'stats.lastActive': { $gte: new Date('2023-01-01') }, // Changed to 2023 for more matches
  'metadata.updated': { $ne: null }
}

export const typeCheckQuery = {
  email: { $type: 'string' },
  rating: { $type: 'number' },
  'profile.bio': { $type: ['string', 'null'] },
  'nested.arr': { $type: 'array' },
  'profile.settings': { $type: 'object' }
}

export const existenceQuery = {
  'profile.bio': { $exists: true },
  'features.betaAccess': { $exists: true },
  'nonExistentField': { $exists: false },
  'profile.settings.notifications': true
}

export const advancedBitwiseQuery = {
  flags: { $bitsAllSet: [0, 2, 4] }, // Bits 0, 2, 4 must be set
  mask: { $bitsAnySet: 15 }, // Any of first 4 bits set (0b1111)
  'features.maxProjects': { $bitsAllClear: [6, 7] } // Bits 6, 7 must be clear
}

export const regexVariationsQuery = {
  name: /^(test|demo)/i,
  email: { $regex: '@(gmail|yahoo)\\.com$' },
  'location.country': { $regex: '^(USA|Canada)$', $options: 'i' }
}

export const whereClauseQuery = {
  $where: function(this: any) {
    return this.age > 30 && this.rating >= 4.0 && this.stats.loginCount > 100
  }
}

export const mixedComplexQuery = {
  $and: [
    { category: { $in: ['premium', 'standard'] } },
    { age: { $gte: 25 } },
    {
      $or: [
        { 'features.premiumFeatures': true },
        { rating: { $gte: 4.5 } }
      ]
    }
  ],
  tags: { $all: ['developer'] },
  'profile.settings.language': { $ne: 'en' },
  flags: { $bitsAnySet: 7 } // 0b111
}

export const performanceStressQuery = {
  $or: [
    {
      $and: [
        { age: { $gte: 20, $lte: 60 } },
        { rating: { $gte: 2.0, $lte: 5.0 } },
        { 'stats.loginCount': { $gt: 10 } }
      ]
    },
    {
      $and: [
        { category: { $in: ['premium', 'standard', 'basic'] } },
        { status: { $nin: ['suspended'] } },
        { 'features.apiAccess': true }
      ]
    },
    {
      $and: [
        { 'location.country': { $regex: '^(USA|Russia|Germany)$' } },
        { 'profile.preferences': { $all: ['email'] } },
        { 'metadata.version': { $gte: 2 } }
      ]
    }
  ],
  'nested.deep.active': true
}

// New simpler queries for better compatibility
export const simpleFieldQuery = {
  category: 'premium',
  status: 'active',
  age: { $gte: 30 },
  rating: { $gte: 4.0 }
}

export const comparisonQuery = {
  age: { $gte: 25, $lte: 55 },
  score: { $gt: 80, $lt: 150 },
  rating: { $ne: 3.0 },
  'stats.loginCount': { $gte: 10 }
}

export const stringOperationsQuery = {
  name: { $regex: '^(test|user)', $options: 'i' },
  email: { $regex: '@gmail\\.com$' },
  'location.country': { $in: ['USA', 'Russia', 'Germany'] },
  category: { $nin: ['trial'] }
}

// --- Query Collections ---

export const allQueries = {
  // Original queries
  baseline: baselineQuery,
  array: arrayQuery,
  bitwise: bitwiseQuery,
  evaluation: evaluationQuery,

  // Extended queries
  complexLogical: complexLogicalQuery,
  deepNested: deepNestedQuery,
  textSearch: textSearchQuery,
  numericRange: numericRangeQuery,
  arrayOperations: arrayOperationsQuery,
  dateTime: dateTimeQuery,
  typeCheck: typeCheckQuery,
  existence: existenceQuery,
  advancedBitwise: advancedBitwiseQuery,
  regexVariations: regexVariationsQuery,
  whereClause: whereClauseQuery,
  mixedComplex: mixedComplexQuery,
  performanceStress: performanceStressQuery,

  // New simple queries
  simpleField: simpleFieldQuery,
  comparison: comparisonQuery,
  stringOperations: stringOperationsQuery
}

// Query categories for organized testing
export const queryCategories = {
  basic: {
    baseline: baselineQuery,
    array: arrayQuery,
    bitwise: bitwiseQuery,
    evaluation: evaluationQuery
  },

  logical: {
    complexLogical: complexLogicalQuery,
    mixedComplex: mixedComplexQuery,
    performanceStress: performanceStressQuery
  },

  fieldAccess: {
    deepNested: deepNestedQuery,
    textSearch: textSearchQuery,
    numericRange: numericRangeQuery,
    simpleField: simpleFieldQuery,
    comparison: comparisonQuery
  },

  arrayOps: {
    arrayOperations: arrayOperationsQuery,
    array: arrayQuery
  },

  specialized: {
    dateTime: dateTimeQuery,
    typeCheck: typeCheckQuery,
    existence: existenceQuery,
    advancedBitwise: advancedBitwiseQuery,
    regexVariations: regexVariationsQuery,
    whereClause: whereClauseQuery,
    stringOperations: stringOperationsQuery
  }
}

export type QueryKey = keyof typeof allQueries
export type QueryCategory = keyof typeof queryCategories

// Helper function to get queries by category
export function getQueriesByCategory(category: QueryCategory) {
  return queryCategories[category]
}

// Helper function to get all query names
export function getAllQueryNames(): QueryKey[] {
  return Object.keys(allQueries) as QueryKey[]
}

// Helper function to get basic queries (for quick testing)
export function getBasicQueries() {
  return queryCategories.basic
}
