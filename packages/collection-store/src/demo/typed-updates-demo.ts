/**
 * Demonstration of Type-safe Update Operations in Collection Store
 *
 * This demo shows how to use the new Type-safe update functionality
 * that provides MongoDB-style operators with full TypeScript support.
 */

import { createTypedCollection } from '../core/TypedCollection'
import { TypedSchemaDefinition } from '../types/typed-schema'
import { Item } from '../types/Item'
import { List } from '../storage/List'
import AdapterMemory from '../storage/adapters/AdapterMemory'

// Example interface
interface User extends Item {
  id: number
  name: string
  email: string
  age: number
  isActive: boolean
  tags: string[]
  profile: {
    bio: string
    settings: {
      notifications: boolean
      theme: 'light' | 'dark'
    }
  }
  createdAt: Date
  lastLogin?: Date
}

// Schema definition with indexes
const userSchema: TypedSchemaDefinition<User> = {
  id: {
    type: 'int',
    required: true,
    index: { unique: true }
  },
  name: {
    type: 'string',
    required: true,
    index: true
  },
  email: {
    type: 'string',
    required: true,
    unique: true
  },
  age: {
    type: 'int',
    required: true
  },
  isActive: {
    type: 'boolean',
    required: true,
    default: true
  },
  tags: {
    type: 'array',
    default: []
  },
  'profile.bio': {
    type: 'string',
    default: ''
  },
  'profile.settings.notifications': {
    type: 'boolean',
    default: true
  },
  'profile.settings.theme': {
    type: 'string',
    default: 'light'
  },
  createdAt: {
    type: 'date',
    required: true
  },
  lastLogin: {
    type: 'date'
  }
}

export async function demonstrateTypedUpdates() {
  console.log('🚀 Type-safe Update Operations Demo\n')

  // Create typed collection
  const users = createTypedCollection({
    name: 'demo-users',
    schema: userSchema,
    root: './demo-data',
    list: new List<User>(),
    adapter: new AdapterMemory<User>()
  })

  // Insert sample data
  console.log('📝 Inserting sample users...')
  await users.insert({
    id: 1,
    name: 'Alice Johnson',
    email: 'alice@example.com',
    age: 30,
    isActive: true,
    tags: ['developer', 'typescript'],
    profile: {
      bio: 'Software developer',
      settings: {
        notifications: true,
        theme: 'light'
      }
    },
    createdAt: new Date('2023-01-01')
  })

  await users.insert({
    id: 2,
    name: 'Bob Smith',
    email: 'bob@example.com',
    age: 25,
    isActive: false,
    tags: ['designer', 'ui'],
    profile: {
      bio: 'UI Designer',
      settings: {
        notifications: false,
        theme: 'dark'
      }
    },
    createdAt: new Date('2023-02-01')
  })

  console.log('✅ Sample data inserted\n')

  // 1. Basic $set operation
  console.log('1️⃣ Basic $set operation:')
  const setResult = await users.updateAtomic({
    filter: { id: 1 },
    update: {
      $set: {
        age: 31,
        'profile.bio': 'Senior Software Developer'
      }
    }
  })
  console.log(`   Updated ${setResult.modifiedCount} user(s)`)
  console.log(`   New age: ${setResult.modifiedDocuments[0].age}`)
  console.log(`   New bio: ${setResult.modifiedDocuments[0].profile.bio}\n`)

  // 2. Numeric operations
  console.log('2️⃣ Numeric operations ($inc, $mul):')
  await users.updateAtomic({
    filter: { id: 1 },
    update: {
      $inc: { age: 2 } // Increment age by 2
    }
  })

  const user1 = await users.findById(1)
  console.log(`   Age after increment: ${user1?.age}\n`)

  // 3. Array operations
  console.log('3️⃣ Array operations:')

  // Add unique tags
  await users.updateAtomic({
    filter: { id: 1 },
    update: {
      $addToSet: {
        tags: 'javascript' // Won't add duplicates
      }
    }
  })

  // Push multiple tags
  await users.updateAtomic({
    filter: { id: 1 },
    update: {
      $push: {
        tags: { $each: ['react', 'node.js'] }
      }
    }
  })

  const userWithTags = await users.findById(1)
  console.log(`   Tags after operations: ${userWithTags?.tags.join(', ')}\n`)

  // 4. Date operations
  console.log('4️⃣ Date operations ($currentDate):')
  await users.updateAtomic({
    filter: { id: 1 },
    update: {
      $currentDate: {
        lastLogin: true
      }
    }
  })

  const userWithLogin = await users.findById(1)
  console.log(`   Last login set to: ${userWithLogin?.lastLogin}\n`)

  // 5. Min/Max operations
  console.log('5️⃣ Min/Max operations:')
  await users.updateAtomic({
    filter: { id: 2 },
    update: {
      $min: { age: 20 }, // Will update since 20 < 25
      $max: { age: 30 }  // Won't update since 30 > current age
    }
  })

  const user2 = await users.findById(2)
  console.log(`   User 2 age after min/max: ${user2?.age}\n`)

  // 6. Bulk operations
  console.log('6️⃣ Bulk update operations:')
  const bulkResults = await users.updateBulk({
    operations: [
      {
        filter: { isActive: false },
        update: { $set: { isActive: true } },
        options: { multi: true }
      },
      {
        filter: { age: { $gte: 30 } },
        update: { $addToSet: { tags: 'senior' } },
        options: { multi: true }
      }
    ]
  })

  console.log(`   Bulk operation 1: ${bulkResults[0].modifiedCount} users activated`)
  console.log(`   Bulk operation 2: ${bulkResults[1].modifiedCount} users tagged as senior\n`)

  // 7. Mixed operations
  console.log('7️⃣ Mixed direct and operator updates:')
  await users.updateAtomic({
    filter: { id: 1 },
    update: {
      name: 'Alice Johnson-Smith', // Direct field update
      $inc: { age: 1 },           // Operator update
      $push: { tags: 'team-lead' }, // Array operator
      $currentDate: { lastLogin: true } // Date operator
    }
  })

  const finalUser = await users.findById(1)
  console.log(`   Final name: ${finalUser?.name}`)
  console.log(`   Final age: ${finalUser?.age}`)
  console.log(`   Final tags: ${finalUser?.tags.join(', ')}\n`)

  // 8. Upsert operation
  console.log('8️⃣ Upsert operation:')
  const upsertResult = await users.updateAtomic({
    filter: { id: 999 },
    update: {
      $set: {
        name: 'New User',
        email: 'new@example.com',
        age: 28,
        isActive: true,
        tags: ['newcomer'],
        profile: {
          bio: 'Just joined',
          settings: {
            notifications: true,
            theme: 'light'
          }
        },
        createdAt: new Date()
      }
    },
    options: { upsert: true }
  })

  console.log(`   Upserted ${upsertResult.upsertedCount} new user`)
  console.log(`   New user ID: ${upsertResult.upsertedIds[0]}\n`)

  // Show final state
  console.log('📊 Final collection state:')
  const allUsers = await users.find({})
  allUsers.forEach(user => {
    console.log(`   ${user.name} (${user.age}): ${user.tags.join(', ')}`)
  })

  // Cleanup
  await users.reset()
  console.log('\n🧹 Demo completed and cleaned up!')
}

// Type-safe update benefits demonstration
export function demonstrateTypeSafety() {
  console.log('\n🛡️ Type Safety Benefits:\n')

  console.log('✅ IntelliSense support for all update operations')
  console.log('✅ Compile-time validation of field names and types')
  console.log('✅ MongoDB-style operators with TypeScript safety')
  console.log('✅ Automatic schema validation during updates')
  console.log('✅ Support for nested field updates')
  console.log('✅ Array operations with type checking')
  console.log('✅ Atomic and bulk update operations')
  console.log('✅ Upsert operations with schema validation')

  // Example of type-safe usage (commented to show IntelliSense)
  /*
  await users.updateAtomic({
    filter: {
      age: { $gte: 25 },     // ✅ Type-safe field access
      isActive: true         // ✅ Boolean type validation
    },
    update: {
      $set: {
        age: 30,             // ✅ Number type validation
        // age: "30"         // ❌ Would cause TypeScript error
      },
      $push: {
        tags: 'experienced'  // ✅ String array validation
        // tags: 123         // ❌ Would cause TypeScript error
      },
      $inc: {
        age: 1              // ✅ Numeric increment
        // name: 1          // ❌ Would cause TypeScript error
      }
    }
  })
  */
}

// Run demo if called directly
if (import.meta.main) {
  demonstrateTypedUpdates()
    .then(() => demonstrateTypeSafety())
    .catch(console.error)
}