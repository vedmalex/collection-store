export declare class CollectionStoreError extends Error {
    readonly code?: string;
    constructor(message: string, code?: string);
}
export declare class CollectionStoreValidationError extends CollectionStoreError {
    readonly violations: any[];
    constructor(message: string, violations: any[]);
}
export declare class CollectionStoreNotFoundError extends CollectionStoreError {
    constructor(entityName: string, where: any);
}
export declare class CollectionStoreConnectionError extends CollectionStoreError {
    constructor(message: string);
}
export declare class CollectionStoreTransactionError extends CollectionStoreError {
    constructor(message: string);
}
export declare class CollectionStoreSavepointError extends CollectionStoreError {
    readonly savepointId?: string;
    constructor(message: string, savepointId?: string);
}
