# 🌐 Руководство по использованию globalThis и моков для Browser APIs

## 📋 **Проблема**

При разработке offline-first приложений возникает проблема совместимости browser APIs (`window`, `navigator`, `fetch`) с Node.js окружением для тестирования.

**Ошибки:**
- `ReferenceError: window is not defined`
- `ReferenceError: navigator is not defined`
- `ReferenceError: fetch is not defined`

---

## ✅ **Решение: globalThis + Моки**

### **1. Использование globalThis вместо прямого обращения к browser APIs**

#### ❌ **Проблемный код:**
```typescript
// Прямое использование browser APIs
class NetworkDetector {
  constructor() {
    window.addEventListener('online', this.handleOnline);
    this.isOnline = navigator.onLine;
  }

  private isBrowserEnvironment(): boolean {
    return typeof window !== 'undefined' && typeof navigator !== 'undefined';
  }
}
```

#### ✅ **Исправленный код:**
```typescript
// Использование globalThis для универсального доступа
class NetworkDetector {
  constructor() {
    if (this.isBrowserEnvironment()) {
      (globalThis as any).window?.addEventListener('online', this.handleOnline);
    }
    this.isOnline = this.isBrowserEnvironment() ?
      (globalThis as any).navigator?.onLine || false : false;
  }

  private isBrowserEnvironment(): boolean {
    return typeof globalThis !== 'undefined' &&
           typeof (globalThis as any).window !== 'undefined' &&
           typeof (globalThis as any).navigator !== 'undefined';
  }
}
```

### **2. Создание моков для тестирования**

#### **Базовый класс для моков:**
```typescript
class BrowserAPIMocks {
  private originalGlobalThis: any;

  setupBrowserEnvironment() {
    this.originalGlobalThis = { ...globalThis };

    // Mock window
    (globalThis as any).window = {
      addEventListener: jest.fn(),
      removeEventListener: jest.fn(),
      location: { href: 'https://example.com' }
    };

    // Mock navigator
    (globalThis as any).navigator = {
      onLine: true,
      userAgent: 'Mozilla/5.0 (Test Environment)',
      connection: {
        effectiveType: '4g',
        addEventListener: jest.fn()
      }
    };

    // Mock fetch
    (globalThis as any).fetch = jest.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({}),
      text: async () => 'OK'
    });

    // Mock AbortController
    (globalThis as any).AbortController = class MockAbortController {
      signal = { aborted: false };
      abort() { this.signal.aborted = true; }
    };
  }

  setupNodeEnvironment() {
    this.originalGlobalThis = { ...globalThis };

    // Remove browser APIs to simulate Node.js
    delete (globalThis as any).window;
    delete (globalThis as any).navigator;
    delete (globalThis as any).fetch;
    delete (globalThis as any).AbortController;
  }

  cleanup() {
    // Restore original globalThis
    Object.keys(globalThis).forEach(key => {
      if (!(key in this.originalGlobalThis)) {
        delete (globalThis as any)[key];
      }
    });
    Object.assign(globalThis, this.originalGlobalThis);
  }
}
```

### **3. Использование в тестах**

#### **Пример теста с моками:**
```typescript
describe('NetworkDetector', () => {
  let mocks: BrowserAPIMocks;
  let detector: NetworkDetector;

  beforeEach(() => {
    mocks = new BrowserAPIMocks();
  });

  afterEach(() => {
    mocks.cleanup();
  });

  describe('Browser Environment', () => {
    beforeEach(() => {
      mocks.setupBrowserEnvironment();
      detector = new NetworkDetector();
    });

    it('should work in browser environment', async () => {
      expect(() => detector).not.toThrow();

      await detector.initialize({
        enabled: true,
        checkInterval: 1000,
        timeoutDuration: 5000,
        testUrls: ['https://example.com/test'],
        qualityTestEnabled: true,
        bandwidthTestEnabled: false,
        latencyTestEnabled: true
      });

      const networkInfo = await detector.getNetworkInfo();
      expect(networkInfo.isOnline).toBe(true);
    });

    it('should handle online/offline events', async () => {
      let eventTriggered = false;
      detector.addEventListener('network-changed', () => {
        eventTriggered = true;
      });

      // Simulate online event
      const mockWindow = (globalThis as any).window;
      const onlineHandler = mockWindow.addEventListener.mock.calls
        .find(call => call[0] === 'online')?.[1];

      if (onlineHandler) {
        onlineHandler();
      }

      expect(eventTriggered).toBe(true);
    });
  });

  describe('Node.js Environment', () => {
    beforeEach(() => {
      mocks.setupNodeEnvironment();
      detector = new NetworkDetector();
    });

    it('should work in Node.js environment', async () => {
      expect(() => detector).not.toThrow();

      const networkInfo = await detector.getNetworkInfo();
      expect(networkInfo.isOnline).toBe(false);
      expect(networkInfo.quality).toBe('offline');
    });
  });
});
```

---

## 🔧 **Паттерны для разных Browser APIs**

### **1. Window API**
```typescript
// Environment detection
private hasWindow(): boolean {
  return typeof globalThis !== 'undefined' &&
         typeof (globalThis as any).window !== 'undefined';
}

// Safe usage
private addWindowListener(event: string, handler: () => void): void {
  if (this.hasWindow()) {
    (globalThis as any).window.addEventListener(event, handler);
  }
}
```

### **2. Navigator API**
```typescript
// Safe navigator access
private getNavigatorProperty<T>(property: string, fallback: T): T {
  if (typeof globalThis !== 'undefined' &&
      (globalThis as any).navigator) {
    return (globalThis as any).navigator[property] ?? fallback;
  }
  return fallback;
}

// Usage
const isOnline = this.getNavigatorProperty('onLine', false);
const userAgent = this.getNavigatorProperty('userAgent', 'Unknown');
```

### **3. Fetch API**
```typescript
// Safe fetch with fallback
private async safeFetch(url: string, options?: RequestInit): Promise<Response | null> {
  if (typeof globalThis !== 'undefined' &&
      typeof (globalThis as any).fetch === 'function') {
    try {
      return await (globalThis as any).fetch(url, options);
    } catch (error) {
      console.warn('Fetch failed:', error);
      return null;
    }
  }

  // Fallback for Node.js environment
  console.warn('Fetch not available in this environment');
  return null;
}
```

### **4. IndexedDB API**
```typescript
// Safe IndexedDB access (как в LocalDataCache)
private hasIndexedDB(): boolean {
  return typeof globalThis !== 'undefined' &&
         typeof (globalThis as any).indexedDB !== 'undefined';
}

private async initializeIndexedDB(): Promise<void> {
  if (!this.hasIndexedDB()) {
    throw new Error('IndexedDB not supported in this environment');
  }

  const request = (globalThis as any).indexedDB.open(this.dbName, this.dbVersion);
  // ... rest of implementation
}
```

---

## 🧪 **Стратегии тестирования**

### **1. Условное выполнение тестов**
```typescript
describe('Browser-specific features', () => {
  const isBrowser = typeof globalThis !== 'undefined' &&
                   typeof (globalThis as any).window !== 'undefined';

  (isBrowser ? it : it.skip)('should work with real browser APIs', () => {
    // Test only runs in browser environment
  });
});
```

### **2. Моки с реалистичным поведением**
```typescript
// Mock с асинхронным поведением
(globalThis as any).fetch = jest.fn().mockImplementation(async (url: string) => {
  // Simulate network latency
  await new Promise(resolve => setTimeout(resolve, 50));

  if (url.includes('error')) {
    throw new Error('Network error');
  }

  return {
    ok: true,
    status: 200,
    json: async () => ({ success: true }),
    text: async () => 'OK'
  };
});
```

### **3. Изоляция тестов**
```typescript
describe('NetworkDetector', () => {
  let originalGlobalThis: any;

  beforeEach(() => {
    // Save original state
    originalGlobalThis = { ...globalThis };
  });

  afterEach(() => {
    // Restore original state
    Object.keys(globalThis).forEach(key => {
      if (!(key in originalGlobalThis)) {
        delete (globalThis as any)[key];
      }
    });
    Object.assign(globalThis, originalGlobalThis);
  });
});
```

---

## 📊 **Преимущества подхода**

### ✅ **Универсальность**
- Код работает и в браузере, и в Node.js
- Единый API для всех окружений
- Graceful degradation при отсутствии APIs

### ✅ **Тестируемость**
- Полный контроль над browser APIs в тестах
- Возможность симуляции различных сценариев
- Изоляция тестов друг от друга

### ✅ **Безопасность**
- Нет runtime ошибок при отсутствии APIs
- Явные проверки окружения
- Fallback значения для всех случаев

### ✅ **Производительность**
- Минимальный overhead для проверок
- Ленивая инициализация browser APIs
- Кэширование результатов проверок

---

## 🚀 **Применение к NetworkDetector**

### **Основные изменения:**
1. ✅ Заменить `window` → `(globalThis as any).window`
2. ✅ Заменить `navigator` → `(globalThis as any).navigator`
3. ✅ Заменить `fetch` → `(globalThis as any).fetch`
4. ✅ Добавить проверки окружения во все методы
5. ✅ Создать comprehensive test suite с моками

### **Результат:**
- ❌ `ReferenceError: window is not defined` → ✅ Graceful fallback
- ❌ Падающие тесты → ✅ 100% pass rate
- ❌ Browser-only код → ✅ Universal compatibility

---

**Статус:** ✅ Готово к реализации
**Приоритет:** CRITICAL
**Время реализации:** 2-3 часа