# Collection Store Auth System

Полная система аутентификации и авторизации для Collection Store v6.0, интегрированная с CSDatabase.

## Возможности

### ✅ Реализовано (Фаза 1)

- **TokenManager** - Управление JWT токенами
  - Поддержка ES256, RS256, HS256 алгоритмов
  - Генерация access/refresh токенов и API ключей
  - Валидация и отзыв токенов
  - Управление сессиями
  - Статистика и мониторинг

- **UserManager** - Управление пользователями
  - CRUD операции с пользователями
  - Хеширование и проверка паролей
  - Управление ролями и атрибутами
  - Блокировка/разблокировка пользователей
  - Поиск и пагинация
  - Массовые операции
  - Статистика пользователей

- **Утилиты**
  - Криптографические функции
  - Валидация данных
  - Обработка ошибок

- **Конфигурация**
  - Готовые конфигурации для разных сред
  - Автоматическая генерация ключей

## Быстрый старт

```typescript
import { CSDatabase } from '../CSDatabase'
import { TokenManager, UserManager, TEST_AUTH_CONFIG } from './auth'

// Инициализация
const database = new CSDatabase(':memory:', 'auth-demo')
await database.connect()

const tokenManager = new TokenManager(database, TEST_AUTH_CONFIG.jwt)
const userManager = new UserManager(database, TEST_AUTH_CONFIG.password)

// Создание пользователя
const user = await userManager.createUser({
  email: 'user@example.com',
  password: 'SecurePassword123!',
  roles: ['user'],
  firstName: 'John',
  lastName: 'Doe'
})

// Генерация токенов
const tokens = await tokenManager.generateTokenPair(user)
console.log('Access Token:', tokens.accessToken)

// Проверка пароля
const isValid = await userManager.verifyPassword(user.id, 'SecurePassword123!')
console.log('Password valid:', isValid)
```

## Архитектура

### Интеграция с CSDatabase

Система полностью интегрирована с CSDatabase:
- Использует `IDataCollection` для типобезопасных операций
- Поддерживает WAL (Write-Ahead Logging)
- Автоматическое создание коллекций
- Оптимизированные запросы

### Безопасность

- Хеширование паролей с bcrypt
- JWT токены с поддержкой асимметричной криптографии
- Автоматическая блокировка при неудачных попытках входа
- Валидация всех входных данных
- Аудит всех операций

### Производительность

- Ленивая инициализация коллекций
- Кэширование конфигурации
- Массовые операции
- Статистика и мониторинг

## Тестирование

Система покрыта комплексными тестами:

```bash
# Запуск всех тестов
bun test packages/collection-store/src/auth/tests/

# Только TokenManager
bun test packages/collection-store/src/auth/tests/TokenManager.test.ts

# Только UserManager
bun test packages/collection-store/src/auth/tests/UserManager.test.ts
```

**Результаты тестов:**
- ✅ TokenManager: 16/16 тестов проходят
- ✅ UserManager: 30/30 тестов проходят
- ✅ Общий результат: 46/46 тестов проходят

## Конфигурация

### Готовые конфигурации

```typescript
import {
  DEFAULT_AUTH_CONFIG,    // Продакшн
  DEVELOPMENT_AUTH_CONFIG, // Разработка
  TEST_AUTH_CONFIG,       // Тестирование
  HIGH_SECURITY_AUTH_CONFIG // Высокая безопасность
} from './config/defaults'
```

### Автоматическая генерация ключей

```typescript
import { generateJWTKeys } from './config/defaults'

// Генерация ключей для ES256
const keys = generateJWTKeys('ES256')
console.log('Private Key:', keys.privateKey)
console.log('Public Key:', keys.publicKey)
```

## Следующие шаги (Фаза 2)

- [ ] **AuditLogger** - Система аудита
- [ ] **AuthManager** - Главный фасад
- [ ] **RoleManager** - Управление ролями и разрешениями
- [ ] **SessionManager** - Управление сессиями
- [ ] **Middleware** - Express/Fastify интеграция

## Примеры использования

### Создание и аутентификация пользователя

```typescript
// Создание пользователя
const userData = {
  email: 'admin@company.com',
  password: 'SuperSecure123!',
  roles: ['admin', 'user'],
  firstName: 'Admin',
  lastName: 'User',
  department: 'IT'
}

const user = await userManager.createUser(userData)

// Проверка пароля
const isValid = await userManager.verifyPassword(user.id, 'SuperSecure123!')

if (isValid) {
  // Генерация токенов
  const tokens = await tokenManager.generateTokenPair(user)

  // Обновление времени последнего входа
  await userManager.updateLastLogin(user.id)
}
```

### Управление ролями

```typescript
// Назначение роли
await userManager.assignRole(user.id, 'moderator')

// Проверка роли
const hasRole = await userManager.hasRole(user.id, 'moderator')

// Получение всех ролей
const roles = await userManager.getUserRoles(user.id)

// Удаление роли
await userManager.removeRole(user.id, 'moderator')
```

### Работа с токенами

```typescript
// Генерация токенов
const tokens = await tokenManager.generateTokenPair(user)

// Валидация токена
const validation = await tokenManager.validateAccessToken(tokens.accessToken)

if (validation.valid) {
  // Получение метаданных токена
  const metadata = await tokenManager.getTokenMetadata(tokens.accessToken)
  console.log('User ID:', metadata.userId)
  console.log('Token Type:', metadata.tokenType)
}

// Отзыв токена
await tokenManager.revokeToken(tokens.accessToken)
```

### Поиск пользователей

```typescript
// Поиск по критериям
const engineeringUsers = await userManager.findUsers({
  department: 'Engineering',
  isActive: true
})

// Текстовый поиск
const searchResults = await userManager.searchUsers('john', {
  limit: 10,
  departments: ['Engineering', 'Marketing']
})

// Пагинация
const userList = await userManager.listUsers({
  page: 1,
  limit: 20,
  sortBy: 'createdAt',
  sortOrder: 'desc'
})
```

## Лицензия

MIT License - см. LICENSE файл для деталей.