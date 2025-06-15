import Collection from '../core/Collection'
import { List } from '../storage/List'
import AdapterMemory from '../storage/adapters/AdapterMemory'
import { IndexDef } from '../types/IndexDef'

interface Product {
  id: number
  name: string
  category: string
  price: number
  rating: number
  createdAt: Date
}

/**
 * Demo: Unified Index API
 *
 * This demo shows how the new unified IndexDef API simplifies
 * index configuration for both single and composite keys.
 */
export async function unifiedIndexApiDemo() {
  console.log('=== Unified Index API Demo ===\n')

  // Create collection with unified index configuration
  const products = Collection.create<Product>({
    name: 'products_unified',
    id: 'id',
    root: './data/',
    list: new List<Product>(),
    adapter: new AdapterMemory<Product>(),
    indexList: [
      // === SINGLE KEY INDEXES ===

      // Simple single key (ascending by default)
      { key: 'name' },

      // Single key with explicit sort order
      { key: 'price', order: 'asc' },
      { key: 'rating', order: 'desc' },

      // Single key with additional options
      { key: 'category', order: 'asc', sparse: true },

      // === COMPOSITE KEY INDEXES ===

      // Simple composite key (all fields ascending)
      { keys: ['category', 'price'] },

      // Composite key with mixed sort orders
      {
        keys: [
          'category',                           // ascending (default)
          { key: 'price', order: 'desc' },     // descending
          { key: 'rating', order: 'asc' }      // ascending
        ]
      },

      // Composite key with custom separator
      {
        keys: ['category', 'name'],
        separator: '|',
        unique: false
      },

      // Complex composite key
      {
        keys: [
          { key: 'category', order: 'asc' },
          { key: 'rating', order: 'desc' },
          { key: 'createdAt', order: 'desc' }
        ],
        sparse: true
      }
    ] as IndexDef<Product>[]
  })

  console.log('Collection created with unified index configuration:')
  Object.entries(products.indexDefs).forEach(([name, def]) => {
    if (def.keys && def.keys.length > 1) {
      // Composite index
      const fieldsInfo = def.keys.map(field => {
        if (typeof field === 'string') {
          return `${field}:asc`
        } else if (typeof field === 'object' && 'key' in field) {
          return `${field.key}:${field.order || 'asc'}`
        } else {
          return `${field}:asc`
        }
      }).join(', ')
      console.log(`  ${name}: composite [${fieldsInfo}]${def.separator ? ` sep="${def.separator}"` : ''}`)
    } else {
      // Single key index
      const orderInfo = def.order ? ` (${def.order})` : ' (asc)'
      const extraInfo = [
        def.unique ? 'unique' : '',
        def.sparse ? 'sparse' : '',
        def.required ? 'required' : ''
      ].filter(Boolean).join(', ')
      console.log(`  ${name}: single "${def.key}"${orderInfo}${extraInfo ? ` [${extraInfo}]` : ''}`)
    }
  })

  // Add sample data
  const sampleProducts: Product[] = [
    {
      id: 1,
      name: 'iPhone 15',
      category: 'Electronics',
      price: 999,
      rating: 4.8,
      createdAt: new Date('2023-09-15')
    },
    {
      id: 2,
      name: 'MacBook Pro',
      category: 'Electronics',
      price: 2499,
      rating: 4.9,
      createdAt: new Date('2023-10-01')
    },
    {
      id: 3,
      name: 'Coffee Mug',
      category: 'Home',
      price: 15,
      rating: 4.2,
      createdAt: new Date('2023-08-20')
    },
    {
      id: 4,
      name: 'Desk Chair',
      category: 'Home',
      price: 299,
      rating: 4.5,
      createdAt: new Date('2023-09-10')
    }
  ]

  console.log('\nAdding sample products...')
  for (const product of sampleProducts) {
    await products.create(product)
  }
  console.log(`✅ Added ${sampleProducts.length} products`)

  // Demonstrate querying
  console.log('\n=== Query Examples ===')

  // Single key queries
  console.log('\n1. Single Key Queries:')

  const highRatedProducts = await products.findBy('rating' as any, 4.8)
  console.log(`Products with rating 4.8: ${highRatedProducts.map(p => p.name).join(', ')}`)

  const electronicsProducts = await products.findBy('category' as any, 'Electronics')
  console.log(`Electronics products: ${electronicsProducts.map(p => p.name).join(', ')}`)

  // Composite key queries
  console.log('\n2. Composite Key Queries:')

  // Query by category and price (composite index)
  // @ts-ignore
  // const categoryPriceIndex = 'category,price' // Закомментируем неиспользуемую переменную
  // Note: In real usage, you'd use the CompositeKeyUtils.serialize method
  // This is simplified for demo purposes

  console.log('\n=== Index Statistics ===')
  Object.entries(products.indexes).forEach(([name, index]) => {
    console.log(`${name}: ${index.size} entries`)
  })

  console.log('\n🎉 Unified Index API Demo Complete!')

  return products
}

// Helper function to demonstrate the benefits
export function compareOldVsNewAPI() {
  console.log('\n=== API Comparison ===')

  console.log('\n❌ OLD API (Complex):')
  console.log(`
  // Single key with sort order
  { key: 'price', order: 'desc' }

  // Composite key (legacy way)
  { keys: ['category', 'price'] }

  // Composite key with sort order (complex)
  {
    composite: {
      keys: [
        { key: 'category', order: 'asc' },
        { key: 'price', order: 'desc' }
      ],
      separator: '|'
    }
  }
  `)

  console.log('\n✅ NEW API (Unified):')
  console.log(`
  // Single key with sort order
  { key: 'price', order: 'desc' }

  // Composite key (simple)
  { keys: ['category', 'price'] }

  // Composite key with sort order (unified)
  {
    keys: [
      'category',                           // asc by default
      { key: 'price', order: 'desc' }      // explicit desc
    ],
    separator: '|'
  }
  `)

  console.log('\n🎯 Benefits of Unified API:')
  console.log('  ✓ Single interface for all index types')
  console.log('  ✓ Consistent syntax across single and composite keys')
  console.log('  ✓ Simplified configuration')
  console.log('  ✓ Better TypeScript support')
  console.log('  ✓ Backward compatibility maintained')
}

// Run demo if this file is executed directly
if (import.meta.main) {
  await unifiedIndexApiDemo()
  compareOldVsNewAPI()
}