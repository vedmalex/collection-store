export interface WALEntry {
    transactionId: string;
    sequenceNumber: number;
    timestamp: number;
    type: 'BEGIN' | 'PREPARE' | 'COMMIT' | 'ROLLBACK' | 'DATA';
    collectionName: string;
    operation: 'INSERT' | 'UPDATE' | 'DELETE' | 'INDEX_CHANGE' | 'STORE' | 'BEGIN' | 'COMMIT';
    data: {
        key: any;
        oldValue?: any;
        newValue?: any;
        indexName?: string;
        checkpointId?: string;
        [key: string]: any;
    };
    checksum: string;
}
export interface WALCheckpoint {
    checkpointId: string;
    timestamp: number;
    sequenceNumber: number;
    transactionIds: string[];
}
export interface IWALManager {
    writeEntry(entry: WALEntry): Promise<void>;
    readEntries(fromSequence?: number): Promise<WALEntry[]>;
    truncate(beforeSequence: number): Promise<void>;
    flush(): Promise<void>;
    recover(): Promise<void>;
    createCheckpoint(): Promise<WALCheckpoint>;
    getCurrentSequence(): number;
    close(): Promise<void>;
}
export interface WALManagerOptions {
    walPath?: string;
    flushInterval?: number;
    maxBufferSize?: number;
    enableCompression?: boolean;
    enableChecksums?: boolean;
}
