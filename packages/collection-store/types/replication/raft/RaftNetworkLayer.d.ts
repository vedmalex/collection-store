import { EventEmitter } from 'events';
import { NodeId, RequestVoteRequest, RequestVoteResponse, AppendEntriesRequest, AppendEntriesResponse, InstallSnapshotRequest, InstallSnapshotResponse } from './types';
export interface RaftNetworkConfig {
    nodeId: NodeId;
    peers: Map<NodeId, PeerConfig>;
    requestTimeout: number;
    connectionTimeout: number;
    heartbeatTimeout: number;
    maxRetries: number;
    retryBaseDelay: number;
    retryMaxDelay: number;
    partitionDetectionEnabled: boolean;
    partitionThreshold: number;
    partitionRecoveryDelay: number;
}
export interface PeerConfig {
    nodeId: NodeId;
    host: string;
    port: number;
    protocol: 'http' | 'https' | 'tcp';
}
export interface NetworkMetrics {
    totalRequests: number;
    successfulRequests: number;
    failedRequests: number;
    timeoutRequests: number;
    retryAttempts: number;
    peerMetrics: Map<NodeId, PeerMetrics>;
    suspectedPartitions: Set<NodeId>;
    recoveredPartitions: Set<NodeId>;
    averageLatency: number;
    maxLatency: number;
    minLatency: number;
}
export interface PeerMetrics {
    nodeId: NodeId;
    totalRequests: number;
    successfulRequests: number;
    failedRequests: number;
    consecutiveFailures: number;
    lastSuccessTime: number;
    lastFailureTime: number;
    averageLatency: number;
    isPartitioned: boolean;
}
export interface RaftRPCRequest {
    type: 'RequestVote' | 'AppendEntries' | 'InstallSnapshot';
    requestId: string;
    sourceNodeId: NodeId;
    targetNodeId: NodeId;
    timestamp: number;
    data: any;
}
export interface RaftRPCResponse {
    type: 'RequestVote' | 'AppendEntries' | 'InstallSnapshot';
    requestId: string;
    sourceNodeId: NodeId;
    targetNodeId: NodeId;
    timestamp: number;
    success: boolean;
    data?: any;
    error?: string;
}
export declare class RaftNetworkLayer extends EventEmitter {
    private config;
    private metrics;
    private activeRequests;
    private retryQueues;
    private partitionRecoveryTimers;
    constructor(config: RaftNetworkConfig);
    private initializeMetrics;
    sendRequestVote(targetNodeId: NodeId, request: RequestVoteRequest): Promise<RequestVoteResponse>;
    sendAppendEntries(targetNodeId: NodeId, request: AppendEntriesRequest): Promise<AppendEntriesResponse>;
    sendInstallSnapshot(targetNodeId: NodeId, request: InstallSnapshotRequest): Promise<InstallSnapshotResponse>;
    private sendRPCRequest;
    private sendWithTimeout;
    private performNetworkRequest;
    private createMockResponse;
    private checkForPartition;
    private schedulePartitionRecovery;
    private attemptPartitionRecovery;
    sendWithRetry<TRequest, TResponse>(targetNodeId: NodeId, type: 'RequestVote' | 'AppendEntries' | 'InstallSnapshot', requestData: TRequest, maxRetries?: number): Promise<TResponse>;
    broadcastToAll<TRequest, TResponse>(type: 'RequestVote' | 'AppendEntries' | 'InstallSnapshot', requestData: TRequest, requireMajority?: boolean): Promise<Map<NodeId, TResponse | Error>>;
    private generateRequestId;
    private isPeerPartitioned;
    private updateMetricsOnSuccess;
    private updateMetricsOnFailure;
    getMetrics(): NetworkMetrics;
    getPeerMetrics(nodeId: NodeId): PeerMetrics | undefined;
    isHealthy(): boolean;
    close(): void;
    reset(): Promise<void>;
    simulateNetworkFailure(nodeId: NodeId, duration: number): void;
}
