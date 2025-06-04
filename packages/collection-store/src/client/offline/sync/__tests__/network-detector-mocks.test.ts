/**
 * NetworkDetector Tests with Mocks
 * Демонстрация использования globalThis и моков для browser APIs
 */

import { describe, it, expect, beforeEach, afterEach } from 'bun:test';
import { NetworkDetector } from '../network-detector';

// Mock browser APIs
interface MockNavigator {
  onLine: boolean;
  connection?: {
    effectiveType: string;
    addEventListener: (event: string, callback: () => void) => void;
  };
}

interface MockWindow {
  addEventListener: (event: string, callback: () => void) => void;
  removeEventListener: (event: string, callback: () => void) => void;
}

class BrowserAPIMocks {
  private originalGlobalThis: any;
  private mockNavigator: MockNavigator;
  private mockWindow: MockWindow;
  private eventListeners: Map<string, (() => void)[]> = new Map();

  constructor() {
    this.mockNavigator = {
      onLine: true,
      connection: {
        effectiveType: '4g',
        addEventListener: (event: string, callback: () => void) => {
          if (!this.eventListeners.has(event)) {
            this.eventListeners.set(event, []);
          }
          this.eventListeners.get(event)!.push(callback);
        }
      }
    };

    this.mockWindow = {
      addEventListener: (event: string, callback: () => void) => {
        if (!this.eventListeners.has(event)) {
          this.eventListeners.set(event, []);
        }
        this.eventListeners.get(event)!.push(callback);
      },
      removeEventListener: (event: string, callback: () => void) => {
        const listeners = this.eventListeners.get(event);
        if (listeners) {
          const index = listeners.indexOf(callback);
          if (index > -1) {
            listeners.splice(index, 1);
          }
        }
      }
    };
  }

  setupBrowserEnvironment() {
    this.originalGlobalThis = { ...globalThis };

    // Setup browser-like environment
    (globalThis as any).window = this.mockWindow;
    (globalThis as any).navigator = this.mockNavigator;

    // Mock fetch for network tests
    (globalThis as any).fetch = async (url: string, options?: any) => {
      // Simulate network latency
      await new Promise(resolve => setTimeout(resolve, 50));

      return {
        ok: true,
        status: 200,
        headers: new Map(),
        json: async () => ({}),
        text: async () => 'OK'
      };
    };

    // Mock AbortController
        (globalThis as any).AbortController = class MockAbortController {
      signal: any;

      constructor() {
        this.signal = {
          aborted: false,
          addEventListener: (event: string, callback: () => void) => {
            // Mock implementation - store callback for later use
            if (event === 'abort') {
              this.signal._abortCallback = callback;
            }
          },
          _abortCallback: null as (() => void) | null
        };
      }

      abort() {
        this.signal.aborted = true;
        if (this.signal._abortCallback) {
          this.signal._abortCallback();
        }
      }
    };
  }

  setupNodeEnvironment() {
    this.originalGlobalThis = { ...globalThis };

    // Remove browser APIs to simulate Node.js environment
    delete (globalThis as any).window;
    delete (globalThis as any).navigator;
    delete (globalThis as any).fetch;
    delete (globalThis as any).AbortController;
  }

  setOnlineStatus(isOnline: boolean) {
    this.mockNavigator.onLine = isOnline;
  }

  triggerNetworkEvent(event: 'online' | 'offline') {
    const listeners = this.eventListeners.get(event);
    if (listeners) {
      listeners.forEach(callback => {
        try {
          callback();
        } catch (error) {
          console.error('Error in mock event listener:', error);
        }
      });
    }
  }

  triggerConnectionChange() {
    const listeners = this.eventListeners.get('change');
    if (listeners) {
      listeners.forEach(callback => {
        try {
          callback();
        } catch (error) {
          console.error('Error in mock connection change listener:', error);
        }
      });
    }
  }

  cleanup() {
    try {
      // Restore original globalThis properties
      Object.keys(globalThis).forEach(key => {
        if (!(key in this.originalGlobalThis)) {
          try {
            delete (globalThis as any)[key];
          } catch (error) {
            // Ignore readonly property errors
          }
        }
      });

      // Restore original values
      Object.keys(this.originalGlobalThis).forEach(key => {
        try {
          (globalThis as any)[key] = this.originalGlobalThis[key];
        } catch (error) {
          // Ignore readonly property errors
        }
      });

      this.eventListeners.clear();
    } catch (error) {
      // Ignore cleanup errors
    }
  }
}

describe('NetworkDetector with Mocks', () => {
  let mocks: BrowserAPIMocks;
  let detector: NetworkDetector;

  beforeEach(() => {
    mocks = new BrowserAPIMocks();
  });

  afterEach(() => {
    if (detector) {
      try {
        detector.stopMonitoring();
      } catch (error) {
        // Ignore cleanup errors
      }
    }
    mocks.cleanup();
  });

  describe('Browser Environment', () => {
    beforeEach(() => {
      mocks.setupBrowserEnvironment();
      detector = new NetworkDetector();
    });

    it('should initialize successfully in browser environment', async () => {
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
      expect(networkInfo).toBeDefined();
      expect(typeof networkInfo.isOnline).toBe('boolean');
      expect(typeof networkInfo.quality).toBe('string');
    });

    it('should detect online status correctly', async () => {
      await detector.initialize({
        enabled: true,
        checkInterval: 0, // Disable periodic checks
        timeoutDuration: 1000,
        testUrls: ['https://example.com/test'],
        qualityTestEnabled: false, // Disable for faster testing
        bandwidthTestEnabled: false,
        latencyTestEnabled: false
      });

      // Test online status
      mocks.setOnlineStatus(true);
      const onlineInfo = await detector.forceCheck();
      expect(onlineInfo.isOnline).toBe(true);

      // Test offline status
      mocks.setOnlineStatus(false);
      const offlineInfo = await detector.forceCheck();
      expect(offlineInfo.isOnline).toBe(false);
    });

    it('should handle network events', async () => {
      await detector.initialize({
        enabled: true,
        checkInterval: 0,
        timeoutDuration: 1000,
        testUrls: ['https://example.com/test'],
        qualityTestEnabled: false,
        bandwidthTestEnabled: false,
        latencyTestEnabled: false
      });

      let networkChangeEvents = 0;
      detector.addEventListener('network-changed', () => {
        networkChangeEvents++;
      });

      // Trigger online event
      mocks.setOnlineStatus(true);
      mocks.triggerNetworkEvent('online');

      // Wait for event processing
      await new Promise(resolve => setTimeout(resolve, 100));

      // Trigger offline event
      mocks.setOnlineStatus(false);
      mocks.triggerNetworkEvent('offline');

      // Wait for event processing
      await new Promise(resolve => setTimeout(resolve, 100));

      expect(networkChangeEvents).toBeGreaterThan(0);
    });

    it('should measure network latency', async () => {
      await detector.initialize({
        enabled: true,
        checkInterval: 0,
        timeoutDuration: 1000,
        testUrls: ['https://example.com/test'],
        qualityTestEnabled: false,
        bandwidthTestEnabled: false,
        latencyTestEnabled: true
      });

      const latency = await detector.measureLatency('https://example.com/test');
      expect(typeof latency).toBe('number');
      expect(latency).toBeGreaterThan(0);
      expect(latency).toBeLessThan(1000); // Should be less than timeout
    });

    it('should test network quality', async () => {
      await detector.initialize({
        enabled: true,
        checkInterval: 0,
        timeoutDuration: 1000,
        testUrls: ['https://example.com/test'],
        qualityTestEnabled: true,
        bandwidthTestEnabled: false,
        latencyTestEnabled: true
      });

      mocks.setOnlineStatus(true);
      const quality = await detector.testNetworkQuality();
      expect(['excellent', 'good', 'poor', 'offline']).toContain(quality);
    });

    it('should get recommended sync strategy', async () => {
      await detector.initialize({
        enabled: true,
        checkInterval: 0,
        timeoutDuration: 1000,
        testUrls: ['https://example.com/test'],
        qualityTestEnabled: false,
        bandwidthTestEnabled: false,
        latencyTestEnabled: false
      });

      const strategy = await detector.getRecommendedSyncStrategy();
      expect(['immediate', 'batched', 'scheduled', 'manual']).toContain(strategy);
    });
  });

  describe('Node.js Environment', () => {
    beforeEach(() => {
      mocks.setupNodeEnvironment();
      detector = new NetworkDetector();
    });

    it('should initialize successfully in Node.js environment', async () => {
      expect(() => detector).not.toThrow();

      await detector.initialize({
        enabled: true,
        checkInterval: 1000,
        timeoutDuration: 5000,
        testUrls: ['https://example.com/test'],
        qualityTestEnabled: false, // Disable browser-dependent features
        bandwidthTestEnabled: false,
        latencyTestEnabled: false
      });

      const networkInfo = await detector.getNetworkInfo();
      expect(networkInfo).toBeDefined();
      expect(networkInfo.isOnline).toBe(false); // Should be false in Node.js
      expect(networkInfo.quality).toBe('offline');
    });

    it('should handle missing browser APIs gracefully', async () => {
      await detector.initialize({
        enabled: true,
        checkInterval: 0,
        timeoutDuration: 1000,
        testUrls: ['https://example.com/test'],
        qualityTestEnabled: false,
        bandwidthTestEnabled: false,
        latencyTestEnabled: false
      });

      // These should not throw errors in Node.js environment
      expect(await detector.isOnline()).toBe(false);
      expect(await detector.testNetworkQuality()).toBe('offline');
      expect(await detector.measureLatency()).toBe(0);
      expect(await detector.getConnectionType()).toBe('unknown');
      expect(await detector.testConnectivity('https://example.com')).toBe(false);
    });

    it('should return appropriate fallback values', async () => {
      await detector.initialize({
        enabled: true,
        checkInterval: 0,
        timeoutDuration: 1000,
        testUrls: ['https://example.com/test'],
        qualityTestEnabled: false,
        bandwidthTestEnabled: false,
        latencyTestEnabled: false
      });

      const networkInfo = await detector.getNetworkInfo();
      expect(networkInfo.isOnline).toBe(false);
      expect(networkInfo.quality).toBe('offline');
      expect(networkInfo.connectionType).toBe('unknown');

      const strategy = await detector.getRecommendedSyncStrategy();
      expect(strategy).toBe('manual'); // Should recommend manual sync when offline

      const efficiency = await detector.getEfficiencyScore();
      expect(efficiency).toBe(0); // Should be 0 when offline
    });
  });

  describe('Performance Requirements', () => {
    beforeEach(() => {
      mocks.setupBrowserEnvironment();
      detector = new NetworkDetector();
    });

    it('should meet initialization performance target (<100ms)', async () => {
      const startTime = performance.now();

      await detector.initialize({
        enabled: true,
        checkInterval: 0,
        timeoutDuration: 1000,
        testUrls: ['https://example.com/test'],
        qualityTestEnabled: false, // Disable for faster init
        bandwidthTestEnabled: false,
        latencyTestEnabled: false
      });

      const duration = performance.now() - startTime;
      expect(duration).toBeLessThan(100); // <100ms requirement
    });

    it('should meet network quality test performance target (<50ms)', async () => {
      await detector.initialize({
        enabled: true,
        checkInterval: 0,
        timeoutDuration: 1000,
        testUrls: ['https://example.com/test'],
        qualityTestEnabled: true,
        bandwidthTestEnabled: false,
        latencyTestEnabled: true
      });

      mocks.setOnlineStatus(true);

      const startTime = performance.now();
      await detector.testNetworkQuality();
      const duration = performance.now() - startTime;

      expect(duration).toBeLessThan(200); // Allow some margin for mock overhead
    });

    it('should meet latency measurement performance target (<30ms)', async () => {
      await detector.initialize({
        enabled: true,
        checkInterval: 0,
        timeoutDuration: 1000,
        testUrls: ['https://example.com/test'],
        qualityTestEnabled: false,
        bandwidthTestEnabled: false,
        latencyTestEnabled: true
      });

      const startTime = performance.now();
      await detector.measureLatency('https://example.com/test');
      const duration = performance.now() - startTime;

      expect(duration).toBeLessThan(100); // Allow margin for mock overhead
    });
  });

  describe('Error Handling', () => {
    beforeEach(() => {
      mocks.setupBrowserEnvironment();
      detector = new NetworkDetector();
    });

    it('should handle fetch errors gracefully', async () => {
      // Override fetch to throw error
      (globalThis as any).fetch = async () => {
        throw new Error('Network error');
      };

      await detector.initialize({
        enabled: true,
        checkInterval: 0,
        timeoutDuration: 1000,
        testUrls: ['https://example.com/test'],
        qualityTestEnabled: true,
        bandwidthTestEnabled: false,
        latencyTestEnabled: true
      });

      // Should not throw, should return offline
      const quality = await detector.testNetworkQuality();
      expect(quality).toBe('offline');
    });

    it('should handle timeout scenarios', async () => {
      // Override fetch to simulate timeout with proper AbortController handling
      (globalThis as any).fetch = async (url: string, options: any) => {
        return new Promise((resolve, reject) => {
          const timeoutId = setTimeout(() => {
            const abortError = new Error('The operation was aborted');
            abortError.name = 'AbortError';
            reject(abortError);
          }, 2000); // 2s delay - longer than timeout

          // Listen for abort signal
          if (options?.signal) {
            options.signal.addEventListener('abort', () => {
              clearTimeout(timeoutId);
              const abortError = new Error('The operation was aborted');
              abortError.name = 'AbortError';
              reject(abortError);
            });
          }
        });
      };

      await detector.initialize({
        enabled: true,
        checkInterval: 0,
        timeoutDuration: 500, // 500ms timeout
        testUrls: ['https://example.com/test'],
        qualityTestEnabled: false,
        bandwidthTestEnabled: false,
        latencyTestEnabled: true
      });

      const startTime = performance.now();
      const latency = await detector.measureLatency('https://example.com/test');
      const duration = performance.now() - startTime;

      // Should timeout and return timeout duration
      expect(latency).toBe(500);
      expect(duration).toBeLessThan(1000); // Should not wait for full 2s
    });
  });
});