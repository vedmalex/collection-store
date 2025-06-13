import type { CSTransaction } from 'collection-store';
export interface SavepointConnection {
    createSavepoint(ctx: CSTransaction, name: string): Promise<string>;
    rollbackToSavepoint(ctx: CSTransaction, savepointId: string): Promise<void>;
    releaseSavepoint(ctx: CSTransaction, savepointId: string): Promise<void>;
}
export interface SavepointInfo {
    savepointId: string;
    name: string;
    timestamp: number;
    transactionId: string;
    collectionsCount: number;
    btreeContextsCount: number;
}
export interface NestedTransactionOptions {
    isolationLevel?: 'READ_COMMITTED' | 'SNAPSHOT_ISOLATION';
    ctx?: CSTransaction;
    savepointName?: string;
    autoRelease?: boolean;
}
export interface SavepointMetadata {
    savepointId: string;
    name: string;
    parentTransaction: CSTransaction;
    createdAt: Date;
    isReleased: boolean;
}
export type { CSTransaction, SavepointInfo as CSDBSavepointInfo } from 'collection-store';
