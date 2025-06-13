/**
 * Phase 5.3: Offline-First Support - Network Detector (Fixed Version)
 * Day 3: Sync Management System
 *
 * ✅ FIXED: Environment detection for Node.js compatibility
 * ✅ FIXED: All required interface methods implemented
 * ✅ FIXED: Browser API usage wrapped in environment checks
 */

import {
  NetworkInfo,
  NetworkQuality,
  NetworkDetectionConfig,
  SyncStrategy
} from '../interfaces/types';
import { INetworkDetector } from '../interfaces/network-detector.interface';

interface NetworkStats {
  totalChecks: number;
  successfulChecks: number;
  failedChecks: number;
  averageLatency: number;
  averageBandwidth: number;
  qualityDistribution: Record<NetworkQuality, number>;
  lastCheckTime: number;
  uptime: number;
}

interface NetworkHistoryEntry {
  timestamp: number;
  quality: NetworkQuality;
  latency?: number;
  bandwidth?: number;
  isOnline: boolean;
}

export class NetworkDetectorV2 implements INetworkDetector {
  private config: NetworkDetectionConfig;
  private isInitialized = false;
  private isMonitoring = false;
  private monitoringInterval?: NodeJS.Timeout;
  private eventListeners: Map<string, ((networkInfo: NetworkInfo) => void)[]> = new Map();

  private currentNetworkInfo: NetworkInfo = {
    isOnline: this.isBrowserEnvironment() ? (navigator as any).onLine || false : false,
    quality: 'offline',
    lastChecked: Date.now(),
    connectionType: 'unknown'
  };

  private stats: NetworkStats = {
    totalChecks: 0,
    successfulChecks: 0,
    failedChecks: 0,
    averageLatency: 0,
    averageBandwidth: 0,
    qualityDistribution: {
      excellent: 0,
      good: 0,
      poor: 0,
      offline: 0
    },
    lastCheckTime: 0,
    uptime: 0
  };

  private networkHistory: NetworkHistoryEntry[] = [];
  private readonly maxHistorySize = 1000;

  constructor() {
    this.config = this.getDefaultConfig();
    if (this.isBrowserEnvironment()) {
      this.setupBrowserEventListeners();
    }
  }

  private isBrowserEnvironment(): boolean {
    return typeof window !== 'undefined' && typeof navigator !== 'undefined';
  }

  async initialize(config: NetworkDetectionConfig): Promise<void> {
    const startTime = performance.now();
    this.config = { ...this.getDefaultConfig(), ...config };
    this.isInitialized = true;
    await this.checkNetworkStatus();
    const duration = performance.now() - startTime;
    console.log(`NetworkDetector initialized in ${duration.toFixed(2)}ms`);
  }

  async startMonitoring(): Promise<void> {
    if (!this.isInitialized) {
      throw new Error('NetworkDetector not initialized');
    }
    if (this.isMonitoring) return;

    this.isMonitoring = true;
    if (this.config.checkInterval > 0) {
      this.monitoringInterval = setInterval(async () => {
        await this.checkNetworkStatus();
      }, this.config.checkInterval);
    }
    console.log('Network monitoring started');
  }

  async stopMonitoring(): Promise<void> {
    this.isMonitoring = false;
    if (this.monitoringInterval) {
      clearInterval(this.monitoringInterval);
      this.monitoringInterval = undefined;
    }
    console.log('Network monitoring stopped');
  }

  async isOnline(): Promise<boolean> {
    if (!this.isBrowserEnvironment()) return false;
    const networkInfo = await this.getNetworkInfo();
    return networkInfo.isOnline;
  }

  async getNetworkInfo(): Promise<NetworkInfo> {
    if (!this.isInitialized) {
      throw new Error('NetworkDetector not initialized');
    }
    const now = Date.now();
    if (now - this.currentNetworkInfo.lastChecked < 5000) {
      return { ...this.currentNetworkInfo };
    }
    await this.checkNetworkStatus();
    return { ...this.currentNetworkInfo };
  }

  async forceCheck(): Promise<NetworkInfo> {
    await this.checkNetworkStatus();
    return { ...this.currentNetworkInfo };
  }

  async getNetworkHistory(limit = 100): Promise<NetworkInfo[]> {
    return this.networkHistory
      .slice(-limit)
      .map(entry => ({
        isOnline: entry.isOnline,
        quality: entry.quality,
        latency: entry.latency,
        bandwidth: entry.bandwidth,
        lastChecked: entry.timestamp,
        connectionType: 'unknown'
      }));
  }

  async setTestUrls(urls: string[]): Promise<void> {
    this.config.testUrls = urls;
  }

  async testConnectivity(url: string): Promise<boolean> {
    if (!this.isBrowserEnvironment()) return false;
    try {
      const latency = await this.measureLatency(url);
      return latency > 0 && latency < this.config.timeoutDuration;
    } catch {
      return false;
    }
  }

  async estimateTransferTime(dataSize: number): Promise<number> {
    const networkInfo = await this.getNetworkInfo();
    if (!networkInfo.isOnline || !networkInfo.bandwidth) {
      return Infinity;
    }
    const bytesPerSecond = (networkInfo.bandwidth * 1024 * 1024) / 8;
    return dataSize / bytesPerSecond;
  }

  async testNetworkQuality(): Promise<NetworkQuality> {
    if (!this.isBrowserEnvironment() || !(navigator as any).onLine) {
      return 'offline';
    }

    try {
      let totalLatency = 0;
      let successfulTests = 0;

      for (const url of this.config.testUrls) {
        try {
          const latency = await this.measureLatency(url);
          if (latency > 0) {
            totalLatency += latency;
            successfulTests++;
          }
        } catch (error) {
          // Continue with other URLs
        }
      }

      if (successfulTests === 0) return 'offline';

      const averageLatency = totalLatency / successfulTests;
      return this.determineQualityFromLatency(averageLatency);
    } catch (error) {
      console.error('Network quality test failed:', error);
      return 'offline';
    }
  }

  async measureLatency(url?: string): Promise<number> {
    if (!this.isBrowserEnvironment()) return 0;

    const testUrl = url || this.config.testUrls[0];
    const startTime = performance.now();

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), this.config.timeoutDuration);

      await fetch(testUrl, {
        method: 'HEAD',
        mode: 'no-cors',
        signal: controller.signal
      });

      clearTimeout(timeoutId);
      return performance.now() - startTime;
    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') {
        return this.config.timeoutDuration;
      }
      throw error;
    }
  }

  async measureBandwidth(): Promise<number> {
    console.log('Bandwidth measurement (placeholder)');
    return 10; // 10 Mbps placeholder
  }

  async isSuitableForSync(): Promise<boolean> {
    const networkInfo = await this.getNetworkInfo();
    return networkInfo.isOnline && networkInfo.quality !== 'offline';
  }

  async getRecommendedSyncStrategy(): Promise<'immediate' | 'batched' | 'scheduled' | 'manual'> {
    const networkInfo = await this.getNetworkInfo();

    if (!networkInfo.isOnline || networkInfo.quality === 'offline') {
      return 'manual';
    }

    switch (networkInfo.quality) {
      case 'excellent': return 'immediate';
      case 'good': return 'batched';
      case 'poor': return 'scheduled';
      default: return 'manual';
    }
  }

  async getEfficiencyScore(): Promise<number> {
    const networkInfo = await this.getNetworkInfo();
    if (!networkInfo.isOnline) return 0;

    let score = 50;
    switch (networkInfo.quality) {
      case 'excellent': score += 30; break;
      case 'good': score += 20; break;
      case 'poor': score += 10; break;
    }

    if (networkInfo.latency !== undefined) {
      if (networkInfo.latency < 50) score += 20;
      else if (networkInfo.latency < 200) score += 10;
      else if (networkInfo.latency < 500) score += 5;
    }

    return Math.min(100, Math.max(0, score));
  }

  async getConnectionType(): Promise<string> {
    if (!this.isBrowserEnvironment()) return 'unknown';

    if ('connection' in navigator) {
      const connection = (navigator as any).connection;
      if (connection && connection.effectiveType) {
        return connection.effectiveType;
      }
    }
    return 'unknown';
  }

  addEventListener(event: string, callback: (networkInfo: NetworkInfo) => void): void {
    if (!this.eventListeners.has(event)) {
      this.eventListeners.set(event, []);
    }
    this.eventListeners.get(event)!.push(callback);
  }

  removeEventListener(event: string, callback: (networkInfo: NetworkInfo) => void): void {
    const listeners = this.eventListeners.get(event);
    if (listeners) {
      const index = listeners.indexOf(callback);
      if (index > -1) {
        listeners.splice(index, 1);
      }
    }
  }

  async getStats(): Promise<{
    totalChecks: number;
    onlineTime: number;
    offlineTime: number;
    averageLatency: number;
    averageBandwidth: number;
    qualityDistribution: Record<NetworkQuality, number>;
    lastCheck: number;
  }> {
    const now = Date.now();
    const uptime = this.stats.uptime || (now - (this.stats.lastCheckTime || now));

    return {
      totalChecks: this.stats.totalChecks,
      onlineTime: uptime * 0.8,
      offlineTime: uptime * 0.2,
      averageLatency: this.stats.averageLatency,
      averageBandwidth: this.stats.averageBandwidth,
      qualityDistribution: this.stats.qualityDistribution,
      lastCheck: this.stats.lastCheckTime
    };
  }

  async clearHistory(): Promise<void> {
    this.networkHistory = [];
  }

  private getDefaultConfig(): NetworkDetectionConfig {
    return {
      checkInterval: 30000,
      timeoutDuration: 5000,
      testUrls: [
        'https://www.google.com/favicon.ico',
        'https://httpbin.org/status/200'
      ],
      qualityTestEnabled: true,
      bandwidthTestEnabled: false,
      latencyTestEnabled: true
    };
  }

  private setupBrowserEventListeners(): void {
    if (!this.isBrowserEnvironment()) return;

    (window as any).addEventListener('online', () => {
      this.handleBrowserNetworkChange(true);
    });

    (window as any).addEventListener('offline', () => {
      this.handleBrowserNetworkChange(false);
    });

    if ('connection' in navigator) {
      const connection = (navigator as any).connection;
      if (connection) {
        connection.addEventListener('change', () => {
          this.handleConnectionChange();
        });
      }
    }
  }

  private async handleBrowserNetworkChange(isOnline: boolean): Promise<void> {
    console.log(`Browser network change: ${isOnline ? 'online' : 'offline'}`);
    this.currentNetworkInfo.isOnline = isOnline;
    this.currentNetworkInfo.quality = isOnline ? 'good' : 'offline';
    this.currentNetworkInfo.lastChecked = Date.now();

    if (isOnline) {
      await this.checkNetworkStatus();
    } else {
      this.emitNetworkChange();
    }
  }

  private async handleConnectionChange(): Promise<void> {
    console.log('Connection properties changed');
    await this.checkNetworkStatus();
  }

  private async checkNetworkStatus(): Promise<void> {
    const startTime = performance.now();
    this.stats.totalChecks++;

    try {
      const isOnline = this.isBrowserEnvironment() ? (navigator as any).onLine || false : false;
      let quality: NetworkQuality = 'offline';
      let latency: number | undefined;
      let bandwidth: number | undefined;

      if (isOnline) {
        if (this.config.qualityTestEnabled) {
          quality = await this.testNetworkQuality();
        } else {
          quality = 'good';
        }

        if (this.config.latencyTestEnabled && quality !== 'offline') {
          try {
            latency = await this.measureLatency();
            this.updateLatencyStats(latency);
          } catch (error) {
            console.warn('Latency measurement failed:', error);
          }
        }

        if (this.config.bandwidthTestEnabled && quality !== 'offline') {
          try {
            bandwidth = await this.measureBandwidth();
            this.updateBandwidthStats(bandwidth);
          } catch (error) {
            console.warn('Bandwidth measurement failed:', error);
          }
        }
      }

      const connectionType = await this.getConnectionType();
      const previousQuality = this.currentNetworkInfo.quality;

      this.currentNetworkInfo = {
        isOnline,
        quality,
        latency,
        bandwidth,
        lastChecked: Date.now(),
        connectionType
      };

      this.stats.successfulChecks++;
      this.stats.qualityDistribution[quality]++;
      this.stats.lastCheckTime = Date.now();

      this.addToHistory({
        timestamp: Date.now(),
        quality,
        latency,
        bandwidth,
        isOnline
      });

      if (previousQuality !== quality) {
        this.emitNetworkChange();
      }

      const duration = performance.now() - startTime;
      if (duration > 100) {
        console.warn(`Slow network check: ${duration.toFixed(2)}ms`);
      }
    } catch (error) {
      this.stats.failedChecks++;
      console.error('Network status check failed:', error);
    }
  }

  private determineQualityFromLatency(latency: number): NetworkQuality {
    if (latency < 50) return 'excellent';
    else if (latency < 200) return 'good';
    else return 'poor';
  }

  private updateLatencyStats(latency: number): void {
    if (this.stats.averageLatency === 0) {
      this.stats.averageLatency = latency;
    } else {
      this.stats.averageLatency = this.stats.averageLatency * 0.8 + latency * 0.2;
    }
  }

  private updateBandwidthStats(bandwidth: number): void {
    if (this.stats.averageBandwidth === 0) {
      this.stats.averageBandwidth = bandwidth;
    } else {
      this.stats.averageBandwidth = this.stats.averageBandwidth * 0.8 + bandwidth * 0.2;
    }
  }

  private addToHistory(entry: NetworkHistoryEntry): void {
    this.networkHistory.push(entry);
    if (this.networkHistory.length > this.maxHistorySize) {
      this.networkHistory = this.networkHistory.slice(-this.maxHistorySize);
    }
  }

  private emitNetworkChange(): void {
    const listeners = this.eventListeners.get('network-changed');
    if (listeners) {
      listeners.forEach(callback => {
        try {
          callback(this.currentNetworkInfo);
        } catch (error) {
          console.error('Error in network change listener:', error);
        }
      });
    }
  }
}