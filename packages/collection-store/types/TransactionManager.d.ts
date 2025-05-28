export interface TransactionOptions {
    timeout?: number;
    isolationLevel?: 'READ_COMMITTED' | 'SNAPSHOT_ISOLATION';
}
export interface ChangeRecord {
    type: 'insert' | 'update' | 'delete';
    collection: string;
    key: any;
    oldValue?: any;
    newValue?: any;
    timestamp: number;
}
export interface SavepointInfo {
    savepointId: string;
    name: string;
    timestamp: number;
    transactionId: string;
    collectionsCount: number;
    btreeContextsCount: number;
}
export interface CSDBSavepointData {
    savepointId: string;
    name: string;
    timestamp: number;
    transactionId: string;
    collectionsSnapshot: Map<string, any[]>;
    btreeContextSnapshots: Map<string, string>;
}
export interface CSTransaction {
    startTransaction(options?: TransactionOptions): Promise<void>;
    abortTransaction(): Promise<void>;
    commitTransaction(): Promise<void>;
    endSession(): Promise<void>;
    getCurrentTransactionId(): string | undefined;
    getCurrentTransaction(): CollectionStoreTransaction | undefined;
    activeTransactionCount: number;
    createSavepoint(name: string): Promise<string>;
    rollbackToSavepoint(savepointId: string): Promise<void>;
    releaseSavepoint(savepointId: string): Promise<void>;
    listSavepoints(): string[];
    getSavepointInfo(savepointId: string): SavepointInfo | undefined;
}
export interface ITransactionResource {
    prepareCommit(transactionId: string): Promise<boolean>;
    finalizeCommit(transactionId: string): Promise<void>;
    rollback(transactionId: string): Promise<void>;
}
export declare class CollectionStoreTransaction {
    readonly transactionId: string;
    readonly startTime: number;
    readonly options: TransactionOptions;
    private _affectedResources;
    private _changes;
    private _status;
    constructor(transactionId: string, options?: TransactionOptions);
    get status(): "ACTIVE" | "PREPARING" | "PREPARED" | "COMMITTED" | "ABORTED";
    get changes(): readonly ChangeRecord[];
    get affectedResources(): ReadonlySet<ITransactionResource>;
    addAffectedResource(resource: ITransactionResource): void;
    recordChange(change: ChangeRecord): void;
    prepare(): Promise<boolean>;
    commit(): Promise<void>;
    rollback(): Promise<void>;
}
export declare class TransactionManager {
    private _activeTransactions;
    private _changeListeners;
    beginTransaction(options?: TransactionOptions): Promise<string>;
    getTransaction(transactionId: string): CollectionStoreTransaction;
    commitTransaction(transactionId: string): Promise<void>;
    rollbackTransaction(transactionId: string): Promise<void>;
    addChangeListener(listener: (changes: readonly ChangeRecord[]) => void): void;
    removeChangeListener(listener: (changes: readonly ChangeRecord[]) => void): void;
    private _notifyChanges;
    cleanup(): Promise<void>;
    get activeTransactionCount(): number;
    getActiveTransactionIds(): string[];
}
