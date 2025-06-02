import { EventEmitter } from 'events';
import { IRaftStateMachine, RaftLogEntry, LogIndex } from './types';
export interface RaftStateMachineConfig {
    nodeId: string;
    dataPath: string;
    enableSnapshots: boolean;
    snapshotInterval: number;
}
export interface StateMachineState {
    lastAppliedIndex: LogIndex;
    lastAppliedTerm: number;
    appliedEntriesCount: number;
    snapshotCount: number;
}
export declare class RaftStateMachine extends EventEmitter implements IRaftStateMachine {
    private config;
    private database;
    private state;
    private collections;
    constructor(config: RaftStateMachineConfig);
    initialize(): Promise<void>;
    apply(entry: RaftLogEntry): Promise<any>;
    private applyCommand;
    private applyCreate;
    private applyUpdate;
    private applyDelete;
    private applyTransactionBegin;
    private applyTransactionCommit;
    private applyTransactionRollback;
    createSnapshot(): Promise<Buffer>;
    restoreSnapshot(data: Buffer): Promise<void>;
    getLastAppliedIndex(): Promise<LogIndex>;
    setLastAppliedIndex(index: LogIndex): Promise<void>;
    read(collectionName: string, query: any): Promise<any>;
    private serializeCollections;
    private deserializeCollections;
    private triggerSnapshot;
    getMetrics(): {
        lastAppliedIndex: number;
        lastAppliedTerm: number;
        appliedEntriesCount: number;
        snapshotCount: number;
        collectionsCount: number;
        collectionsNames: string[];
    };
    close(): Promise<void>;
    reset(): Promise<void>;
}
