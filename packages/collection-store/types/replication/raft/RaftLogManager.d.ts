import { EventEmitter } from 'events';
import { IRaftLogManager, RaftLogEntry, LogIndex, Term, NodeId } from './types';
export interface RaftLogManagerConfig {
    nodeId: NodeId;
    logPath: string;
    snapshotPath: string;
    snapshotThreshold: number;
    enableCompaction: boolean;
}
export declare class RaftLogManager extends EventEmitter implements IRaftLogManager {
    private walManager;
    private entries;
    private commitIndex;
    private lastApplied;
    private snapshotIndex;
    private snapshotTerm;
    private config;
    constructor(config: RaftLogManagerConfig);
    initialize(): Promise<void>;
    append(entries: RaftLogEntry[]): Promise<void>;
    getEntry(index: LogIndex): Promise<RaftLogEntry | null>;
    getEntries(startIndex: LogIndex, endIndex?: LogIndex): Promise<RaftLogEntry[]>;
    getLastIndex(): Promise<LogIndex>;
    getLastTerm(): Promise<Term>;
    getCommitIndex(): Promise<LogIndex>;
    setCommitIndex(index: LogIndex): Promise<void>;
    compact(lastIncludedIndex: LogIndex, lastIncludedTerm: Term): Promise<void>;
    persist(): Promise<void>;
    recover(): Promise<void>;
    close(): Promise<void>;
    private validateEntries;
    private toWALEntry;
    private fromWALEntry;
    private shouldCompact;
    private triggerCompaction;
    private persistMetadata;
    private recoverMetadata;
    private persistCompactionState;
    getMetrics(): {
        entriesCount: number;
        commitIndex: number;
        lastApplied: number;
        snapshotIndex: number;
        snapshotTerm: number;
        memoryUsage: number;
    };
    reset(): Promise<void>;
}
