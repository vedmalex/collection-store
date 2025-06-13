/**
 * Browser Fallback Manager Interface
 * Manages automatic fallback strategies when browser storage quotas are exceeded
 */

export enum FallbackStrategy {
  MEMORY_ONLY = 'memory_only',
  REDUCED_CACHE = 'reduced_cache',
  EXTERNAL_STORAGE = 'external_storage',
  COMPRESSION = 'compression',
  SELECTIVE_CLEANUP = 'selective_cleanup',
  GRACEFUL_DEGRADATION = 'graceful_degradation'
}

export enum StorageType {
  LOCAL_STORAGE = 'localStorage',
  SESSION_STORAGE = 'sessionStorage',
  INDEXED_DB = 'indexedDB',
  WEB_SQL = 'webSQL',
  CACHE_API = 'cacheAPI',
  MEMORY = 'memory'
}

export enum QuotaStatus {
  AVAILABLE = 'available',
  WARNING = 'warning',
  CRITICAL = 'critical',
  EXCEEDED = 'exceeded',
  UNKNOWN = 'unknown'
}

export interface StorageQuotaInfo {
  type: StorageType;
  used: number;
  available: number;
  total: number;
  percentage: number;
  status: QuotaStatus;
  lastChecked: Date;
}

export interface FallbackRule {
  id: string;
  name: string;
  description: string;
  trigger: {
    quotaThreshold: number; // percentage (0-100)
    storageTypes: StorageType[];
    conditions: string[]; // additional conditions
  };
  strategy: FallbackStrategy;
  priority: number; // higher = more priority
  config: {
    retainCriticalData: boolean;
    compressionLevel?: number;
    maxMemoryUsage?: number;
    cleanupPatterns?: string[];
    externalStorageConfig?: any;
  };
  enabled: boolean;
  createdAt: Date;
  lastUsed?: Date;
}

export interface FallbackExecution {
  id: string;
  ruleId: string;
  strategy: FallbackStrategy;
  trigger: {
    quotaStatus: StorageQuotaInfo;
    timestamp: Date;
    reason: string;
  };
  execution: {
    startTime: Date;
    endTime?: Date;
    status: 'running' | 'completed' | 'failed' | 'cancelled';
    steps: FallbackStep[];
    result?: FallbackResult;
    error?: Error;
  };
  impact: {
    dataRetained: number;
    dataLost: number;
    performanceImpact: number;
    userExperienceImpact: 'none' | 'minimal' | 'moderate' | 'significant';
  };
}

export interface FallbackStep {
  id: string;
  name: string;
  description: string;
  startTime: Date;
  endTime?: Date;
  status: 'pending' | 'running' | 'completed' | 'failed' | 'skipped';
  result?: any;
  error?: Error;
}

export interface FallbackResult {
  success: boolean;
  strategy: FallbackStrategy;
  quotaFreed: number;
  dataRetained: number;
  dataLost: number;
  newQuotaStatus: StorageQuotaInfo;
  recommendations: string[];
  nextCheckTime: Date;
}

export interface BrowserFallbackStats {
  totalExecutions: number;
  successfulExecutions: number;
  failedExecutions: number;
  averageExecutionTime: number;
  totalQuotaFreed: number;
  totalDataRetained: number;
  totalDataLost: number;
  strategyUsage: Record<FallbackStrategy, number>;
  lastExecution?: Date;
  nextScheduledCheck: Date;
}

export interface QuotaMonitoringConfig {
  enabled: boolean;
  checkInterval: number; // milliseconds
  warningThreshold: number; // percentage
  criticalThreshold: number; // percentage
  autoFallback: boolean;
  notifyUser: boolean;
  logLevel: 'none' | 'error' | 'warn' | 'info' | 'debug';
}

export interface BrowserFallbackEvent {
  type: 'quota_warning' | 'quota_critical' | 'fallback_triggered' | 'fallback_completed' | 'fallback_failed';
  timestamp: Date;
  data: {
    quotaInfo?: StorageQuotaInfo;
    execution?: FallbackExecution;
    rule?: FallbackRule;
    error?: Error;
  };
}

export interface BrowserFallbackManagerConfig {
  monitoring: QuotaMonitoringConfig;
  fallbackRules: FallbackRule[];
  defaultStrategy: FallbackStrategy;
  emergencyStrategy: FallbackStrategy;
  retryAttempts: number;
  retryDelay: number;
  maxConcurrentExecutions: number;
  enableStatistics: boolean;
  enableEvents: boolean;
}

export interface IBrowserFallbackManager {
  // Lifecycle
  initialize(config: BrowserFallbackManagerConfig): Promise<void>;
  start(): Promise<void>;
  stop(): Promise<void>;
  isRunning(): boolean;

  // Configuration
  updateConfig(config: Partial<BrowserFallbackManagerConfig>): Promise<void>;
  getConfig(): BrowserFallbackManagerConfig;

  // Quota Monitoring
  checkQuotaStatus(): Promise<StorageQuotaInfo[]>;
  getQuotaStatus(storageType: StorageType): Promise<StorageQuotaInfo>;
  startQuotaMonitoring(): Promise<void>;
  stopQuotaMonitoring(): Promise<void>;
  isMonitoring(): boolean;

  // Fallback Rules Management
  addFallbackRule(rule: Omit<FallbackRule, 'id' | 'createdAt'>): Promise<string>;
  updateFallbackRule(ruleId: string, updates: Partial<FallbackRule>): Promise<void>;
  removeFallbackRule(ruleId: string): Promise<void>;
  getFallbackRule(ruleId: string): FallbackRule | undefined;
  getAllFallbackRules(): FallbackRule[];
  enableFallbackRule(ruleId: string): Promise<void>;
  disableFallbackRule(ruleId: string): Promise<void>;

  // Fallback Execution
  triggerFallback(strategy?: FallbackStrategy): Promise<FallbackResult>;
  executeFallbackRule(ruleId: string): Promise<FallbackResult>;
  cancelFallbackExecution(executionId: string): Promise<void>;
  getFallbackExecution(executionId: string): FallbackExecution | undefined;
  getActiveFallbackExecutions(): FallbackExecution[];
  getFallbackHistory(limit?: number): FallbackExecution[];

  // Strategy Implementation
  executeMemoryOnlyFallback(): Promise<FallbackResult>;
  executeReducedCacheFallback(): Promise<FallbackResult>;
  executeExternalStorageFallback(): Promise<FallbackResult>;
  executeCompressionFallback(): Promise<FallbackResult>;
  executeSelectiveCleanupFallback(): Promise<FallbackResult>;
  executeGracefulDegradationFallback(): Promise<FallbackResult>;

  // Statistics and Monitoring
  getStatistics(): BrowserFallbackStats;
  resetStatistics(): Promise<void>;
  exportStatistics(): Promise<string>;

  // Events
  on(event: 'quota_warning' | 'quota_critical' | 'fallback_triggered' | 'fallback_completed' | 'fallback_failed',
     callback: (event: BrowserFallbackEvent) => void): void;
  off(event: string, callback: Function): void;
  emit(event: string, data: any): void;

  // Health and Diagnostics
  getHealth(): Promise<{
    status: 'healthy' | 'warning' | 'critical' | 'error';
    details: {
      monitoring: boolean;
      quotaStatus: Record<StorageType, QuotaStatus>;
      activeExecutions: number;
      lastCheck: Date;
      nextCheck: Date;
      rulesCount: number;
      enabledRulesCount: number;
    };
    issues: string[];
    recommendations: string[];
  }>;

  // Utility Methods
  estimateQuotaUsage(data: any): Promise<number>;
  validateFallbackRule(rule: Partial<FallbackRule>): Promise<{ valid: boolean; errors: string[] }>;
  simulateFallback(strategy: FallbackStrategy): Promise<{
    estimatedQuotaFreed: number;
    estimatedDataLoss: number;
    estimatedImpact: string
  }>;

  // Bulk Operations
  addMultipleFallbackRules(rules: Omit<FallbackRule, 'id' | 'createdAt'>[]): Promise<string[]>;
  updateMultipleFallbackRules(updates: { ruleId: string; updates: Partial<FallbackRule> }[]): Promise<void>;
  removeMultipleFallbackRules(ruleIds: string[]): Promise<void>;

  // Import/Export
  exportConfiguration(): Promise<string>;
  importConfiguration(configData: string): Promise<void>;
  exportFallbackHistory(): Promise<string>;
  importFallbackHistory(historyData: string): Promise<void>;
}