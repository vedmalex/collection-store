export interface PerformanceMetrics {
    operationsPerSecond: number;
    averageLatency: number;
    totalOperations: number;
    errorRate: number;
    memoryUsage: {
        heapUsed: number;
        heapTotal: number;
        external: number;
        rss: number;
    };
    walMetrics: {
        entriesWritten: number;
        entriesRead: number;
        averageEntrySize: number;
        compressionRatio: number;
        flushCount: number;
        recoveryCount: number;
    };
    transactionMetrics: {
        activeTransactions: number;
        committedTransactions: number;
        rolledBackTransactions: number;
        averageTransactionDuration: number;
    };
    timestamp: number;
    uptime: number;
}
export interface PerformanceAlert {
    type: 'warning' | 'error' | 'critical';
    metric: string;
    value: number;
    threshold: number;
    message: string;
    timestamp: number;
}
export interface MonitoringConfig {
    metricsInterval: number;
    alertCheckInterval: number;
    thresholds: {
        maxLatency: number;
        maxErrorRate: number;
        maxMemoryUsage: number;
        minThroughput: number;
    };
    historySize: number;
    enableAlerts: boolean;
    enableLogging: boolean;
}
export declare class PerformanceMonitor {
    private config;
    private startTime;
    private operationHistory;
    private metricsHistory;
    private alerts;
    private intervalId?;
    private alertIntervalId?;
    private counters;
    private timingData;
    private transactionTimings;
    constructor(config?: Partial<MonitoringConfig>);
    private startMonitoring;
    stop(): void;
    recordOperationStart(operationType: string): string;
    recordOperationEnd(operationId: string, success?: boolean): void;
    recordWALOperation(type: 'write' | 'read' | 'flush' | 'recovery', size?: number): void;
    recordCompression(originalSize: number, compressedSize: number): void;
    recordTransaction(type: 'begin' | 'commit' | 'rollback', duration?: number): void;
    private collectMetrics;
    private checkAlerts;
    private logMetrics;
    getCurrentMetrics(): PerformanceMetrics | null;
    getMetricsHistory(): PerformanceMetrics[];
    getAlerts(since?: number): PerformanceAlert[];
    clearAlerts(): void;
    updateConfig(config: Partial<MonitoringConfig>): void;
    getConfig(): MonitoringConfig;
    reset(): void;
    getSummary(): {
        uptime: number;
        totalOperations: number;
        averageThroughput: number;
        averageLatency: number;
        errorRate: number;
        peakMemoryUsage: number;
        totalAlerts: number;
    };
}
