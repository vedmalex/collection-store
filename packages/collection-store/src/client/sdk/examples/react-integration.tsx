/**
 * Phase 5: Client Integration - React Integration Example
 *
 * Пример интеграции Client SDK с React приложением
 */

import React, { useState, useEffect, useCallback, useContext, createContext } from 'react'
import { ClientSDK } from '../core/ClientSDK'
import { ClientSDKConfig, SDKResult } from '../interfaces/IClientSDK'

// Типы для React компонентов
interface User {
  id: string
  name: string
  email: string
  avatar?: string
}

interface Todo {
  id: string
  title: string
  completed: boolean
  userId: string
  createdAt: Date
  updatedAt: Date
}

interface SDKContextType {
  sdk: ClientSDK | null
  isConnected: boolean
  currentUser: User | null
  error: string | null
}

// Context для SDK
const SDKContext = createContext<SDKContextType>({
  sdk: null,
  isConnected: false,
  currentUser: null,
  error: null
})

// Provider компонент для SDK
export const SDKProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [sdk, setSdk] = useState<ClientSDK | null>(null)
  const [isConnected, setIsConnected] = useState(false)
  const [currentUser, setCurrentUser] = useState<User | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const initSDK = async () => {
      try {
        const config: ClientSDKConfig = {
          baseUrl: process.env.REACT_APP_API_URL || 'http://localhost:3000',
          apiKey: process.env.REACT_APP_API_KEY || 'demo-key',
          timeout: 10000,
          retries: 3,
          cache: {
            enabled: true,
            maxSize: 1000,
            ttl: 300000, // 5 minutes
            strategy: 'lru',
            compression: true
          },
          logging: {
            enabled: true,
            level: 'info'
          }
        }

        const clientSDK = new ClientSDK(config)

        // Подписка на события
        clientSDK.addEventListener('sdk_connected', () => {
          setIsConnected(true)
          setError(null)
        })

        clientSDK.addEventListener('sdk_disconnected', () => {
          setIsConnected(false)
        })

        clientSDK.addEventListener('sdk_error', (event) => {
          setError(event.data.error.message)
        })

        clientSDK.addEventListener('auth_success', (event) => {
          setCurrentUser(event.data.user)
        })

        clientSDK.addEventListener('auth_logout', () => {
          setCurrentUser(null)
        })

        // Инициализация и подключение
        await clientSDK.initialize()
        await clientSDK.connect()

        setSdk(clientSDK)
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to initialize SDK')
      }
    }

    initSDK()

    // Cleanup при размонтировании
    return () => {
      if (sdk) {
        sdk.shutdown()
      }
    }
  }, [])

  return (
    <SDKContext.Provider value={{ sdk, isConnected, currentUser, error }}>
      {children}
    </SDKContext.Provider>
  )
}

// Hook для использования SDK
export const useSDK = () => {
  const context = useContext(SDKContext)
  if (!context) {
    throw new Error('useSDK must be used within SDKProvider')
  }
  return context
}

// Hook для аутентификации
export const useAuth = () => {
  const { sdk, currentUser } = useSDK()

  const login = useCallback(async (email: string, password: string): Promise<SDKResult<User>> => {
    if (!sdk) {
      return { success: false, error: new Error('SDK not initialized') }
    }

    return await sdk.authenticate({
      method: 'password',
      credentials: { email, password }
    })
  }, [sdk])

  const logout = useCallback(async (): Promise<SDKResult<void>> => {
    if (!sdk) {
      return { success: false, error: new Error('SDK not initialized') }
    }

    return await sdk.logout()
  }, [sdk])

  const register = useCallback(async (userData: Omit<User, 'id'>): Promise<SDKResult<User>> => {
    if (!sdk) {
      return { success: false, error: new Error('SDK not initialized') }
    }

    return await sdk.collections.create('users', userData)
  }, [sdk])

  return {
    user: currentUser,
    isAuthenticated: !!currentUser,
    login,
    logout,
    register
  }
}

// Hook для работы с коллекциями
export const useCollection = <T = any>(collectionName: string) => {
  const { sdk } = useSDK()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const find = useCallback(async (options?: any) => {
    if (!sdk) return { success: false, error: new Error('SDK not initialized') }

    setLoading(true)
    setError(null)

    try {
      const result = await sdk.collections.find(collectionName, options)
      return result
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error'
      setError(errorMessage)
      return { success: false, error: new Error(errorMessage) }
    } finally {
      setLoading(false)
    }
  }, [sdk, collectionName])

  const create = useCallback(async (data: Omit<T, 'id'>) => {
    if (!sdk) return { success: false, error: new Error('SDK not initialized') }

    setLoading(true)
    setError(null)

    try {
      const result = await sdk.collections.create(collectionName, data)
      return result
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error'
      setError(errorMessage)
      return { success: false, error: new Error(errorMessage) }
    } finally {
      setLoading(false)
    }
  }, [sdk, collectionName])

  const update = useCallback(async (id: string, data: Partial<T>) => {
    if (!sdk) return { success: false, error: new Error('SDK not initialized') }

    setLoading(true)
    setError(null)

    try {
      const result = await sdk.collections.update(collectionName, id, data)
      return result
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error'
      setError(errorMessage)
      return { success: false, error: new Error(errorMessage) }
    } finally {
      setLoading(false)
    }
  }, [sdk, collectionName])

  const remove = useCallback(async (id: string) => {
    if (!sdk) return { success: false, error: new Error('SDK not initialized') }

    setLoading(true)
    setError(null)

    try {
      const result = await sdk.collections.delete(collectionName, id)
      return result
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error'
      setError(errorMessage)
      return { success: false, error: new Error(errorMessage) }
    } finally {
      setLoading(false)
    }
  }, [sdk, collectionName])

  return {
    find,
    create,
    update,
    remove,
    loading,
    error
  }
}

// Hook для real-time подписок
export const useSubscription = <T = any>(collectionName: string, filter?: any) => {
  const { sdk } = useSDK()
  const [data, setData] = useState<T[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!sdk) return

    let subscriptionId: string | null = null

    const setupSubscription = async () => {
      try {
        const result = await sdk.subscriptions.subscribe(collectionName, {
          filter,
          events: ['create', 'update', 'delete']
        })

        if (result.success && result.data) {
          subscriptionId = result.data.subscriptionId

          // Обработка событий
          const unsubscribe = sdk.addEventListener('subscription_event', (event) => {
            if (event.data.subscriptionId === subscriptionId) {
              const { type, data: eventData } = event.data

              setData(prevData => {
                switch (type) {
                  case 'create':
                    return [...prevData, eventData]
                  case 'update':
                    return prevData.map(item =>
                      (item as any).id === eventData.id ? { ...item, ...eventData } : item
                    )
                  case 'delete':
                    return prevData.filter(item => (item as any).id !== eventData.id)
                  default:
                    return prevData
                }
              })
            }
          })

          // Загрузка начальных данных
          const initialData = await sdk.collections.find(collectionName, { filter })
          if (initialData.success && initialData.data) {
            setData(initialData.data.items)
          }

          setLoading(false)
          return unsubscribe
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Subscription failed')
        setLoading(false)
      }
    }

    const unsubscribePromise = setupSubscription()

    return () => {
      unsubscribePromise.then(unsubscribe => {
        if (unsubscribe) unsubscribe()
      })

      if (subscriptionId && sdk) {
        sdk.subscriptions.unsubscribe(subscriptionId)
      }
    }
  }, [sdk, collectionName, filter])

  return { data, loading, error }
}

// Компонент для отображения статуса подключения
export const ConnectionStatus: React.FC = () => {
  const { isConnected, error } = useSDK()

  if (error) {
    return (
      <div className="connection-status error">
        <span className="status-indicator error"></span>
        Error: {error}
      </div>
    )
  }

  return (
    <div className={`connection-status ${isConnected ? 'connected' : 'disconnected'}`}>
      <span className={`status-indicator ${isConnected ? 'connected' : 'disconnected'}`}></span>
      {isConnected ? 'Connected' : 'Disconnected'}
    </div>
  )
}

// Компонент для аутентификации
export const LoginForm: React.FC = () => {
  const { login } = useAuth()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError(null)

    const result = await login(email, password)

    if (!result.success) {
      setError(result.error?.message || 'Login failed')
    }

    setLoading(false)
  }

  return (
    <form onSubmit={handleSubmit} className="login-form">
      <div className="form-group">
        <label htmlFor="email">Email:</label>
        <input
          type="email"
          id="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
          disabled={loading}
        />
      </div>

      <div className="form-group">
        <label htmlFor="password">Password:</label>
        <input
          type="password"
          id="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
          disabled={loading}
        />
      </div>

      {error && <div className="error-message">{error}</div>}

      <button type="submit" disabled={loading}>
        {loading ? 'Logging in...' : 'Login'}
      </button>
    </form>
  )
}

// Компонент Todo List с real-time обновлениями
export const TodoList: React.FC = () => {
  const { user } = useAuth()
  const { data: todos, loading, error } = useSubscription<Todo>('todos', { userId: user?.id })
  const { create, update, remove } = useCollection<Todo>('todos')
  const [newTodoTitle, setNewTodoTitle] = useState('')

  const handleAddTodo = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!newTodoTitle.trim() || !user) return

    const result = await create({
      title: newTodoTitle.trim(),
      completed: false,
      userId: user.id,
      createdAt: new Date(),
      updatedAt: new Date()
    })

    if (result.success) {
      setNewTodoTitle('')
    }
  }

  const handleToggleTodo = async (todo: Todo) => {
    await update(todo.id, {
      completed: !todo.completed,
      updatedAt: new Date()
    })
  }

  const handleDeleteTodo = async (todoId: string) => {
    await remove(todoId)
  }

  if (loading) return <div>Loading todos...</div>
  if (error) return <div>Error: {error}</div>

  return (
    <div className="todo-list">
      <h2>My Todos</h2>

      <form onSubmit={handleAddTodo} className="add-todo-form">
        <input
          type="text"
          value={newTodoTitle}
          onChange={(e) => setNewTodoTitle(e.target.value)}
          placeholder="Add new todo..."
          className="todo-input"
        />
        <button type="submit">Add</button>
      </form>

      <div className="todos">
        {todos.map(todo => (
          <div key={todo.id} className={`todo-item ${todo.completed ? 'completed' : ''}`}>
            <input
              type="checkbox"
              checked={todo.completed}
              onChange={() => handleToggleTodo(todo)}
            />
            <span className="todo-title">{todo.title}</span>
            <button
              onClick={() => handleDeleteTodo(todo.id)}
              className="delete-button"
            >
              Delete
            </button>
          </div>
        ))}
      </div>
    </div>
  )
}

// Главный компонент приложения
export const App: React.FC = () => {
  const { user } = useAuth()

  return (
    <div className="app">
      <header className="app-header">
        <h1>Collection Store React App</h1>
        <ConnectionStatus />
      </header>

      <main className="app-main">
        {user ? (
          <div className="authenticated-content">
            <div className="user-info">
              Welcome, {user.name}!
            </div>
            <TodoList />
          </div>
        ) : (
          <div className="unauthenticated-content">
            <h2>Please log in</h2>
            <LoginForm />
          </div>
        )}
      </main>
    </div>
  )
}

// Корневой компонент с Provider
export const AppWithSDK: React.FC = () => {
  return (
    <SDKProvider>
      <App />
    </SDKProvider>
  )
}

export default AppWithSDK