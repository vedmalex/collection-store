/**
 * Bun Test Utilities
 * Provides compatibility layer for Bun test framework
 * Replaces Jest/Vitest specific functionality
 */

import { mock } from "bun:test";

// Type definitions for better TypeScript support
export interface BunSpyInstance<T = any> {
  mockReturnValue: (value: T) => BunSpyInstance<T>;
  mockResolvedValue: (value: T) => BunSpyInstance<T>;
  mockRejectedValue: (error: any) => BunSpyInstance<T>;
  mockImplementation: (fn: (...args: any[]) => T) => BunSpyInstance<T>;
  restore: () => void;
  mockClear: () => void;
  mockReset: () => void;
}

export interface BunMockUtils {
  spyOn: <T extends object, K extends keyof T>(
    obj: T,
    method: K
  ) => BunSpyInstance<T[K]>;
}

/**
 * Creates Bun-compatible mock utilities
 * Replaces mock.spyOn functionality for Bun test framework
 */
export const createBunMocks = (): BunMockUtils => {
  const spyOn = <T extends object, K extends keyof T>(
    obj: T,
    method: K
  ): BunSpyInstance<T[K]> => {
    const original = obj[method];
    const mockFn = mock(() => {}) as any;

    // Replace the method with our mock
    obj[method] = mockFn as T[K];

    return {
      mockReturnValue: (value: any) => {
        if (mockFn.mockReturnValue) {
          mockFn.mockReturnValue(value);
        }
        return spyOn(obj, method);
      },
      mockResolvedValue: (value: any) => {
        if (mockFn.mockResolvedValue) {
          mockFn.mockResolvedValue(value);
        }
        return spyOn(obj, method);
      },
      mockRejectedValue: (error: any) => {
        if (mockFn.mockRejectedValue) {
          mockFn.mockRejectedValue(error);
        }
        return spyOn(obj, method);
      },
      mockImplementation: (fn: any) => {
        if (mockFn.mockImplementation) {
          mockFn.mockImplementation(fn);
        }
        return spyOn(obj, method);
      },
      restore: () => {
        obj[method] = original;
      },
      mockClear: () => {
        if (mockFn.mockClear) {
          mockFn.mockClear();
        }
      },
      mockReset: () => {
        if (mockFn.mockReset) {
          mockFn.mockReset();
        }
      }
    };
  };

  return { spyOn };
};

/**
 * Creates IndexedDB mock for Bun test environment
 * Provides comprehensive IndexedDB API simulation
 */
export const createIndexedDBMock = () => {
  // Mock IDBRequest
  const createMockRequest = () => ({
    result: null,
    error: null,
    source: null,
    transaction: null,
    readyState: 'pending',

    // Event handlers
    onsuccess: null as ((event: any) => void) | null,
    onerror: null as ((event: any) => void) | null,

    addEventListener: mock(() => {}) as any,
    removeEventListener: mock(() => {}) as any,
    dispatchEvent: mock(() => true) as any
  });

  // Mock IDBObjectStore
  const createMockObjectStore = (name: string) => ({
    name,
    keyPath: null,
    indexNames: [],
    transaction: null,
    autoIncrement: false,

    // CRUD operations
    add: mock((value: any, key?: any) => {
      const request = createMockRequest();
      setTimeout(() => {
        if (request.onsuccess) {
          request.onsuccess({ target: { result: key || Date.now() } } as any);
        }
      }, 0);
      return request;
    }) as any,

    put: mock((value: any, key?: any) => {
      const request = createMockRequest();
      setTimeout(() => {
        if (request.onsuccess) {
          request.onsuccess({ target: { result: key || Date.now() } } as any);
        }
      }, 0);
      return request;
    }) as any,

    get: mock((key: any) => {
      const request = createMockRequest();
      setTimeout(() => {
        if (request.onsuccess) {
          request.onsuccess({ target: { result: { id: key, data: 'mock-data' } } } as any);
        }
      }, 0);
      return request;
    }) as any,

    delete: mock((key: any) => {
      const request = createMockRequest();
      setTimeout(() => {
        if (request.onsuccess) {
          request.onsuccess({ target: { result: undefined } } as any);
        }
      }, 0);
      return request;
    }) as any,

    clear: mock(() => {
      const request = createMockRequest();
      setTimeout(() => {
        if (request.onsuccess) {
          request.onsuccess({ target: { result: undefined } } as any);
        }
      }, 0);
      return request;
    }) as any,

    count: mock(() => {
      const request = createMockRequest();
      setTimeout(() => {
        if (request.onsuccess) {
          request.onsuccess({ target: { result: 0 } } as any);
        }
      }, 0);
      return request;
    }) as any,

    // Index operations
    createIndex: mock((name: string, keyPath: string | string[], options?: any) => {
      return createMockIndex(name, keyPath);
    }) as any,

    index: mock((name: string) => {
      return createMockIndex(name, 'id');
    }) as any,

    deleteIndex: mock((name: string) => {
      // No-op for mock
    }) as any
  });

  // Mock IDBIndex
  const createMockIndex = (name: string, keyPath: string | string[]) => ({
    name,
    keyPath,
    objectStore: null,
    unique: false,
    multiEntry: false,

    get: mock((key: any) => {
      const request = createMockRequest();
      setTimeout(() => {
        if (request.onsuccess) {
          request.onsuccess({ target: { result: { id: key, data: 'mock-index-data' } } } as any);
        }
      }, 0);
      return request;
    }) as any,

    count: mock(() => {
      const request = createMockRequest();
      setTimeout(() => {
        if (request.onsuccess) {
          request.onsuccess({ target: { result: 0 } } as any);
        }
      }, 0);
      return request;
    }) as any
  });

  // Mock IDBTransaction
  const createMockTransaction = (storeNames: string[], mode: string = 'readonly') => ({
    objectStoreNames: storeNames,
    mode,
    db: null,
    error: null,

    objectStore: mock((name: string) => {
      return createMockObjectStore(name);
    }) as any,

    abort: mock(() => {
      // No-op for mock
    }) as any,

    // Event handlers
    oncomplete: null,
    onerror: null,
    onabort: null,

    addEventListener: mock(() => {}) as any,
    removeEventListener: mock(() => {}) as any,
    dispatchEvent: mock(() => true) as any
  });

  // Mock IDBDatabase
  const createMockDatabase = (name: string, version: number) => ({
    name,
    version,
    objectStoreNames: [],

    createObjectStore: mock((name: string, options?: any) => {
      return createMockObjectStore(name);
    }) as any,

    deleteObjectStore: mock((name: string) => {
      // No-op for mock
    }) as any,

    transaction: mock((storeNames: string | string[], mode?: string) => {
      const names = Array.isArray(storeNames) ? storeNames : [storeNames];
      return createMockTransaction(names, mode);
    }) as any,

    close: mock(() => {
      // No-op for mock
    }) as any,

    // Event handlers
    onabort: null,
    onclose: null,
    onerror: null,
    onversionchange: null,

    addEventListener: mock(() => {}) as any,
    removeEventListener: mock(() => {}) as any,
    dispatchEvent: mock(() => true) as any
  });

  // Mock IDBOpenDBRequest
  const createMockOpenRequest = (name: string, version?: number) => {
    const request = {
      result: null as any,
      error: null,
      source: null,
      transaction: null,
      readyState: 'pending',

      // Event handlers
      onsuccess: null as ((event: any) => void) | null,
      onerror: null as ((event: any) => void) | null,
      onblocked: null as ((event: any) => void) | null,
      onupgradeneeded: null as ((event: any) => void) | null,

      addEventListener: mock(() => {}) as any,
      removeEventListener: mock(() => {}) as any,
      dispatchEvent: mock(() => true) as any
    };

    // Simulate successful database opening
    setTimeout(() => {
      const db = createMockDatabase(name, version || 1);
      request.result = db;
      request.readyState = 'done';

      if (request.onsuccess) {
        request.onsuccess({ target: { result: db } } as any);
      }
    }, 0);

    return request;
  };

  // Main IndexedDB mock object
  return {
    open: mock((name: string, version?: number) => {
      return createMockOpenRequest(name, version);
    }) as any,

    deleteDatabase: mock((name: string) => {
      const request = createMockRequest();
      setTimeout(() => {
        if (request.onsuccess) {
          request.onsuccess({ target: { result: undefined } } as any);
        }
      }, 0);
      return request;
    }) as any,

    databases: mock(async () => {
      return [];
    }) as any,

    cmp: mock((first: any, second: any) => {
      if (first < second) return -1;
      if (first > second) return 1;
      return 0;
    }) as any
  };
};

/**
 * Sets up global IndexedDB mock for tests
 * Call this in beforeEach or test setup
 */
export const setupIndexedDBMock = () => {
  const mockIndexedDB = createIndexedDBMock();

  // Set global IndexedDB
  (globalThis as any).indexedDB = mockIndexedDB;
  (globalThis as any).IDBKeyRange = {
    bound: mock((lower: any, upper: any, lowerOpen?: boolean, upperOpen?: boolean) => ({
      lower, upper, lowerOpen: !!lowerOpen, upperOpen: !!upperOpen
    })) as any,
    only: mock((value: any) => ({ lower: value, upper: value, lowerOpen: false, upperOpen: false })) as any,
    lowerBound: mock((bound: any, open?: boolean) => ({ lower: bound, lowerOpen: !!open })) as any,
    upperBound: mock((bound: any, open?: boolean) => ({ upper: bound, upperOpen: !!open })) as any
  };

  return mockIndexedDB;
};

/**
 * Cleans up IndexedDB mock after tests
 * Call this in afterEach or test cleanup
 */
export const cleanupIndexedDBMock = () => {
  delete (globalThis as any).indexedDB;
  delete (globalThis as any).IDBKeyRange;
  mock.restore();
};

/**
 * Creates test data helpers for consistent test data generation
 */
export const createTestDataHelpers = () => {
  return {
    createTestUser: (id: string = 'test-user-1') => ({
      id,
      name: `Test User ${id}`,
      email: `${id}@test.com`,
      createdAt: new Date().toISOString()
    }),

    createTestCollection: (name: string = 'test-collection') => ({
      name,
      schema: {
        type: 'object',
        properties: {
          id: { type: 'string' },
          name: { type: 'string' },
          email: { type: 'string' }
        }
      },
      options: {
        timestamps: true,
        validation: true
      }
    }),

    createTestDocument: (id: string = 'test-doc-1') => ({
      id,
      data: { name: 'Test Document', value: 42 },
      metadata: {
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      }
    })
  };
};

// Export all utilities
export default {
  createBunMocks,
  createIndexedDBMock,
  setupIndexedDBMock,
  cleanupIndexedDBMock,
  createTestDataHelpers
};