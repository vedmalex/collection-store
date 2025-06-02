import { IWALManager, WALEntry, WALCheckpoint, WALManagerOptions } from './WALTypes';
export declare class FileWALManager implements IWALManager {
    private walFile;
    private sequenceCounter;
    private writeBuffer;
    private flushTimer?;
    private options;
    private closed;
    constructor(options?: WALManagerOptions);
    private initializeWAL;
    private startFlushTimer;
    writeEntry(entry: WALEntry): Promise<void>;
    readEntries(fromSequence?: number): Promise<WALEntry[]>;
    truncate(beforeSequence: number): Promise<void>;
    flush(): Promise<void>;
    recover(): Promise<void>;
    createCheckpoint(): Promise<WALCheckpoint>;
    getCurrentSequence(): number;
    close(): Promise<void>;
    private calculateChecksum;
    private replayTransaction;
    private rollbackTransaction;
}
