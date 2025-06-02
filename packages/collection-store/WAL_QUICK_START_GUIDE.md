# WAL Transaction System - Краткое Руководство

## 🚀 Быстрый Старт с WAL

### Что такое WAL?

**Write-Ahead Logging (WAL)** - это enterprise-grade система для обеспечения durability и crash recovery. Все изменения сначала записываются в журнал (WAL), затем применяются к данным.

### Ключевые Преимущества

- **🛡️ Crash Recovery** - Автоматическое восстановление после сбоев
- **⚡ High Performance** - 90K+ WAL writes/sec
- **💾 Storage Efficiency** - Smart compression с 20-30% savings
- **🔄 Transaction Durability** - Guaranteed persistence
- **📊 Real-time Monitoring** - Comprehensive observability

## 📝 Базовое Использование

### 1. WAL Collection

```typescript
import { WALCollection } from 'collection-store'

interface User {
  id: number
  name: string
  email: string
}

// Создание WAL Collection
const users = new WALCollection<User>({
  name: 'users',
  root: './data',
  enableTransactions: true,
  walOptions: {
    enableWAL: true,
    autoRecovery: true,
    flushInterval: 1000 // 1 second
  }
})

// Все операции автоматически логируются в WAL
await users.insert({
  id: 1,
  name: 'John Doe',
  email: 'john@example.com'
})

// Обновления с WAL logging
await users.update(1, { name: 'John Smith' })

// Удаления с WAL logging
await users.remove(1)
```

### 2. WAL Database

```typescript
import { WALDatabase } from 'collection-store'

// Создание WAL Database
const db = new WALDatabase({
  name: 'enterprise-db',
  root: './data',
  walOptions: {
    enableWAL: true,
    autoRecovery: true,
    compression: {
      algorithm: 'gzip',
      threshold: 100
    }
  }
})

// Global transactions с WAL coordination
await db.beginGlobalTransaction()
try {
  const users = db.collection('users')
  const orders = db.collection('orders')

  await users.insert(userData)
  await orders.insert(orderData)

  await db.commitGlobalTransaction()
} catch (error) {
  await db.rollbackGlobalTransaction()
  throw error
}
```

## 🔧 Advanced Configuration

### Compression Options

```typescript
const collection = new WALCollection({
  name: 'users',
  root: './data',
  walOptions: {
    enableWAL: true,
    compression: {
      algorithm: 'gzip', // 'gzip' | 'lz4' | 'none'
      threshold: 100,    // Minimum size для compression (bytes)
      level: 6          // Compression level (1-9 для gzip)
    }
  }
})
```

### Performance Monitoring

```typescript
import { PerformanceMonitor } from 'collection-store'

const monitor = new PerformanceMonitor({
  metricsInterval: 5000,
  thresholds: {
    maxLatency: 100,     // 100ms
    maxErrorRate: 1,     // 1%
    maxMemoryUsage: 500 * 1024 * 1024, // 500MB
    minThroughput: 1000  // 1K ops/sec
  },
  enableAlerts: true
})

// Real-time metrics
const metrics = monitor.getCurrentMetrics()
console.log(`Throughput: ${metrics.operationsPerSecond} ops/sec`)
console.log(`Latency: ${metrics.averageLatency}ms`)
console.log(`Memory: ${metrics.memoryUsage.heapUsed / 1024 / 1024}MB`)
```

## 🛡️ Recovery Operations

### Автоматическое Восстановление

```typescript
// Автоматическое восстановление при запуске
const collection = new WALCollection({
  name: 'users',
  root: './data',
  walOptions: {
    enableWAL: true,
    autoRecovery: true // Автоматически восстанавливает данные из WAL
  }
})
```

### Ручное Восстановление

```typescript
// Ручное восстановление из WAL
await collection.recoverFromWAL()

// Создание checkpoint для оптимизации
await collection.createCheckpoint()

// Flush WAL entries
await collection.flushWAL()
```

## 📊 Production Configuration

### Рекомендуемые Настройки

```typescript
// Production WAL Configuration
const productionConfig = {
  name: 'production-collection',
  root: './data',
  enableTransactions: true,
  walOptions: {
    enableWAL: true,
    autoRecovery: true,
    flushInterval: 1000, // 1 second
    walPath: './data/production.wal',
    compression: {
      algorithm: 'gzip',
      threshold: 100,
      level: 6
    }
  }
}

// Production Monitoring
const monitoringConfig = {
  metricsInterval: 5000,
  alertCheckInterval: 1000,
  thresholds: {
    maxLatency: 100,     // 100ms
    maxErrorRate: 1,     // 1%
    maxMemoryUsage: 500 * 1024 * 1024, // 500MB
    minThroughput: 1000  // 1K ops/sec
  },
  enableAlerts: true,
  enableLogging: true
}
```

## 🎯 Performance Tips

### Оптимизация WAL

1. **Используйте compression** для больших данных
2. **Настройте flushInterval** под ваши требования
3. **Создавайте checkpoints** регулярно
4. **Мониторьте производительность** в real-time

### Batch Operations

```typescript
// Batch operations для лучшей производительности
const users = [
  { id: 1, name: 'User 1', email: 'user1@example.com' },
  { id: 2, name: 'User 2', email: 'user2@example.com' },
  { id: 3, name: 'User 3', email: 'user3@example.com' }
]

// Используйте транзакции для batch operations
await collection.withTransaction(async (tx) => {
  for (const user of users) {
    await tx.insert(user)
  }
})
```

## 🔍 Troubleshooting

### Общие Проблемы

1. **WAL файл поврежден**
   ```typescript
   // Восстановление из последнего checkpoint
   await collection.recoverFromCheckpoint()
   ```

2. **Высокое использование памяти**
   ```typescript
   // Создание checkpoint для освобождения памяти
   await collection.createCheckpoint()
   ```

3. **Медленная производительность**
   ```typescript
   // Проверка метрик
   const metrics = monitor.getCurrentMetrics()
   console.log('Performance metrics:', metrics)
   ```

### Debugging

```typescript
// Включение debug режима
const collection = new WALCollection({
  name: 'debug-collection',
  root: './data',
  walOptions: {
    enableWAL: true,
    debug: true // Включает подробное логирование
  }
})
```

## 📚 Дополнительные Ресурсы

- [WAL Transaction System - Final Completion Report](./FINAL_PROJECT_COMPLETION.md)
- [Performance Benchmark Results](./PHASE_4_1_BENCHMARK_RESULTS.md)
- [Stress Testing Results](./PHASE_4_2_STRESS_TEST_RESULTS.md)
- [Storage Transaction Coordination Plan](./STORAGE_TRANSACTION_COORDINATION_PLAN.md)

---

**WAL Transaction System - Enterprise-Grade Durability для ваших данных!** 🚀