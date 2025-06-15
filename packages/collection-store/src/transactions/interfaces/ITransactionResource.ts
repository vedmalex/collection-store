export interface ITransactionResource {
  prepareCommit(transactionId: string): Promise<boolean>;
  finalizeCommit(transactionId: string): Promise<void>;
  rollback(transactionId: string): Promise<void>;
}