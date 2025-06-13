# 🚀 Phase 4: File Storage System - Development Rules

## 📋 Специальные правила для Phase 4

### **Основанные на DEVELOPMENT_RULES.md с адаптацией для файлового хранения**

---

## 🎯 Фазовый подход к разработке

### **Phase 4 разбита на изолированные компоненты:**

#### **Week 1: Core Foundation**
```markdown
## Week 1: Core File Storage Engine ✅
1. Unified File Storage Manager - центральный API
2. Storage Backend Abstraction - интерфейсы и Local implementation
3. Streaming Support - chunked upload/download с progress tracking

Принцип изоляции: каждый компонент разрабатывается независимо
```

#### **Week 2: Advanced Features**
```markdown
## Week 2: Advanced Features ✅
4. Thumbnail Generation Engine - image/video/document processing
5. File Replication Manager - cross-node distribution
6. Access Control Integration - permission-based file access

Принцип интеграции: компоненты интегрируются через четкие интерфейсы
```

#### **Week 3: Integration & Testing**
```markdown
## Week 3: Integration & Testing ✅
7. Full Integration Testing - end-to-end scenarios
8. Performance Optimization - throughput и latency optimization
9. Documentation & Examples - comprehensive usage guides

Принцип валидации: каждый integration point тестируется отдельно
```

---

## 🔧 Правила реализации для файлового хранения

### **1. Stream-First Architecture**
```typescript
// ✅ ПРАВИЛЬНО: Всегда используй streams для файловых операций
async function uploadFile(stream: ReadableStream, metadata: FileMetadata): Promise<void> {
  // Работаем со stream напрямую, не загружаем в память
  const writeStream = fs.createWriteStream(filePath)
  await pipeline(stream, writeStream)
}

// ❌ НЕПРАВИЛЬНО: Загрузка файла в память
async function uploadFileBad(buffer: Buffer, metadata: FileMetadata): Promise<void> {
  // Может вызвать out of memory для больших файлов
  await fs.writeFile(filePath, buffer)
}

// Правило: Никогда не загружай файлы полностью в память
```

### **2. Backend Agnostic Design**
```typescript
// ✅ ПРАВИЛЬНО: Абстракция storage backend
interface IStorageBackend {
  store(fileId: string, stream: ReadableStream): Promise<void>
  retrieve(fileId: string, range?: ByteRange): Promise<ReadableStream>
  delete(fileId: string): Promise<void>
}

class FileStorageManager {
  constructor(private backend: IStorageBackend) {}

  async upload(file: FileUpload): Promise<FileMetadata> {
    // Используем абстракцию, не зависим от конкретного backend
    await this.backend.store(fileId, file.stream)
  }
}

// ❌ НЕПРАВИЛЬНО: Прямая зависимость от конкретного backend
class FileStorageManagerBad {
  async upload(file: FileUpload): Promise<FileMetadata> {
    // Жестко привязано к локальному хранению
    await fs.writeFile(localPath, file.buffer)
  }
}

// Правило: Всегда используй абстракции для storage backends
```

### **3. Progress Tracking для больших файлов**
```typescript
// ✅ ПРАВИЛЬНО: Отслеживание прогресса для UX
class ChunkedUploader extends EventEmitter {
  async upload(stream: ReadableStream, totalSize: number): Promise<void> {
    let uploadedBytes = 0

    const progressStream = new TransformStream({
      transform(chunk, controller) {
        uploadedBytes += chunk.length

        // Emit progress events
        this.emit('progress', {
          uploadedBytes,
          totalSize,
          percentage: (uploadedBytes / totalSize) * 100
        })

        controller.enqueue(chunk)
      }
    })

    await pipeline(stream, progressStream, targetStream)
  }
}

// Правило: Всегда предоставляй progress tracking для операций >1MB
```

### **4. Robust Error Handling для файловых операций**
```typescript
// ✅ ПРАВИЛЬНО: Comprehensive error handling
async function uploadWithCleanup(file: FileUpload): Promise<FileMetadata> {
  let tempPath: string | null = null
  let metadata: FileMetadata | null = null

  try {
    // 1. Create temp file
    tempPath = await this.createTempFile()

    // 2. Upload to temp location
    await this.uploadToTemp(file.stream, tempPath)

    // 3. Validate file
    await this.validateFile(tempPath)

    // 4. Create metadata
    metadata = await this.createMetadata(file)

    // 5. Move to final location
    await this.moveToFinalLocation(tempPath, metadata.storagePath)

    // 6. Save metadata
    await this.saveMetadata(metadata)

    return metadata

  } catch (error) {
    // Cleanup on any error
    if (tempPath) {
      await this.cleanupTempFile(tempPath).catch(console.warn)
    }
    if (metadata) {
      await this.cleanupMetadata(metadata.id).catch(console.warn)
    }
    throw error
  }
}

// Правило: Всегда очищай ресурсы при ошибках в файловых операциях
```

### **5. Checksum Validation**
```typescript
// ✅ ПРАВИЛЬНО: Валидация целостности файлов
async function uploadWithValidation(file: FileUpload): Promise<FileMetadata> {
  const expectedChecksum = file.checksum
  let calculatedChecksum: string

  // Calculate checksum during upload
  const hashStream = crypto.createHash('sha256')
  const progressStream = new PassThrough()

  progressStream.on('data', (chunk) => {
    hashStream.update(chunk)
  })

  await pipeline(file.stream, progressStream, targetStream)
  calculatedChecksum = hashStream.digest('hex')

  // Validate checksum
  if (expectedChecksum && expectedChecksum !== calculatedChecksum) {
    await this.cleanupFile(fileId) // Cleanup corrupted file
    throw new FileStorageError('Checksum validation failed', {
      expected: expectedChecksum,
      calculated: calculatedChecksum
    })
  }

  return { ...metadata, checksum: calculatedChecksum }
}

// Правило: Всегда валидируй целостность файлов через checksum
```

---

## 🧪 Правила тестирования для файлового хранения

### **6. Тестирование с реальными файлами**
```typescript
// ✅ ПРАВИЛЬНО: Тесты с различными типами файлов
describe('File Upload Tests', () => {
  const testFiles = [
    { name: 'small.txt', size: 1024, type: 'text/plain' },
    { name: 'medium.jpg', size: 1024 * 1024, type: 'image/jpeg' },
    { name: 'large.mp4', size: 100 * 1024 * 1024, type: 'video/mp4' },
    { name: 'huge.zip', size: 1024 * 1024 * 1024, type: 'application/zip' }
  ]

  testFiles.forEach(testFile => {
    it(`should handle ${testFile.name} upload correctly`, async () => {
      const file = createTestFile(testFile.name, testFile.type, testFile.size)
      const metadata = await fileStorage.upload(file, options, user)

      expect(metadata.size).toBe(testFile.size)
      expect(metadata.mimeType).toBe(testFile.type)

      // Verify file can be downloaded
      const downloadStream = await fileStorage.download(metadata.id, {}, user)
      expect(downloadStream).toBeDefined()
    })
  })
})

// Правило: Тестируй с файлами разных размеров и типов
```

### **7. Performance Testing для файловых операций**
```typescript
// ✅ ПРАВИЛЬНО: Измерение производительности файловых операций
describe('File Storage Performance', () => {
  it('should achieve target upload throughput', async () => {
    const fileSize = 50 * 1024 * 1024 // 50MB
    const file = createTestFile('performance.bin', 'application/octet-stream', fileSize)

    const startTime = performance.now()
    await fileStorage.upload(file, options, user)
    const duration = performance.now() - startTime

    const throughputMBps = (fileSize / (duration / 1000)) / (1024 * 1024)

    expect(throughputMBps).toBeGreaterThan(100) // >100MB/s target

    console.log(`Upload throughput: ${throughputMBps.toFixed(2)} MB/s`)
  })

  it('should handle concurrent uploads efficiently', async () => {
    const concurrentUploads = 10
    const files = Array.from({ length: concurrentUploads }, (_, i) =>
      createTestFile(`concurrent-${i}.jpg`, 'image/jpeg', 5 * 1024 * 1024)
    )

    const startTime = performance.now()

    const uploadPromises = files.map(file =>
      fileStorage.upload(file, options, user)
    )

    const results = await Promise.all(uploadPromises)
    const duration = performance.now() - startTime

    expect(results.length).toBe(concurrentUploads)
    expect(duration).toBeLessThan(30000) // Less than 30 seconds

    console.log(`Concurrent uploads completed in: ${duration.toFixed(2)}ms`)
  })
})

// Правило: Всегда измеряй производительность файловых операций
```

### **8. Memory Usage Testing**
```typescript
// ✅ ПРАВИЛЬНО: Контроль использования памяти
describe('Memory Usage Tests', () => {
  it('should not leak memory during large file operations', async () => {
    const initialMemory = process.memoryUsage().heapUsed

    // Upload large file
    const largeFile = createTestFile('memory-test.bin', 'application/octet-stream', 100 * 1024 * 1024)
    await fileStorage.upload(largeFile, options, user)

    // Force garbage collection
    if (global.gc) {
      global.gc()
    }

    const finalMemory = process.memoryUsage().heapUsed
    const memoryIncrease = finalMemory - initialMemory

    // Memory increase should be minimal (not proportional to file size)
    expect(memoryIncrease).toBeLessThan(10 * 1024 * 1024) // Less than 10MB

    console.log(`Memory increase: ${(memoryIncrease / 1024 / 1024).toFixed(2)} MB`)
  })
})

// Правило: Контролируй использование памяти при работе с большими файлами
```

### **9. Error Recovery Testing**
```typescript
// ✅ ПРАВИЛЬНО: Тестирование восстановления после ошибок
describe('Error Recovery Tests', () => {
  it('should cleanup partial uploads on stream error', async () => {
    const file = createTestFile('error-test.txt', 'text/plain', 1024)

    // Mock stream error
    const errorStream = new ReadableStream({
      start(controller) {
        controller.enqueue(new Uint8Array([1, 2, 3]))
        controller.error(new Error('Stream error'))
      }
    })

    file.stream = errorStream

    await expect(
      fileStorage.upload(file, options, user)
    ).rejects.toThrow('Stream error')

    // Verify no orphaned files or metadata
    const orphanedMetadata = await database.collection('file_metadata').find({
      filename: 'error-test.txt'
    })
    expect(orphanedMetadata.length).toBe(0)

    const orphanedFiles = await listOrphanedFiles()
    expect(orphanedFiles.length).toBe(0)
  })

  it('should handle backend unavailability gracefully', async () => {
    // Simulate backend failure
    const mockBackend = jest.spyOn(fileStorage['backendFactory'], 'getBackend')
    mockBackend.mockImplementation(() => {
      throw new Error('Backend unavailable')
    })

    const file = createTestFile('backend-error.txt', 'text/plain', 1024)

    await expect(
      fileStorage.upload(file, options, user)
    ).rejects.toThrow('Backend unavailable')

    // Verify graceful degradation
    expect(fileStorage.isHealthy()).toBe(false)

    mockBackend.mockRestore()
  })
})

// Правило: Тестируй все сценарии ошибок и восстановления
```

---

## 📊 Правила мониторинга производительности

### **10. Real-time Performance Metrics**
```typescript
// ✅ ПРАВИЛЬНО: Мониторинг производительности в реальном времени
class FileStoragePerformanceMonitor {
  private metrics = new Map<string, PerformanceMetric[]>()

  async measureFileOperation<T>(
    operation: string,
    fileSize: number,
    fn: () => Promise<T>
  ): Promise<T> {
    const startTime = performance.now()
    const startMemory = process.memoryUsage()

    try {
      const result = await fn()

      const duration = performance.now() - startTime
      const memoryDelta = process.memoryUsage().heapUsed - startMemory.heapUsed
      const throughputMBps = (fileSize / (duration / 1000)) / (1024 * 1024)

      this.recordMetric(operation, {
        duration,
        fileSize,
        throughputMBps,
        memoryDelta,
        success: true,
        timestamp: Date.now()
      })

      // Alert if performance degrades
      if (throughputMBps < this.getThresholds(operation).minThroughput) {
        this.alertPerformanceDegradation(operation, throughputMBps)
      }

      return result
    } catch (error) {
      this.recordMetric(operation, {
        duration: performance.now() - startTime,
        fileSize,
        success: false,
        error: error.message,
        timestamp: Date.now()
      })
      throw error
    }
  }

  getPerformanceStats(operation: string): PerformanceStats {
    const metrics = this.metrics.get(operation) || []
    const successfulMetrics = metrics.filter(m => m.success)

    return {
      totalOperations: metrics.length,
      successRate: successfulMetrics.length / metrics.length,
      averageThroughput: this.calculateAverage(successfulMetrics.map(m => m.throughputMBps)),
      p95Throughput: this.calculatePercentile(successfulMetrics.map(m => m.throughputMBps), 95),
      averageDuration: this.calculateAverage(successfulMetrics.map(m => m.duration)),
      p95Duration: this.calculatePercentile(successfulMetrics.map(m => m.duration), 95)
    }
  }
}

// Правило: Мониторь производительность всех файловых операций
```

---

## 🔒 Правила безопасности для файлового хранения

### **11. Access Control Validation**
```typescript
// ✅ ПРАВИЛЬНО: Проверка прав доступа на каждом уровне
async function downloadFile(fileId: string, user: User): Promise<ReadableStream> {
  // 1. Check if file exists
  const metadata = await this.getFileMetadata(fileId)
  if (!metadata) {
    throw new FileStorageError('File not found')
  }

  // 2. Check user permission
  const hasPermission = await this.authManager.checkDownloadPermission(user, metadata)
  if (!hasPermission) {
    await this.auditLogger.log({
      action: 'file_access_denied',
      userId: user.id,
      fileId,
      reason: 'insufficient_permissions'
    })
    throw new FileStorageError('Access denied')
  }

  // 3. Check file access level
  if (metadata.access === 'restricted') {
    const hasRestrictedAccess = await this.checkRestrictedAccess(user, metadata)
    if (!hasRestrictedAccess) {
      throw new FileStorageError('Restricted access denied')
    }
  }

  // 4. Log access
  await this.auditLogger.log({
    action: 'file_downloaded',
    userId: user.id,
    fileId,
    fileSize: metadata.size
  })

  return this.backend.retrieve(fileId)
}

// Правило: Проверяй права доступа на каждом этапе файловых операций
```

### **12. Secure File Validation**
```typescript
// ✅ ПРАВИЛЬНО: Валидация безопасности файлов
class FileSecurityValidator {
  async validateUpload(file: FileUpload, user: User): Promise<void> {
    // 1. Check file size limits
    if (file.size > this.getMaxFileSize(user)) {
      throw new FileStorageError('File size exceeds limit')
    }

    // 2. Check mime type restrictions
    if (!this.isAllowedMimeType(file.mimeType, user)) {
      throw new FileStorageError('File type not allowed')
    }

    // 3. Scan for malware (if enabled)
    if (this.config.malwareScanEnabled) {
      await this.scanForMalware(file.stream)
    }

    // 4. Check filename for security issues
    if (this.hasUnsafeFilename(file.filename)) {
      throw new FileStorageError('Unsafe filename detected')
    }

    // 5. Validate file content matches mime type
    const detectedMimeType = await this.detectMimeType(file.stream)
    if (detectedMimeType !== file.mimeType) {
      throw new FileStorageError('File content does not match declared type')
    }
  }

  private hasUnsafeFilename(filename: string): boolean {
    // Check for path traversal attempts
    if (filename.includes('..') || filename.includes('/') || filename.includes('\\')) {
      return true
    }

    // Check for executable extensions
    const dangerousExtensions = ['.exe', '.bat', '.cmd', '.scr', '.pif']
    return dangerousExtensions.some(ext => filename.toLowerCase().endsWith(ext))
  }
}

// Правило: Валидируй безопасность всех загружаемых файлов
```

---

## 📋 Чек-лист для Phase 4

### **Перед началом каждого дня:**
- [ ] Проверить что все тесты предыдущего дня проходят
- [ ] Убедиться что нет memory leaks в файловых операциях
- [ ] Проверить производительность критических операций
- [ ] Валидировать integration points с предыдущими фазами

### **Перед коммитом каждого компонента:**
- [ ] Все unit тесты проходят
- [ ] Performance тесты показывают целевые метрики
- [ ] Memory usage тесты проходят
- [ ] Error handling scenarios покрыты
- [ ] Security validation реализована
- [ ] Audit logging добавлено
- [ ] Documentation обновлена

### **Перед завершением Phase 4:**
- [ ] Все 100+ тестов проходят (100% success rate)
- [ ] Performance benchmarks достигнуты
- [ ] Security requirements выполнены
- [ ] Integration с Phases 1-3 работает
- [ ] Documentation полная и актуальная
- [ ] Examples функциональны

---

## 🎯 Ключевые принципы Phase 4

### **1. Stream-First Architecture**
- Никогда не загружай файлы полностью в память
- Используй streams для всех файловых операций
- Обеспечивай progress tracking для больших файлов

### **2. Backend Agnostic Design**
- Абстрагируй storage backends через интерфейсы
- Поддерживай multiple backends одновременно
- Обеспечивай graceful degradation при недоступности backend

### **3. Security First**
- Валидируй все файловые операции
- Проверяй права доступа на каждом уровне
- Логируй все операции для audit trail

### **4. Performance Optimized**
- Достигай целевых метрик производительности
- Мониторь производительность в реальном времени
- Оптимизируй для concurrent operations

### **5. Error Recovery**
- Очищай ресурсы при любых ошибках
- Обеспечивай graceful degradation
- Тестируй все сценарии восстановления

---

**🏆 PHASE 4: ГОТОВ К РЕАЛИЗАЦИИ С ЧЕТКИМИ ПРАВИЛАМИ**

*Специализированные правила разработки для файлового хранения готовы к применению*