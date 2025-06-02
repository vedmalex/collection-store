import { EventEmitter } from 'events';
import { NodeId, Term, LogIndex, AppendEntriesRequest, AppendEntriesResponse } from './types';
import { IRaftLogManager } from './types';
export interface LogReplicationConfig {
    nodeId: NodeId;
    peers: NodeId[];
    maxEntriesPerRequest: number;
    replicationTimeout: number;
    retryInterval: number;
    maxRetries: number;
}
export interface ReplicationState {
    nextIndex: Map<NodeId, LogIndex>;
    matchIndex: Map<NodeId, LogIndex>;
    replicationInProgress: Set<NodeId>;
    lastReplicationTime: Map<NodeId, number>;
    replicationErrors: Map<NodeId, number>;
}
export declare class LogReplication extends EventEmitter {
    private config;
    private state;
    private logManager;
    private rpcHandler?;
    private replicationTimer?;
    constructor(config: LogReplicationConfig, logManager: IRaftLogManager);
    private initializePeerState;
    setRPCHandler(handler: (nodeId: NodeId, request: AppendEntriesRequest) => Promise<AppendEntriesResponse>): void;
    startAsLeader(currentTerm: Term): Promise<void>;
    stop(): void;
    handleAppendEntries(request: AppendEntriesRequest): Promise<AppendEntriesResponse>;
    replicateToAll(currentTerm: Term): Promise<void>;
    private replicateToPeer;
    private tryAdvanceCommitIndex;
    private handleLogConflicts;
    private resetPeerState;
    private startPeriodicReplication;
    private stopPeriodicReplication;
    private getCurrentTerm;
    setCurrentTermGetter(getCurrentTerm: () => Promise<Term>): void;
    getMetrics(): {
        peers: Map<any, any>;
        activeReplications: number;
        totalPeers: number;
    };
    reset(): Promise<void>;
}
