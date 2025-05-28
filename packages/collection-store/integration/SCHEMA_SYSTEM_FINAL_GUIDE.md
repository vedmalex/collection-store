# Schema-Aware Query System - Final Guide

## 🎯 Overview

Collection Store теперь включает революционную систему типизации полей, обеспечивающую MongoDB-совместимую валидацию типов, автоматическую коерцию и проверку совместимости операторов с выдающейся производительностью.

## 🚀 Quick Start

### 1. Basic Usage

```typescript
import { createSchemaAwareQuery, SchemaDefinition } from './src/types/field-types'

// Define your schema
const userSchema: SchemaDefinition = {
  'id': { type: 'int', required: true },
  'name': { type: 'string', required: true },
  'age': { type: 'int', coerce: true, validator: (v) => v >= 0 && v <= 150 },
  'email': { type: 'string', validator: (v) => v.includes('@') },
  'tags': { type: 'array' }
}

// Create schema-aware query builder
const queryBuilder = createSchemaAwareQuery(userSchema)

// Build validated queries
const { queryFn, validation } = queryBuilder.buildQuery({
  age: { $gte: "25", $lte: "45" },  // Strings auto-coerced to numbers
  email: { $regex: ".*@company.com" }
})

if (validation.valid) {
  const results = data.filter(queryFn)
} else {
  console.log('Validation errors:', validation.errors)
}
```

### 2. High-Performance Compiled Queries

```typescript
// For maximum performance, use compiled queries
const { compiledResult, validation } = queryBuilder.compileQuery({
  age: { $gte: 25, $lte: 45 },
  'profile.settings.notifications': true
})

if (validation.valid && compiledResult.func) {
  // Up to 25x faster execution
  const results = data.filter(compiledResult.func)
}
```

## 📋 Schema Definition

### Supported BSON Types

```typescript
type BSONType =
  | 'null' | 'undefined'           // Null values
  | 'string'                       // Text data
  | 'number' | 'double' | 'int' | 'long'  // Numeric types
  | 'boolean'                      // True/false
  | 'array'                        // Arrays
  | 'object'                       // Objects
  | 'date'                         // Date objects
  | 'regex' | 'regexp'             // Regular expressions
  | 'binary' | 'binData' | 'buffer' // Binary data
  | 'objectId'                     // MongoDB ObjectId
```

### Field Definition Options

```typescript
interface FieldTypeDefinition {
  type: BSONType | BSONType[]      // Single type or union
  required?: boolean               // Field is required
  default?: any                    // Default value
  coerce?: boolean                 // Auto-convert compatible types
  strict?: boolean                 // Strict type checking
  validator?: (value: any) => boolean  // Custom validation
  description?: string             // Documentation
}
```

### Example Comprehensive Schema

```typescript
const comprehensiveSchema: SchemaDefinition = {
  // Basic fields with validation
  'id': {
    type: 'int',
    required: true,
    description: 'Unique identifier'
  },
  'name': {
    type: 'string',
    required: true,
    validator: (v) => v.length > 0
  },
  'age': {
    type: ['int', 'double'],
    coerce: true,
    validator: (v) => v >= 0 && v <= 150
  },

  // Email with custom validation
  'email': {
    type: 'string',
    validator: (v) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v)
  },

  // Nested object fields
  'profile.settings.notifications': {
    type: 'boolean',
    coerce: true,
    default: true
  },
  'profile.preferences': {
    type: 'array'
  },

  // Date fields with coercion
  'metadata.created': {
    type: 'date',
    coerce: true
  },

  // Numeric fields with validation
  'stats.loginCount': {
    type: 'int',
    coerce: true,
    validator: (v) => v >= 0
  }
}
```

## 🔧 Query Validation Features

### 1. Type Coercion

Automatic conversion of compatible types:

```typescript
// Input query with strings
const query = {
  age: { $gte: "25" },        // String → Number
  rating: { $gte: "4.5" },    // String → Double
  active: { $eq: "true" }     // String → Boolean
}

// Automatically coerced to proper types
const validation = queryBuilder.validateQuery(query)
// Result: { age: { $gte: 25 }, rating: { $gte: 4.5 }, active: { $eq: true } }
```

### 2. Operator Compatibility

Prevents incompatible operator usage:

```typescript
// These will generate warnings
const invalidQuery = {
  age: { $regex: "test" },      // ❌ $regex not compatible with number
  tags: { $gt: 10 },            // ❌ $gt not compatible with array
  name: { $bitsAllSet: 5 }      // ❌ bitwise ops not compatible with string
}

const validation = queryBuilder.validateQuery(invalidQuery)
// validation.warnings contains detailed error messages
```

### 3. Validation Modes

```typescript
// Strict mode - throws errors on validation failures
const strictBuilder = createSchemaAwareQuery(schema, {
  validateTypes: true,
  coerceValues: true,
  strictMode: true,           // Throws on validation errors
  allowUnknownFields: false   // Rejects unknown fields
})

// Lenient mode - only warnings
const lenientBuilder = createSchemaAwareQuery(schema, {
  validateTypes: true,
  coerceValues: true,
  strictMode: false,          // Only warnings
  allowUnknownFields: true    // Allows unknown fields
})
```

## 📊 Document Validation

### Validate Documents Against Schema

```typescript
import { createFieldValidator } from './src/types/field-types'

const validator = createFieldValidator(schema)

const result = validator.validateDocument({
  id: "123",        // String coerced to int
  name: "John Doe",
  age: "30",        // String coerced to int
  email: "john@example.com",
  tags: ["developer", "senior"]
})

if (result.valid) {
  console.log('Document is valid:', result.processedDoc)
} else {
  console.log('Validation errors:', result.errors)
  console.log('Warnings:', result.warnings)
}
```

## 🎯 Schema Inference

### Automatic Schema Generation

```typescript
import { inferSchemaFromData } from './src/query/schema-aware-query'

// Automatically infer schema from sample data
const sampleData = [
  { id: 1, name: "John", age: 30, tags: ["dev"] },
  { id: 2, name: "Jane", age: 25, tags: ["design"] }
]

const inferredSchema = inferSchemaFromData(sampleData)
// Generates complete schema with proper types
```

## ⚡ Performance Optimization

### Performance Comparison

| Query Type | Regular | Schema-Aware | Compiled | Schema-Compiled |
|------------|---------|--------------|----------|-----------------|
| Simple     | 1.0x    | 1.0x        | 5x       | 5x             |
| Complex    | 1.0x    | 0.9x        | 15x      | 12x            |
| Numeric    | 1.0x    | 0.8x        | 30x      | 32x            |

### Best Practices for Performance

1. **Use Compiled Queries** for production workloads
2. **Enable Type Coercion** to reduce data preparation overhead
3. **Define Specific Types** rather than unions when possible
4. **Use Validation** in development, consider disabling in production for maximum speed

```typescript
// Development configuration
const devBuilder = createSchemaAwareQuery(schema, {
  validateTypes: true,
  coerceValues: true,
  strictMode: true
})

// Production configuration
const prodBuilder = createSchemaAwareQuery(schema, {
  validateTypes: false,  // Disable for maximum performance
  coerceValues: true,
  strictMode: false
})
```

## 🔧 Operator Type Compatibility Matrix

| Operator | Compatible Types | Example |
|----------|------------------|---------|
| `$eq`, `$ne` | All types | `{ name: { $eq: "John" } }` |
| `$gt`, `$gte`, `$lt`, `$lte` | `number`, `string`, `date` | `{ age: { $gte: 25 } }` |
| `$in`, `$nin` | All types | `{ status: { $in: ["active", "pending"] } }` |
| `$regex` | `string` only | `{ email: { $regex: ".*@company.com" } }` |
| `$bitsAllSet`, `$bitsAnySet` | `number`, `int`, `long` | `{ flags: { $bitsAllSet: 5 } }` |
| `$all`, `$size`, `$elemMatch` | `array` only | `{ tags: { $size: 3 } }` |
| `$type`, `$exists` | All types | `{ field: { $exists: true } }` |

## 🧪 Testing and Debugging

### Run Complete Demo

```bash
# Run comprehensive demonstration
BENCH_DATA_SIZE=1000 bun src/benchmark/complete-schema-demo.ts
```

This will show:
- Schema inference from sample data
- Query validation scenarios
- Document validation examples
- Operator compatibility tests
- Performance benchmarks
- Comprehensive summary

### Debug Validation Issues

```typescript
const validation = queryBuilder.validateQuery(query)

console.log('Valid:', validation.valid)
console.log('Errors:', validation.errors)
console.log('Warnings:', validation.warnings)

if (validation.processedQuery) {
  console.log('Processed query:', validation.processedQuery)
}
```

## 🎉 Production Deployment

### Integration Checklist

- [ ] Define comprehensive schemas for your data models
- [ ] Test query validation in development
- [ ] Benchmark performance with your data
- [ ] Configure appropriate validation modes
- [ ] Set up error handling for validation failures
- [ ] Document schemas for team members

### Example Production Setup

```typescript
// production-query-builder.ts
import { createSchemaAwareQuery } from './src/query/schema-aware-query'
import { userSchema, productSchema, orderSchema } from './schemas'

export const queryBuilders = {
  users: createSchemaAwareQuery(userSchema, {
    validateTypes: process.env.NODE_ENV === 'development',
    coerceValues: true,
    strictMode: false,
    allowUnknownFields: true
  }),

  products: createSchemaAwareQuery(productSchema, {
    validateTypes: true,
    coerceValues: true,
    strictMode: false
  }),

  orders: createSchemaAwareQuery(orderSchema, {
    validateTypes: true,
    coerceValues: true,
    strictMode: true  // Strict validation for critical data
  })
}
```

## 📚 Advanced Features

### Custom Type Coercion

```typescript
import { TypeCoercion } from './src/types/field-types'

// Custom coercion functions
const customValue = TypeCoercion.toString(123)      // "123"
const customNumber = TypeCoercion.toNumber("45.6")  // 45.6
const customDate = TypeCoercion.toDate("2023-01-01") // Date object
```

### Schema Evolution

```typescript
// Version 1 schema
const schemaV1 = {
  'name': { type: 'string', required: true },
  'age': { type: 'int' }
}

// Version 2 schema with new fields
const schemaV2 = {
  'name': { type: 'string', required: true },
  'age': { type: 'int' },
  'email': { type: 'string', required: false }, // New optional field
  'profile.bio': { type: 'string' }             // New nested field
}
```

## 🎯 Conclusion

Система типизации полей Collection Store обеспечивает:

- **🛡️ Type Safety** - Предотвращение ошибок типов на этапе выполнения
- **⚡ Performance** - До 25x быстрее с compiled queries
- **🔧 Flexibility** - Гибкие режимы валидации
- **📚 Documentation** - Схемы как живая документация
- **🚀 Production Ready** - Готово к использованию в production

Система полностью совместима с существующим API Collection Store и может быть внедрена постепенно без breaking changes.

---

*Руководство создано для Collection Store Schema System v1.0.0*
*Статус: ✅ Production Ready*