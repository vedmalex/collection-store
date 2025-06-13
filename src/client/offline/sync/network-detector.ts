/**
 * Phase 5.3: Offline-First Support - Network Detector
 * Day 3: Sync Management System
 *
 * ✅ IDEA: High-performance network quality detection and monitoring
 * ✅ IDEA: Adaptive sync strategy recommendations
 * ✅ IDEA: Real-time network change notifications
 */

import {
  NetworkInfo,
  NetworkQuality,
  NetworkDetectionConfig,
  SyncStrategy
} from '../interfaces/types';
import { INetworkDetector } from '../interfaces/network-detector.interface';

/**
 * Network statistics for monitoring
 */
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

/**
 * Network history entry
 */
interface NetworkHistoryEntry {
  timestamp: number;
  quality: NetworkQuality;
  latency?: number;
  bandwidth?: number;
  isOnline: boolean;
}

/**
 * High-performance network detector with quality assessment
 * Features: Real-time monitoring, quality assessment, adaptive recommendations
 * Performance targets: <50ms quality test, <30ms latency measurement
 */
export class NetworkDetector implements INetworkDetector {
  private config: NetworkDetectionConfig;
  private isInitialized = false;
  private isMonitoring = false;
  private monitoringInterval?: NodeJS.Timeout;
  private eventListeners: Map<string, ((networkInfo: NetworkInfo) => void)[]> = new Map();

  private currentNetworkInfo: NetworkInfo = {
    isOnline: navigator.onLine,
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
    this.setupBrowserEventListeners();
  }

  /**
   * Initialize the network detector
   */
  async initialize(config: NetworkDetectionConfig): Promise<void> {
    const startTime = performance.now();

    this.config = { ...this.getDefaultConfig(), ...config };
    this.isInitialized = true;

    // Initial network check
    await this.checkNetworkStatus();

    const duration = performance.now() - startTime;
    console.log(`NetworkDetector initialized in ${duration.toFixed(2)}ms`);
  }

  /**
   * Start network monitoring
   */
  async startMonitoring(): Promise<void> {
    if (!this.isInitialized) {
      throw new Error('NetworkDetector not initialized');
    }

    if (this.isMonitoring) {
      return;
    }

    this.isMonitoring = true;

    // Start periodic checks
    if (this.config.checkInterval > 0) {
      this.monitoringInterval = setInterval(async () => {
        await this.checkNetworkStatus();
      }, this.config.checkInterval);
    }

    console.log('Network monitoring started');
  }

  /**
   * Stop network monitoring
   */
  async stopMonitoring(): Promise<void> {
    this.isMonitoring = false;

    if (this.monitoringInterval) {
      clearInterval(this.monitoringInterval);
      this.monitoringInterval = undefined;
    }

    console.log('Network monitoring stopped');
  }

  /**
   * Get current network information
   */
  async getNetworkInfo(): Promise<NetworkInfo> {
    if (!this.isInitialized) {
      throw new Error('NetworkDetector not initialized');
    }

    // Return cached info if recent enough
    const now = Date.now();
    if (now - this.currentNetworkInfo.lastChecked < 5000) { // 5 seconds cache
      return { ...this.currentNetworkInfo };
    }

    // Perform fresh check
    await this.checkNetworkStatus();
    return { ...this.currentNetworkInfo };
  }

  /**
   * Test network quality
   */
  async testNetworkQuality(): Promise<NetworkQuality> {
    const startTime = performance.now();

    if (!navigator.onLine) {
      return 'offline';
    }

    try {
      let totalLatency = 0;
      let successfulTests = 0;

      // Test multiple URLs for reliability
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

      if (successfulTests === 0) {
        return 'offline';
      }

      const averageLatency = totalLatency / successfulTests;
      const quality = this.determineQualityFromLatency(averageLatency);

      const duration = performance.now() - startTime;
      if (duration > 50) {
        console.warn(`Slow network quality test: ${duration.toFixed(2)}ms`);
      }

      return quality;

    } catch (error) {
      console.error('Network quality test failed:', error);
      return 'offline';
    }
  }

  /**
   * Measure network latency
   */
  async measureLatency(url?: string): Promise<number> {
    const testUrl = url || this.config.testUrls[0];
    const startTime = performance.now();

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), this.config.timeoutDuration);

      const response = await fetch(testUrl, {
        method: 'HEAD',
        mode: 'no-cors',
        cache: 'no-cache',
        signal: controller.signal
      });

      clearTimeout(timeoutId);
      const latency = performance.now() - startTime;

      return latency;

    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') {
        return this.config.timeoutDuration;
      }
      throw error;
    }
  }

  /**
   * Measure network bandwidth (placeholder)
   */
  async measureBandwidth(): Promise<number> {
    // Placeholder implementation
    // In a real implementation, this would download a test file and measure speed
    console.log('Bandwidth measurement (placeholder)');
    return 10; // 10 Mbps placeholder
  }

  /**
   * Check if network is suitable for sync
   */
  async isSuitableForSync(): Promise<boolean> {
    const networkInfo = await this.getNetworkInfo();
    return networkInfo.isOnline && networkInfo.quality !== 'offline';
  }

  /**
   * Get recommended sync strategy based on network conditions
   */
  async getRecommendedSyncStrategy(): Promise<'immediate' | 'batched' | 'scheduled' | 'manual'> {
    const networkInfo = await this.getNetworkInfo();

    if (!networkInfo.isOnline || networkInfo.quality === 'offline') {
      return 'manual';
    }

    switch (networkInfo.quality) {
      case 'excellent':
        return 'immediate';
      case 'good':
        return 'batched';
      case 'poor':
        return 'scheduled';
      default:
        return 'manual';
    }
  }

  /**
   * Get network efficiency score (0-100)
   */
  async getEfficiencyScore(): Promise<number> {
    const networkInfo = await this.getNetworkInfo();

    if (!networkInfo.isOnline) {
      return 0;
    }

    let score = 50; // Base score for being online

    // Adjust based on quality
    switch (networkInfo.quality) {
      case 'excellent':
        score = 95;
        break;
      case 'good':
        score = 75;
        break;
      case 'poor':
        score = 40;
        break;
      case 'offline':
        score = 0;
        break;
    }

    // Adjust based on latency if available
    if (networkInfo.latency) {
      if (networkInfo.latency < 50) {
        score = Math.min(100, score + 5);
      } else if (networkInfo.latency > 500) {
        score = Math.max(0, score - 20);
      }
    }

    // Adjust based on stability (from history)
    const stabilityScore = this.calculateStabilityScore();
    score = Math.round(score * stabilityScore);

    return Math.max(0, Math.min(100, score));
  }

  /**
   * Add event listener
   */
  addEventListener(event: string, callback: (networkInfo: NetworkInfo) => void): void {
    if (!this.eventListeners.has(event)) {
      this.eventListeners.set(event, []);
    }
    this.eventListeners.get(event)!.push(callback);
  }

  /**
   * Remove event listener
   */
  removeEventListener(event: string, callback: (networkInfo: NetworkInfo) => void): void {
    const listeners = this.eventListeners.get(event);
    if (listeners) {
      const index = listeners.indexOf(callback);
      if (index !== -1) {
        listeners.splice(index, 1);
      }
    }
  }

  /**
   * Get network statistics
   */
  async getStats(): Promise<{
    totalChecks: number;
    onlineTime: number;
    offlineTime: number;
    averageLatency: number;
    averageBandwidth: number;
    qualityDistribution: Record<NetworkQuality, number>;
    lastCheck: number;
  }> {
    return {
      totalChecks: this.stats.totalChecks,
      onlineTime: this.stats.uptime, // Use uptime as onlineTime approximation
      offlineTime: 0, // Placeholder
      averageLatency: this.stats.averageLatency,
      averageBandwidth: this.stats.averageBandwidth,
      qualityDistribution: this.stats.qualityDistribution,
      lastCheck: this.stats.lastCheckTime
    };
  }

  /**
   * Get network history
   */
  async getHistory(limit = 100): Promise<NetworkHistoryEntry[]> {
    return this.networkHistory.slice(-limit);
  }

  /**
   * Clear network history
   */
  async clearHistory(): Promise<void> {
    this.networkHistory = [];
  }

  /**
   * Export network data
   */
  async export(): Promise<{
    currentNetworkInfo: NetworkInfo;
    stats: NetworkStats;
    history: NetworkHistoryEntry[];
    config: NetworkDetectionConfig;
    metadata: {
      exportTime: number;
      version: string;
    };
  }> {
    return {
      currentNetworkInfo: this.currentNetworkInfo,
      stats: await this.getStats(),
      history: this.networkHistory,
      config: this.config,
      metadata: {
        exportTime: Date.now(),
        version: '1.0.0'
      }
    };
  }

  /**
   * Import network data
   */
  async import(data: {
    history?: NetworkHistoryEntry[];
    stats?: Partial<NetworkStats>;
  }): Promise<void> {
    if (data.history) {
      this.networkHistory = data.history.slice(-this.maxHistorySize);
    }

    if (data.stats) {
      this.stats = { ...this.stats, ...data.stats };
    }
  }

  /**
   * Shutdown network detector
   */
  async shutdown(): Promise<void> {
    await this.stopMonitoring();
    this.eventListeners.clear();
    this.isInitialized = false;
    console.log('NetworkDetector shut down');
  }

  // ===== PRIVATE METHODS =====

  private getDefaultConfig(): NetworkDetectionConfig {
    return {
      enabled: true,
      checkInterval: 30000, // 30 seconds
      timeoutDuration: 5000, // 5 seconds
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
    // Listen for browser online/offline events
    window.addEventListener('online', () => {
      this.handleBrowserNetworkChange(true);
    });

    window.addEventListener('offline', () => {
      this.handleBrowserNetworkChange(false);
    });

    // Listen for connection change events (if supported)
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

    // Update current status immediately
    this.currentNetworkInfo.isOnline = isOnline;
    this.currentNetworkInfo.quality = isOnline ? 'good' : 'offline';
    this.currentNetworkInfo.lastChecked = Date.now();

    // Perform detailed check if online
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
      const isOnline = navigator.onLine;
      let quality: NetworkQuality = 'offline';
      let latency: number | undefined;
      let bandwidth: number | undefined;

      if (isOnline) {
        // Test network quality if enabled
        if (this.config.qualityTestEnabled) {
          quality = await this.testNetworkQuality();
        } else {
          quality = 'good'; // Default assumption if testing disabled
        }

        // Measure latency if enabled
        if (this.config.latencyTestEnabled && quality !== 'offline') {
          try {
            latency = await this.measureLatency();
            this.updateLatencyStats(latency);
          } catch (error) {
            console.warn('Latency measurement failed:', error);
          }
        }

        // Measure bandwidth if enabled
        if (this.config.bandwidthTestEnabled && quality !== 'offline') {
          try {
            bandwidth = await this.measureBandwidth();
            this.updateBandwidthStats(bandwidth);
          } catch (error) {
            console.warn('Bandwidth measurement failed:', error);
          }
        }
      }

      // Get connection type if available
      const connectionType = this.getConnectionType();

      // Update current network info
      const previousQuality = this.currentNetworkInfo.quality;
      this.currentNetworkInfo = {
        isOnline,
        quality,
        latency,
        bandwidth,
        lastChecked: Date.now(),
        connectionType
      };

      // Update statistics
      this.stats.successfulChecks++;
      this.stats.qualityDistribution[quality]++;
      this.stats.lastCheckTime = Date.now();

      // Add to history
      this.addToHistory({
        timestamp: Date.now(),
        quality,
        latency,
        bandwidth,
        isOnline
      });

      // Emit change event if quality changed
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
    if (latency < 50) {
      return 'excellent';
    } else if (latency < 200) {
      return 'good';
    } else {
      return 'poor';
    }
  }

  /**
   * Get connection type
   */
  async getConnectionType(): Promise<string> {
    if ('connection' in navigator) {
      const connection = (navigator as any).connection;
      if (connection && connection.effectiveType) {
        return connection.effectiveType;
      }
    }
    return 'unknown';
  }

  private getConnectionTypeSync(): string {
    if ('connection' in navigator) {
      const connection = (navigator as any).connection;
      if (connection && connection.effectiveType) {
        return connection.effectiveType;
      }
    }
    return 'unknown';
  }

  private updateLatencyStats(latency: number): void {
    if (this.stats.averageLatency === 0) {
      this.stats.averageLatency = latency;
    } else {
      // Exponential moving average
      this.stats.averageLatency = this.stats.averageLatency * 0.8 + latency * 0.2;
    }
  }

  private updateBandwidthStats(bandwidth: number): void {
    if (this.stats.averageBandwidth === 0) {
      this.stats.averageBandwidth = bandwidth;
    } else {
      // Exponential moving average
      this.stats.averageBandwidth = this.stats.averageBandwidth * 0.8 + bandwidth * 0.2;
    }
  }

  private addToHistory(entry: NetworkHistoryEntry): void {
    this.networkHistory.push(entry);

    // Maintain history size limit
    if (this.networkHistory.length > this.maxHistorySize) {
      this.networkHistory = this.networkHistory.slice(-this.maxHistorySize);
    }
  }

  private calculateStabilityScore(): number {
    if (this.networkHistory.length < 10) {
      return 1.0; // Not enough data, assume stable
    }

    const recentHistory = this.networkHistory.slice(-20); // Last 20 entries
    let qualityChanges = 0;

    for (let i = 1; i < recentHistory.length; i++) {
      if (recentHistory[i].quality !== recentHistory[i - 1].quality) {
        qualityChanges++;
      }
    }

    // Stability score: fewer changes = higher stability
    const stabilityScore = Math.max(0.5, 1 - (qualityChanges / recentHistory.length));
    return stabilityScore;
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