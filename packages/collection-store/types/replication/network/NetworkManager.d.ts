import { EventEmitter } from 'events';
import { INetworkManager, ReplicationMessage, ReplicationMetrics } from '../types/ReplicationTypes';
export declare class NetworkManager extends EventEmitter implements INetworkManager {
    readonly nodeId: string;
    private port;
    private server?;
    private connections;
    private connectionAttempts;
    private maxRetries;
    private retryDelay;
    private metrics;
    private closed;
    constructor(nodeId: string, port: number);
    private startServer;
    private setupConnection;
    private extractNodeId;
    private validateMessage;
    private calculateChecksum;
    sendMessage(nodeId: string, message: ReplicationMessage): Promise<void>;
    broadcastMessage(message: ReplicationMessage): Promise<void>;
    connect(nodeId: string, address: string, port: number): Promise<void>;
    disconnect(nodeId: string): Promise<void>;
    getConnectedNodes(): string[];
    isConnected(nodeId: string): boolean;
    onMessage(handler: (message: ReplicationMessage) => void): void;
    getMetrics(): ReplicationMetrics;
    private updateLatencyMetrics;
    close(): Promise<void>;
}
