// Transaction Management
export { TransactionManager } from '../transactions/TransactionManager'
export { TransactionalCollection } from './TransactionalCollection'

// Re-export types
export type {
  CSTransaction,
  SavepointInfo,
  CSDBSavepointData,
  TransactionOptions
} from '../transactions/TransactionManager'