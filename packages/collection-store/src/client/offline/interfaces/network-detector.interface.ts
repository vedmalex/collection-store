import { NetworkInfo, NetworkQuality, NetworkDetectionConfig } from './types';

/**
 * Interface for network detection and monitoring
 * Handles network status detection, quality assessment, and connectivity monitoring
 */
export interface INetworkDetector {
  /**
   * Initialize the network detector
   */
  initialize(config: NetworkDetectionConfig): Promise<void>;

  /**
   * Start network monitoring
   */
  startMonitoring(): Promise<void>;

  /**
   * Stop network monitoring
   */
  stopMonitoring(): Promise<void>;

  /**
   * Check if currently online
   */
  isOnline(): Promise<boolean>;

  /**
   * Get current network information
   */
  getNetworkInfo(): Promise<NetworkInfo>;

  /**
   * Test network quality
   */
  testNetworkQuality(): Promise<NetworkQuality>;

  /**
   * Measure network latency
   */
  measureLatency(url?: string): Promise<number>;

  /**
   * Measure network bandwidth
   */
  measureBandwidth(): Promise<number>;

  /**
   * Get connection type (wifi, cellular, ethernet, etc.)
   */
  getConnectionType(): Promise<string>;

  /**
   * Add event listener for network changes
   */
  addEventListener(event: 'network-changed', callback: (networkInfo: NetworkInfo) => void): void;

  /**
   * Remove event listener
   */
  removeEventListener(event: 'network-changed', callback: (networkInfo: NetworkInfo) => void): void;

  /**
   * Force a network check
   */
  forceCheck(): Promise<NetworkInfo>;

  /**
   * Get network history
   */
  getNetworkHistory(limit?: number): Promise<NetworkInfo[]>;

  /**
   * Clear network history
   */
  clearHistory(): Promise<void>;

  /**
   * Get network statistics
   */
  getStats(): Promise<{
    totalChecks: number;
    onlineTime: number;
    offlineTime: number;
    averageLatency: number;
    averageBandwidth: number;
    qualityDistribution: Record<NetworkQuality, number>;
    lastCheck: number;
  }>;

  /**
   * Set custom test URLs for connectivity testing
   */
  setTestUrls(urls: string[]): Promise<void>;

  /**
   * Test connectivity to specific URL
   */
  testConnectivity(url: string): Promise<boolean>;

  /**
   * Get recommended sync strategy based on current network
   */
  getRecommendedSyncStrategy(): Promise<'immediate' | 'batched' | 'scheduled' | 'manual'>;

  /**
   * Check if network is suitable for sync operations
   */
  isSuitableForSync(): Promise<boolean>;

  /**
   * Estimate data transfer time
   */
  estimateTransferTime(dataSize: number): Promise<number>;

  /**
   * Get network efficiency score (0-100)
   */
  getEfficiencyScore(): Promise<number>;
}