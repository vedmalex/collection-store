import Collection from '../core/Collection'
import { List } from '../storage/List'
import AdapterMemory from '../storage/adapters/AdapterMemory'

interface Product {
  id: number
  name: string
  price: number
  rating: number
  category: string
  createdAt: Date
}

/**
 * Demo: Using Sort Order in Collection Configuration
 *
 * This demo shows how to specify sort order for single key indexes
 * directly in the collection configuration using indexList.
 */
export async function collectionConfigSortOrderDemo() {
  console.log('=== Collection Config Sort Order Demo ===\n')

  // Create collection with indexes configured in indexList
  const products = Collection.create<Product>({
    name: 'products_with_sort_order',
    id: 'id',
    root: './data/',
    list: new List<Product>(),
    adapter: new AdapterMemory<Product>(),
        indexList: [
      // Price index with ascending order (default)
      { key: 'price', order: 'asc' },

      // Rating index with descending order (highest first)
      { key: 'rating', order: 'desc' },

      // Name index with ascending order for alphabetical sorting
      { key: 'name', order: 'asc' },

      // Category index with descending order
      { key: 'category', order: 'desc' },

      // Sparse index with sort order
      { key: 'createdAt', sparse: true, order: 'desc' }
    ]
  })

  console.log('Collection created with the following index configuration:')
  Object.entries(products.indexDefs).forEach(([name, def]) => {
    const orderInfo = def.order ? ` (order: ${def.order})` : ' (order: asc - default)'
    const uniqueInfo = def.unique ? ' [unique]' : ''
    const sparseInfo = def.sparse ? ' [sparse]' : ''
    console.log(`  ${name}: key="${def.key}"${orderInfo}${uniqueInfo}${sparseInfo}`)
  })
  console.log()

  // Add sample data
  const sampleProducts: Product[] = [
    {
      id: 1,
      name: 'Laptop',
      price: 1200,
      rating: 4.5,
      category: 'Electronics',
      createdAt: new Date('2023-01-01')
    },
    {
      id: 2,
      name: 'Mouse',
      price: 25,
      rating: 4.2,
      category: 'Accessories',
      createdAt: new Date('2023-01-02')
    },
    {
      id: 3,
      name: 'Keyboard',
      price: 80,
      rating: 4.7,
      category: 'Accessories',
      createdAt: new Date('2023-01-03')
    },
    {
      id: 4,
      name: 'Monitor',
      price: 300,
      rating: 4.3,
      category: 'Electronics',
      createdAt: new Date('2023-01-04')
    },
    {
      id: 5,
      name: 'Headphones',
      price: 150,
      rating: 4.6,
      category: 'Audio',
      createdAt: new Date('2023-01-05')
    }
  ]

  for (const product of sampleProducts) {
    await products.create(product)
  }

  console.log('Sample products added:')
  sampleProducts.forEach(p =>
    console.log(`  ${p.name}: $${p.price}, Rating: ${p.rating}, Category: ${p.category}`)
  )
  console.log()

  // Demonstrate sorting with different indexes
  console.log('1. Products by price (ascending - default):')
  // Use find with query to demonstrate sorting
  const byPrice = await products.find({ price: { $gte: 0 } })
  byPrice.forEach(p =>
    console.log(`  ${p.name}: $${p.price}`)
  )
  console.log()

  console.log('2. Products by rating (descending - highest first):')
  const byRating = await products.find({ rating: { $gte: 0 } })
  byRating.forEach(p =>
    console.log(`  ${p.name}: ${p.rating} stars`)
  )
  console.log()

  console.log('3. Products by name (ascending - alphabetical):')
  const byName = await products.find({})
  byName.forEach(p =>
    console.log(`  ${p.name}`)
  )
  console.log()

  console.log('4. Products by category (descending):')
  const byCategory = await products.find({ category: { $exists: true } })
  byCategory.forEach(p =>
    console.log(`  ${p.category}: ${p.name}`)
  )
  console.log()

    // Demonstrate findBy with specific values
  console.log('5. Find specific products using findBy:')
  const electronicsProducts = await products.findBy('category' as any, 'Electronics')
  console.log(`  Electronics products: ${electronicsProducts.map(p => p.name).join(', ')}`)

  const highRatedProducts = await products.findBy('rating' as any, 4.7)
  console.log(`  Products with 4.7 rating: ${highRatedProducts.map(p => p.name).join(', ')}`)
  console.log()

  // Show how indexes are actually configured
  console.log('6. Index configuration details:')
  Object.entries(products.indexDefs).forEach(([name, def]) => {
    if (def.key) { // Only show single key indexes
      const order = def.order || 'asc (default)'
      console.log(`  Index "${name}": key="${def.key}", order="${order}"`)
    }
  })
  console.log()

  console.log('=== Demo completed ===')
}

// Run demo if this file is executed directly
if (import.meta.main) {
  collectionConfigSortOrderDemo().catch(console.error)
}