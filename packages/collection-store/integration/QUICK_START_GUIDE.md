# Collection Store - Quick Start Guide

## 🚀 Getting Started

Collection Store is an enterprise-grade data management system with authentication, authorization, real-time capabilities, file storage, and advanced client integration.

## 📦 Installation

```bash
# Clone the repository
git clone <repository-url>
cd collection-store

# Install dependencies
bun install

# Run tests to verify installation
bun test
```

## 🔧 Basic Setup

### 1. Initialize the Client SDK

```typescript
import { ClientSDK } from './src/client/sdk'

const sdk = new ClientSDK({
  baseUrl: 'http://localhost:3000',
  auth: {
    tokenStorage: 'localStorage',
    autoRefresh: true
  },
  session: {
    timeout: 3600000, // 1 hour
    heartbeatInterval: 30000 // 30 seconds
  }
})

await sdk.connect()
```

### 2. Authentication

```typescript
// Register a new user
const registerResult = await sdk.auth.register({
  email: 'user@example.com',
  password: 'securePassword123',
  name: 'John Doe'
})

// Login
const loginResult = await sdk.auth.login({
  email: 'user@example.com',
  password: 'securePassword123'
})

if (loginResult.success) {
  console.log('Logged in successfully!')
}
```

### 3. Collection Operations

```typescript
// Create a document
const createResult = await sdk.collections.create('users', {
  name: 'Jane Smith',
  email: 'jane@example.com',
  age: 28
})

// Find documents with pagination
const findResult = await sdk.collections.find('users', {
  filter: { age: { $gte: 18 } },
  sort: { name: 1 },
  limit: 10
})

// Update a document
const updateResult = await sdk.collections.update('users', 'user-id', {
  age: 29
})
```

### 4. File Operations

```typescript
// Upload a file
const file = new File(['content'], 'document.txt', { type: 'text/plain' })
const uploadResult = await sdk.files.upload('documents', file, {
  metadata: { category: 'important' }
})

// Download a file
const downloadResult = await sdk.files.download('file-id')
if (downloadResult.success) {
  const blob = downloadResult.data
  // Handle the downloaded file
}
```

### 5. Real-time Subscriptions

```typescript
// Subscribe to collection changes
const subscription = await sdk.subscriptions.subscribe('users', {
  events: ['create', 'update', 'delete'],
  filter: { active: true }
})

subscription.on('create', (data) => {
  console.log('New user created:', data)
})

subscription.on('update', (data) => {
  console.log('User updated:', data)
})
```

### 6. Advanced Pagination

```typescript
// Cursor-based pagination with sorting
const paginationResult = await sdk.collections.find('products', {
  sort: [
    { field: 'category', direction: 'asc' },
    { field: 'price', direction: 'desc' },
    { field: 'name', direction: 'asc' }
  ],
  limit: 20,
  cursor: 'eyJpZCI6IjY3M...' // From previous page
})

// Get next page
if (paginationResult.success && paginationResult.data.hasNextPage) {
  const nextPage = await sdk.collections.find('products', {
    sort: [
      { field: 'category', direction: 'asc' },
      { field: 'price', direction: 'desc' },
      { field: 'name', direction: 'asc' }
    ],
    limit: 20,
    cursor: paginationResult.data.nextCursor
  })
}
```

## 🔐 Authorization Setup

```typescript
// Check permissions
const hasPermission = await sdk.auth.hasPermission('users:read')

// Get user roles
const roles = await sdk.auth.getUserRoles()

// Admin operations (requires admin role)
if (await sdk.auth.hasRole('admin')) {
  await sdk.auth.assignRole('user-id', 'moderator')
  await sdk.auth.grantPermission('user-id', 'posts:moderate')
}
```

## 📱 React Integration

```tsx
import React, { useEffect, useState } from 'react'
import { ClientSDK } from './src/client/sdk'

const UserList: React.FC = () => {
  const [users, setUsers] = useState([])
  const [sdk] = useState(() => new ClientSDK({
    baseUrl: process.env.REACT_APP_API_URL
  }))

  useEffect(() => {
    const initializeSDK = async () => {
      await sdk.connect()

      // Load users
      const result = await sdk.collections.find('users', {
        limit: 10,
        sort: { name: 1 }
      })

      if (result.success) {
        setUsers(result.data.items)
      }

      // Subscribe to real-time updates
      const subscription = await sdk.subscriptions.subscribe('users', {
        events: ['create', 'update', 'delete']
      })

      subscription.on('create', (user) => {
        setUsers(prev => [...prev, user])
      })

      subscription.on('update', (user) => {
        setUsers(prev => prev.map(u => u.id === user.id ? user : u))
      })

      subscription.on('delete', (user) => {
        setUsers(prev => prev.filter(u => u.id !== user.id))
      })
    }

    initializeSDK()

    return () => {
      sdk.disconnect()
    }
  }, [sdk])

  return (
    <div>
      <h2>Users</h2>
      {users.map(user => (
        <div key={user.id}>
          {user.name} - {user.email}
        </div>
      ))}
    </div>
  )
}
```

## 🖥️ Node.js Server Integration

```typescript
import { ClientSDK } from './src/client/sdk'
import express from 'express'

const app = express()
const sdk = new ClientSDK({
  baseUrl: 'http://localhost:3000',
  auth: {
    apiKey: process.env.API_KEY
  }
})

app.use(express.json())

// Initialize SDK
sdk.connect().then(() => {
  console.log('SDK connected successfully')
})

// API endpoint with Collection Store integration
app.get('/api/users', async (req, res) => {
  try {
    const { page = 1, limit = 10, sort = 'name' } = req.query

    const result = await sdk.collections.find('users', {
      limit: parseInt(limit as string),
      sort: { [sort as string]: 1 }
    })

    if (result.success) {
      res.json(result.data)
    } else {
      res.status(400).json({ error: result.error })
    }
  } catch (error) {
    res.status(500).json({ error: 'Internal server error' })
  }
})

app.listen(3001, () => {
  console.log('Server running on port 3001')
})
```

## 🧪 Running Tests

```bash
# Run all tests
bun test

# Run specific test suites
bun test --grep "Authentication"
bun test --grep "Authorization"
bun test --grep "Pagination"
bun test --grep "Session"
bun test --grep "SDK"

# Run tests with coverage
bun test --coverage
```

## 📊 Performance Monitoring

```typescript
// Enable performance monitoring
const sdk = new ClientSDK({
  baseUrl: 'http://localhost:3000',
  monitoring: {
    enabled: true,
    metricsInterval: 60000 // 1 minute
  }
})

// Get performance metrics
const metrics = sdk.getMetrics()
console.log('Request count:', metrics.requestCount)
console.log('Average response time:', metrics.averageResponseTime)
console.log('Error rate:', metrics.errorRate)

// Monitor specific operations
sdk.on('request', (event) => {
  console.log(`${event.method} ${event.url} - ${event.duration}ms`)
})
```

## 🔧 Configuration Options

```typescript
const config = {
  // Base configuration
  baseUrl: 'http://localhost:3000',
  timeout: 30000,

  // Authentication
  auth: {
    tokenStorage: 'localStorage', // 'localStorage' | 'sessionStorage' | 'memory'
    autoRefresh: true,
    refreshThreshold: 300000 // 5 minutes
  },

  // Session management
  session: {
    timeout: 3600000, // 1 hour
    heartbeatInterval: 30000, // 30 seconds
    reconnectAttempts: 5,
    reconnectDelay: 1000
  },

  // Caching
  cache: {
    enabled: true,
    strategy: 'lru', // 'lru' | 'lfu' | 'fifo'
    maxSize: 100,
    ttl: 300000, // 5 minutes
    compression: true
  },

  // Performance
  performance: {
    enableMetrics: true,
    batchSize: 100,
    requestTimeout: 10000
  },

  // Logging
  logging: {
    level: 'info', // 'debug' | 'info' | 'warn' | 'error'
    enableConsole: true,
    enableRemote: false
  }
}

const sdk = new ClientSDK(config)
```

## 📚 Additional Resources

- **[Complete API Documentation](./API_DOCUMENTATION.md)**
- **[Architecture Overview](./PROJECT_STRUCTURE_OVERVIEW.md)**
- **[Final Project Report](./COLLECTION_STORE_FINAL_REPORT.md)**
- **[Integration Examples](./src/client/sdk/examples/)**
- **[Test Suites](./src/__test__/)**

## 🆘 Troubleshooting

### Common Issues

1. **Connection Issues**
   ```typescript
   // Check connection status
   if (!sdk.isConnected()) {
     await sdk.reconnect()
   }
   ```

2. **Authentication Errors**
   ```typescript
   // Clear stored tokens and re-authenticate
   await sdk.auth.logout()
   await sdk.auth.login(credentials)
   ```

3. **Performance Issues**
   ```typescript
   // Enable caching for better performance
   const sdk = new ClientSDK({
     cache: { enabled: true, strategy: 'lru' }
   })
   ```

### Getting Help

- Check the test files for usage examples
- Review the integration examples in `src/client/sdk/examples/`
- All 185 tests are passing and can serve as documentation

---

**Status**: ✅ **Production Ready**
**Tests**: 185/185 passing (100%)
**TypeScript**: Full type safety
**Documentation**: Comprehensive