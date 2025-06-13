import { IStorageAdapter } from "../storage/IStorageAdapter";
import { IIndexManager } from "../collection/IIndexManager";

export type TransactionalCallback<T> = (
    storage: IStorageAdapter<any>,
    indexes: IIndexManager<any>
) => Promise<T>;


export class TransactionManager {
    private storageAdapter: IStorageAdapter<any>;
    private indexManager: IIndexManager<any>;

    constructor(storageAdapter: IStorageAdapter<any>, indexManager: IIndexManager<any>) {
        this.storageAdapter = storageAdapter;
        this.indexManager = indexManager;
    }

    public async execute<T>(callback: TransactionalCallback<T>): Promise<T> {
        const storageTxId = await this.storageAdapter.beginTransaction();
        const indexTxId = await this.indexManager.beginTransaction();

        // We need to ensure both transaction IDs are the same, or handle them separately.
        // For b-pl-tree, each index has its own context, and our storage has one.
        // A truly robust manager would coordinate this.
        // For now, we assume a simplified scenario where they might even be different.

        const createTransactionalAdapter = (txId: string): IStorageAdapter<any> => {
            // This proxy wraps the adapter to automatically pass the txId.
            return new Proxy(this.storageAdapter, {
                get: (target, prop, receiver) => {
                    if (['get', 'set', 'delete', 'keys', 'clear'].includes(String(prop))) {
                        return (key: string, value?: any) => {
                            return (target as any)[prop](key, value, txId);
                        };
                    }
                    return Reflect.get(target, prop, receiver);
                }
            });
        };

        const createTransactionalIndexManager = (txId: string): IIndexManager<any> => {
            return new Proxy(this.indexManager, {
                get: (target, prop, receiver) => {
                    if (['add', 'remove'].includes(String(prop))) {
                        return (field: string, value: any, docId: string) => {
                            return (target as any)[prop](field, value, docId, txId);
                        };
                    }
                    return Reflect.get(target, prop, receiver);
                }
            });
        };

        try {
            const result = await callback(
                createTransactionalAdapter(storageTxId),
                createTransactionalIndexManager(indexTxId)
            );

            await this.storageAdapter.commit(storageTxId);
            await this.indexManager.commit(indexTxId);

            return result;
        } catch (error) {
            await this.storageAdapter.rollback(storageTxId);
            await this.indexManager.rollback(indexTxId);
            throw error;
        }
    }
}