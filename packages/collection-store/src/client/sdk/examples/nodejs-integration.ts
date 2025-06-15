/**
 * Phase 5: Client Integration - Node.js Integration Example
 *
 * Пример интеграции Client SDK с Node.js приложением (Express.js)
 *
 * Note: This example requires optional dependencies:
 * npm install express @types/express socket.io @types/socket.io
 */

// @ts-ignore - Optional dependency for example
import express from 'express'
import { ClientSDK } from '../core/ClientSDK'
import { ClientSDKConfig } from '../interfaces/IClientSDK'

// Типы для API
interface User {
  id: string
  name: string
  email: string
  role: string
  createdAt: Date
}

interface ApiResponse<T = any> {
  success: boolean
  data?: T
  error?: string
  timestamp: Date
}

// Класс для управления SDK в Node.js приложении
class NodeSDKManager {
  private sdk: ClientSDK | null = null
  private isInitialized = false
  private connectionRetries = 0
  private maxRetries = 5

  constructor(private config: ClientSDKConfig) {}

  /**
   * Инициализация SDK
   */
  async initialize(): Promise<void> {
    if (this.isInitialized) {
      return
    }

    try {
      this.sdk = new ClientSDK(this.config)

      // Настройка обработчиков событий
      this.setupEventHandlers()

      // Инициализация и подключение
      await this.sdk.initialize()
      await this.connectWithRetry()

      this.isInitialized = true
      console.log('✅ SDK successfully initialized')
    } catch (error) {
      console.error('❌ Failed to initialize SDK:', error)
      throw error
    }
  }

  /**
   * Подключение с повторными попытками
   */
  private async connectWithRetry(): Promise<void> {
    while (this.connectionRetries < this.maxRetries) {
      try {
        if (this.sdk) {
          await this.sdk.connect()
          console.log('✅ Connected to Collection Store')
          this.connectionRetries = 0
          return
        }
      } catch (error) {
        this.connectionRetries++
        console.warn(`⚠️ Connection attempt ${this.connectionRetries} failed:`, error)

        if (this.connectionRetries >= this.maxRetries) {
          throw new Error(`Failed to connect after ${this.maxRetries} attempts`)
        }

        // Экспоненциальная задержка
        const delay = Math.min(1000 * Math.pow(2, this.connectionRetries), 30000)
        await new Promise(resolve => setTimeout(resolve, delay))
      }
    }
  }

  /**
   * Настройка обработчиков событий
   */
  private setupEventHandlers(): void {
    if (!this.sdk) return

    this.sdk.addEventListener('sdk_connected', () => {
      console.log('🔗 SDK connected')
      this.connectionRetries = 0
    })

    this.sdk.addEventListener('sdk_disconnected', () => {
      console.log('🔌 SDK disconnected')
      // Автоматическое переподключение
      setTimeout(() => this.reconnect(), 5000)
    })

    this.sdk.addEventListener('sdk_error', (event) => {
      console.error('💥 SDK error:', event.data.error)
    })

    this.sdk.addEventListener('auth_success', (event) => {
      console.log('🔐 Authentication successful:', event.data.user.email)
    })

    this.sdk.addEventListener('auth_logout', () => {
      console.log('👋 User logged out')
    })
  }

  /**
   * Переподключение
   */
  private async reconnect(): Promise<void> {
    try {
      await this.connectWithRetry()
    } catch (error) {
      console.error('❌ Reconnection failed:', error)
    }
  }

  /**
   * Получение экземпляра SDK
   */
  getSDK(): ClientSDK {
    if (!this.sdk || !this.isInitialized) {
      throw new Error('SDK not initialized. Call initialize() first.')
    }
    return this.sdk
  }

  /**
   * Завершение работы
   */
  async shutdown(): Promise<void> {
    if (this.sdk) {
      await this.sdk.shutdown()
      this.sdk = null
      this.isInitialized = false
      console.log('🛑 SDK shutdown complete')
    }
  }

  /**
   * Проверка состояния
   */
  getStatus() {
    return {
      initialized: this.isInitialized,
      connected: this.sdk?.isConnected() || false,
      retries: this.connectionRetries,
      stats: this.sdk ? this.sdk.getStats() : null
    }
  }
}

// Создание Express приложения
const app = express()
app.use(express.json())

// Инициализация SDK Manager
const sdkConfig: ClientSDKConfig = {
  baseUrl: process.env.COLLECTION_STORE_URL || 'http://localhost:3000',
  apiKey: process.env.COLLECTION_STORE_API_KEY || 'demo-key',
  timeout: 30000,
  cache: {
    enabled: true,
    maxSize: 10000,
    ttl: 600000, // 10 minutes
    strategy: 'lru',
    compression: true
  },
  logging: {
    enabled: true,
    level: process.env.NODE_ENV === 'production' ? 'warn' : 'debug'
  }
}

const sdkManager = new NodeSDKManager(sdkConfig)

// Middleware для проверки инициализации SDK
const requireSDK = (req: express.Request, res: express.Response, next: express.NextFunction) => {
  try {
    req.sdk = sdkManager.getSDK()
    next()
  } catch (error) {
    res.status(503).json({
      success: false,
      error: 'SDK not available',
      timestamp: new Date()
    } as ApiResponse)
  }
}

// Расширение типа Request
declare global {
  namespace Express {
    interface Request {
      sdk: ClientSDK
      user?: User
    }
  }
}

// Middleware для аутентификации
const authenticate = async (req: express.Request, res: express.Response, next: express.NextFunction) => {
  const token = req.headers.authorization?.replace('Bearer ', '')

  if (!token) {
    return res.status(401).json({
      success: false,
      error: 'No token provided',
      timestamp: new Date()
    } as ApiResponse)
  }

  try {
    // Проверка токена через SDK
    const result = await req.sdk.authenticate({
      method: 'token',
      credentials: { token }
    })

    if (result.success && result.data) {
      req.user = result.data
      next()
    } else {
      res.status(401).json({
        success: false,
        error: 'Invalid token',
        timestamp: new Date()
      } as ApiResponse)
    }
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Authentication failed',
      timestamp: new Date()
    } as ApiResponse)
  }
}

// API Routes

/**
 * Статус системы
 */
app.get('/api/status', (req, res) => {
  const status = sdkManager.getStatus()
  res.json({
    success: true,
    data: {
      service: 'Collection Store API',
      version: '1.0.0',
      sdk: status,
      uptime: process.uptime(),
      memory: process.memoryUsage(),
      timestamp: new Date()
    },
    timestamp: new Date()
  } as ApiResponse)
})

/**
 * Аутентификация пользователя
 */
app.post('/api/auth/login', requireSDK, async (req, res) => {
  try {
    const { email, password } = req.body

    if (!email || !password) {
      return res.status(400).json({
        success: false,
        error: 'Email and password are required',
        timestamp: new Date()
      } as ApiResponse)
    }

    const result = await req.sdk.authenticate({
      method: 'password',
      credentials: { email, password }
    })

    if (result.success) {
      res.json({
        success: true,
        data: result.data,
        timestamp: new Date()
      } as ApiResponse)
    } else {
      res.status(401).json({
        success: false,
        error: result.error?.message || 'Authentication failed',
        timestamp: new Date()
      } as ApiResponse)
    }
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Internal server error',
      timestamp: new Date()
    } as ApiResponse)
  }
})

/**
 * Получение списка пользователей
 */
app.get('/api/users', requireSDK, authenticate, async (req, res) => {
  try {
    const { page = 1, limit = 10, search } = req.query

    const options = {
      pagination: {
        page: parseInt(page as string),
        limit: parseInt(limit as string)
      },
      filter: search ? { name: { $regex: search, $options: 'i' } } : {},
      sort: { createdAt: -1 }
    }

    const result = await req.sdk.collections.find('users', options)

    if (result.success) {
      res.json({
        success: true,
        data: result.data,
        timestamp: new Date()
      } as ApiResponse)
    } else {
      res.status(500).json({
        success: false,
        error: result.error?.message || 'Failed to fetch users',
        timestamp: new Date()
      } as ApiResponse)
    }
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Internal server error',
      timestamp: new Date()
    } as ApiResponse)
  }
})

/**
 * Создание нового пользователя
 */
app.post('/api/users', requireSDK, authenticate, async (req, res) => {
  try {
    const userData = {
      ...req.body,
      createdAt: new Date(),
      updatedAt: new Date()
    }

    const result = await req.sdk.collections.create('users', userData)

    if (result.success) {
      res.status(201).json({
        success: true,
        data: result.data,
        timestamp: new Date()
      } as ApiResponse)
    } else {
      res.status(400).json({
        success: false,
        error: result.error?.message || 'Failed to create user',
        timestamp: new Date()
      } as ApiResponse)
    }
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Internal server error',
      timestamp: new Date()
    } as ApiResponse)
  }
})

/**
 * Обновление пользователя
 */
app.put('/api/users/:id', requireSDK, authenticate, async (req, res) => {
  try {
    const { id } = req.params
    const updateData = {
      ...req.body,
      updatedAt: new Date()
    }

    const result = await req.sdk.collections.update('users', id, updateData)

    if (result.success) {
      res.json({
        success: true,
        data: result.data,
        timestamp: new Date()
      } as ApiResponse)
    } else {
      res.status(400).json({
        success: false,
        error: result.error?.message || 'Failed to update user',
        timestamp: new Date()
      } as ApiResponse)
    }
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Internal server error',
      timestamp: new Date()
    } as ApiResponse)
  }
})

/**
 * Удаление пользователя
 */
app.delete('/api/users/:id', requireSDK, authenticate, async (req, res) => {
  try {
    const { id } = req.params

    const result = await req.sdk.collections.delete('users', id)

    if (result.success) {
      res.json({
        success: true,
        data: { deleted: true },
        timestamp: new Date()
      } as ApiResponse)
    } else {
      res.status(400).json({
        success: false,
        error: result.error?.message || 'Failed to delete user',
        timestamp: new Date()
      } as ApiResponse)
    }
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Internal server error',
      timestamp: new Date()
    } as ApiResponse)
  }
})

/**
 * Загрузка файла
 */
app.post('/api/files/upload', requireSDK, authenticate, async (req, res) => {
  try {
    // В реальном приложении здесь была бы обработка multipart/form-data
    const { filename, content, metadata } = req.body

    const result = await req.sdk.files.upload({
      filename,
      content: Buffer.from(content, 'base64'),
      metadata: {
        ...metadata,
        uploadedBy: req.user?.id,
        uploadedAt: new Date()
      }
    })

    if (result.success) {
      res.json({
        success: true,
        data: result.data,
        timestamp: new Date()
      } as ApiResponse)
    } else {
      res.status(400).json({
        success: false,
        error: result.error?.message || 'Failed to upload file',
        timestamp: new Date()
      } as ApiResponse)
    }
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Internal server error',
      timestamp: new Date()
    } as ApiResponse)
  }
})

/**
 * Получение статистики SDK
 */
app.get('/api/sdk/stats', requireSDK, authenticate, async (req, res) => {
  try {
    const stats = await req.sdk.getStats()

    res.json({
      success: true,
      data: stats,
      timestamp: new Date()
    } as ApiResponse)
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Failed to get SDK stats',
      timestamp: new Date()
    } as ApiResponse)
  }
})

/**
 * WebSocket для real-time обновлений
 */
import { createServer } from 'http'
// @ts-ignore - Optional dependency for example
import { Server as SocketIOServer } from 'socket.io'

const server = createServer(app)
const io = new SocketIOServer(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"]
  }
})

// Обработка WebSocket соединений
io.on('connection', (socket) => {
  console.log('🔌 Client connected:', socket.id)

  // Аутентификация через WebSocket
  socket.on('authenticate', async (token) => {
    try {
      const sdk = sdkManager.getSDK()
      const result = await sdk.authenticate({
        method: 'token',
        credentials: { token }
      })

      if (result.success) {
        socket.data.user = result.data
        socket.emit('authenticated', result.data)

        // Подписка на обновления пользователя
        const subscriptionResult = await sdk.subscriptions.subscribe('users', {
          filter: { id: result.data.id },
          events: ['update', 'delete']
        })

        if (subscriptionResult.success) {
          socket.data.subscriptionId = subscriptionResult.data?.subscriptionId
        }
      } else {
        socket.emit('auth_error', { error: 'Invalid token' })
      }
    } catch (error) {
      socket.emit('auth_error', { error: 'Authentication failed' })
    }
  })

  // Подписка на коллекцию
  socket.on('subscribe', async (data) => {
    if (!socket.data.user) {
      socket.emit('error', { error: 'Not authenticated' })
      return
    }

    try {
      const sdk = sdkManager.getSDK()
      const result = await sdk.subscriptions.subscribe(data.collection, {
        filter: data.filter,
        events: data.events || ['create', 'update', 'delete']
      })

      if (result.success) {
        socket.emit('subscribed', { subscriptionId: result.data?.subscriptionId })
      } else {
        socket.emit('subscription_error', { error: result.error?.message })
      }
    } catch (error) {
      socket.emit('subscription_error', { error: 'Subscription failed' })
    }
  })

  socket.on('disconnect', async () => {
    console.log('🔌 Client disconnected:', socket.id)

    // Отписка от подписок
    if (socket.data.subscriptionId) {
      try {
        const sdk = sdkManager.getSDK()
        await sdk.subscriptions.unsubscribe(socket.data.subscriptionId)
      } catch (error) {
        console.error('Failed to unsubscribe:', error)
      }
    }
  })
})

// Обработка событий SDK для WebSocket
const setupSDKWebSocketIntegration = () => {
  const sdk = sdkManager.getSDK()

  sdk.addEventListener('subscription_event', (event) => {
    // Отправка события всем подключенным клиентам
    io.emit('data_update', {
      collection: event.data.collection,
      type: event.data.type,
      data: event.data.data,
      timestamp: new Date()
    })
  })
}

// Обработка ошибок
app.use((error: Error, req: express.Request, res: express.Response, next: express.NextFunction) => {
  console.error('💥 Unhandled error:', error)

  res.status(500).json({
    success: false,
    error: 'Internal server error',
    timestamp: new Date()
  } as ApiResponse)
})

// Graceful shutdown
const gracefulShutdown = async () => {
  console.log('🛑 Shutting down gracefully...')

  try {
    await sdkManager.shutdown()
    server.close(() => {
      console.log('✅ Server closed')
      process.exit(0)
    })
  } catch (error) {
    console.error('❌ Error during shutdown:', error)
    process.exit(1)
  }
}

process.on('SIGTERM', gracefulShutdown)
process.on('SIGINT', gracefulShutdown)

// Запуск сервера
const PORT = process.env.PORT || 4000

const startServer = async () => {
  try {
    // Инициализация SDK
    await sdkManager.initialize()

    // Настройка WebSocket интеграции
    setupSDKWebSocketIntegration()

    // Запуск сервера
    server.listen(PORT, () => {
      console.log(`🚀 Server running on port ${PORT}`)
      console.log(`📊 Status: http://localhost:${PORT}/api/status`)
    })
  } catch (error) {
    console.error('❌ Failed to start server:', error)
    process.exit(1)
  }
}

// Экспорт для тестирования
export {
  app,
  sdkManager,
  NodeSDKManager
}

// Запуск если файл выполняется напрямую
if (require.main === module) {
  startServer()
}