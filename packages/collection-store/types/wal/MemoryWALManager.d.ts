import { IWALManager, WALEntry, WALCheckpoint, WALManagerOptions } from './WALTypes';
export declare class MemoryWALManager implements IWALManager {
    private entries;
    private sequenceCounter;
    private options;
    private closed;
    constructor(options?: WALManagerOptions);
    writeEntry(entry: WALEntry): Promise<void>;
    readEntries(fromSequence?: number): Promise<WALEntry[]>;
    truncate(beforeSequence: number): Promise<void>;
    flush(): Promise<void>;
    recover(): Promise<void>;
    createCheckpoint(): Promise<WALCheckpoint>;
    getCurrentSequence(): number;
    close(): Promise<void>;
    getEntriesCount(): number;
    clear(): void;
    private calculateChecksum;
    private replayTransaction;
    private rollbackTransaction;
}
