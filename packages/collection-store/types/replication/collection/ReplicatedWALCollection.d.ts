import { EventEmitter } from 'events';
import { WALCollection } from '../../WALCollection';
import { ReplicatedWALOptions } from '../wal/ReplicatedWALManager';
import { ClusterConfig } from '../types/ReplicationTypes';
import { Item } from '../../types/Item';
export interface ReplicatedCollectionOptions<T extends Item> {
    name: string;
    root: string;
    cluster: ClusterConfig;
    enableTransactions?: boolean;
    walOptions?: Partial<ReplicatedWALOptions>;
}
export declare class ReplicatedWALCollection<T extends Item> extends EventEmitter {
    private walCollection;
    private replicatedWALManager;
    private networkManager;
    private clusterConfig;
    private isInitialized;
    constructor(options: ReplicatedCollectionOptions<T>);
    private setupEventHandlers;
    initialize(): Promise<void>;
    insert(item: T): Promise<T>;
    update(id: any, updates: Partial<T>): Promise<T | undefined>;
    delete(id: any): Promise<boolean>;
    find(query?: any): Promise<T[]>;
    findOne(query?: any): Promise<T | undefined>;
    findById(id: any): Promise<T | undefined>;
    count(query?: any): Promise<number>;
    clear(): Promise<void>;
    beginTransaction(): Promise<string>;
    commitTransaction(transactionId: string): Promise<void>;
    rollbackTransaction(transactionId: string): Promise<void>;
    promoteToLeader(): Promise<void>;
    demoteToFollower(): Promise<void>;
    getRole(): 'LEADER' | 'FOLLOWER' | 'CANDIDATE';
    getReplicationStatus(): import("../types/ReplicationTypes").ReplicationStatus;
    getClusterStatus(): {
        nodeId: string;
        role: "LEADER" | "FOLLOWER" | "CANDIDATE";
        connectedNodes: number;
        totalNodes: number;
        connectedNodeIds: string[];
        replicationStatus: import("../types/ReplicationTypes").ReplicationStatus;
        networkMetrics: import("../types/ReplicationTypes").ReplicationMetrics;
    };
    syncWithCluster(): Promise<void>;
    createCheckpoint(): Promise<void>;
    close(): Promise<void>;
    onEntryReplicated(handler: (entry: any) => void): void;
    onEntryReceived(handler: (entry: any, sourceNode: string) => void): void;
    onReplicationError(handler: (error: Error, entry?: any) => void): void;
    onRoleChanged(handler: (role: 'LEADER' | 'FOLLOWER' | 'CANDIDATE') => void): void;
    onNodeConnected(handler: (nodeId: string) => void): void;
    onNodeDisconnected(handler: (nodeId: string) => void): void;
    onNetworkError(handler: (error: Error) => void): void;
    get collection(): WALCollection<T>;
    get name(): string;
}
