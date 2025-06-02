import { EventEmitter } from 'events';
import { IWALManager, WALEntry, WALCheckpoint, WALManagerOptions } from '../../wal/WALTypes';
import { INetworkManager, ReplicationConfig } from '../types/ReplicationTypes';
export interface ReplicatedWALOptions extends WALManagerOptions {
    replication: {
        enabled: boolean;
        networkManager: INetworkManager;
        config: ReplicationConfig;
        role?: 'LEADER' | 'FOLLOWER' | 'CANDIDATE';
    };
}
export declare class ReplicatedWALManager extends EventEmitter implements IWALManager {
    private fileWALManager;
    private replicationManager?;
    private options;
    private role;
    private isReplicationEnabled;
    constructor(options: ReplicatedWALOptions);
    private initializeReplication;
    writeEntry(entry: WALEntry): Promise<void>;
    readEntries(fromSequence?: number): Promise<WALEntry[]>;
    truncate(beforeSequence: number): Promise<void>;
    flush(): Promise<void>;
    recover(): Promise<void>;
    createCheckpoint(): Promise<WALCheckpoint>;
    getCurrentSequence(): number;
    close(): Promise<void>;
    setRole(role: 'LEADER' | 'FOLLOWER' | 'CANDIDATE'): void;
    getRole(): 'LEADER' | 'FOLLOWER' | 'CANDIDATE';
    promoteToLeader(): Promise<void>;
    demoteToFollower(): Promise<void>;
    syncWithCluster(): Promise<void>;
    getReplicationStatus(): import("../types/ReplicationTypes").ReplicationStatus;
    isReplicationActive(): boolean;
    enableReplication(): Promise<void>;
    disableReplication(): Promise<void>;
    onEntryReplicated(handler: (entry: WALEntry) => void): void;
    onEntryReceived(handler: (entry: WALEntry, sourceNode: string) => void): void;
    onReplicationError(handler: (error: Error, entry?: WALEntry) => void): void;
    onRoleChanged(handler: (role: 'LEADER' | 'FOLLOWER' | 'CANDIDATE') => void): void;
}
