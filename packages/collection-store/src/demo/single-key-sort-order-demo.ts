import Collection from '../core/Collection'

interface Product {
  id: number
  name: string
  price: number
  rating: number
  createdAt: Date
}

/**
 * Demo: Single Key Sort Order
 *
 * This demo shows how to use sort order for single key indexes.
 * You can specify 'asc' or 'desc' order when creating indexes.
 */
export async function singleKeySortOrderDemo() {
  console.log('=== Single Key Sort Order Demo ===\n')

  // Create collection
  const products = Collection.create<Product>({
    name: 'products',
    id: 'id',
    root: './data/',
    list: new (await import('../storage/List')).List<Product>(),
    adapter: new (await import('../storage/adapters/AdapterMemory')).default<Product>()
  })

  // Create indexes with different sort orders
  await products.createIndex('price_asc', { key: 'price', order: 'asc' })
  await products.createIndex('price_desc', { key: 'price', order: 'desc' })
  await products.createIndex('rating_desc', { key: 'rating', order: 'desc' })
  await products.createIndex('name_asc', { key: 'name', order: 'asc' })

  // Add sample data
  const sampleProducts: Product[] = [
    { id: 1, name: 'Laptop', price: 1200, rating: 4.5, createdAt: new Date('2023-01-01') },
    { id: 2, name: 'Mouse', price: 25, rating: 4.2, createdAt: new Date('2023-01-02') },
    { id: 3, name: 'Keyboard', price: 80, rating: 4.7, createdAt: new Date('2023-01-03') },
    { id: 4, name: 'Monitor', price: 300, rating: 4.3, createdAt: new Date('2023-01-04') },
    { id: 5, name: 'Headphones', price: 150, rating: 4.6, createdAt: new Date('2023-01-05') }
  ]

  for (const product of sampleProducts) {
    await products.create(product)
  }

  console.log('Sample products added:')
  sampleProducts.forEach(p =>
    console.log(`  ${p.name}: $${p.price}, Rating: ${p.rating}`)
  )
  console.log()

    // Demonstrate different sort orders
  console.log('1. Products sorted by price (ascending):')
  const byPriceAsc = await products.find({ price: { $gte: 0 } })
  byPriceAsc.forEach(p =>
    console.log(`  ${p.name}: $${p.price}`)
  )
  console.log()

  console.log('2. Products sorted by rating (descending):')
  const byRatingDesc = await products.find({ rating: { $gte: 0 } })
  byRatingDesc.forEach(p =>
    console.log(`  ${p.name}: ${p.rating} stars`)
  )
  console.log()

  console.log('3. Products sorted by name (ascending):')
  const byNameAsc = await products.find({})
  byNameAsc.forEach(p =>
    console.log(`  ${p.name}`)
  )
  console.log()

  // Show index definitions
  console.log('4. Index definitions with sort order:')
  Object.entries(products.indexDefs).forEach(([name, def]) => {
    if (def.order) {
      console.log(`  ${name}: key="${def.key}", order="${def.order}"`)
    }
  })
  console.log()

  console.log('=== Demo completed ===')
}

// Run demo if this file is executed directly
if (import.meta.main) {
  singleKeySortOrderDemo().catch(console.error)
}