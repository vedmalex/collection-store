import { CollectionStoreConfig } from '../schemas/CollectionStoreConfig';
import { ConfigurationManager } from '../ConfigurationManager';
import { NodeRoleManager, NodeRole } from '../nodes/NodeRoleManager';

export interface TransactionConfig {
  timeout: number; // milliseconds
  maxRetries: number;
  retryDelay: number; // milliseconds
  isolationLevel: 'READ_UNCOMMITTED' | 'READ_COMMITTED' | 'REPEATABLE_READ' | 'SERIALIZABLE';
  enableDistributed: boolean;
  enableTwoPhaseCommit: boolean;
  coordinatorNodeId?: string;
}

export interface DatabaseConnection {
  id: string;
  type: 'primary' | 'secondary' | 'external';
  adapterType: string;
  connectionString?: string;
  config: Record<string, any>;
  enabled: boolean;
  priority: number;
  role: 'coordinator' | 'participant';
}

export interface CrossDatabaseTransaction {
  id: string;
  coordinatorNodeId: string;
  participantNodes: string[];
  databases: string[];
  status: 'PENDING' | 'PREPARING' | 'PREPARED' | 'COMMITTING' | 'COMMITTED' | 'ABORTING' | 'ABORTED';
  startTime: Date;
  timeout: number;
  operations: TransactionOperation[];
  metadata: Record<string, any>;
}

export interface TransactionOperation {
  id: string;
  databaseId: string;
  type: 'INSERT' | 'UPDATE' | 'DELETE' | 'QUERY';
  collection: string;
  data: any;
  conditions?: any;
  status: 'PENDING' | 'EXECUTED' | 'COMMITTED' | 'ABORTED';
  result?: any;
  error?: string;
}

export class CrossDatabaseConfig {
  private static config: TransactionConfig | null = null;
  private static connections: Map<string, DatabaseConnection> = new Map();
  private static activeTransactions: Map<string, CrossDatabaseTransaction> = new Map();
  private static transactionCallbacks: Set<(transaction: CrossDatabaseTransaction) => void> = new Set();

  /**
   * Initialize cross-database transaction configuration.
   */
  public static initialize(config?: CollectionStoreConfig): void {
    const nodeConfig = config || ConfigurationManager.getConfig();

    // Set default transaction configuration
    this.config = {
      timeout: nodeConfig.indexManager?.transactions?.timeout || 30000,
      maxRetries: 3,
      retryDelay: 1000,
      isolationLevel: 'READ_COMMITTED',
      enableDistributed: true,
      enableTwoPhaseCommit: true,
      coordinatorNodeId: NodeRoleManager.getCurrentNode()?.nodeId,
    };

    // Initialize database connections from adapters
    this.initializeDatabaseConnections(nodeConfig);

    // Register for configuration changes
    ConfigurationManager.onConfigChange((newConfig) => {
      this.handleConfigurationChange(newConfig);
    });

    console.log('Cross-database transaction configuration initialized');
  }

  /**
   * Get current transaction configuration.
   */
  public static getConfig(): TransactionConfig {
    if (!this.config) {
      throw new Error('Cross-database configuration not initialized');
    }
    return this.config;
  }

  /**
   * Update transaction configuration.
   */
  public static updateConfig(newConfig: Partial<TransactionConfig>): void {
    if (!this.config) {
      throw new Error('Cross-database configuration not initialized');
    }

    this.config = { ...this.config, ...newConfig };
    console.log('Cross-database transaction configuration updated');
  }

  /**
   * Register a database connection.
   */
  public static registerDatabase(connection: DatabaseConnection): void {
    this.connections.set(connection.id, connection);
    console.log(`Database registered: ${connection.id} (${connection.type})`);
  }

  /**
   * Unregister a database connection.
   */
  public static unregisterDatabase(databaseId: string): void {
    this.connections.delete(databaseId);
    console.log(`Database unregistered: ${databaseId}`);
  }

  /**
   * Get all registered database connections.
   */
  public static getDatabases(): DatabaseConnection[] {
    return Array.from(this.connections.values());
  }

  /**
   * Get database connection by ID.
   */
  public static getDatabase(databaseId: string): DatabaseConnection | undefined {
    return this.connections.get(databaseId);
  }

  /**
   * Get databases by type.
   */
  public static getDatabasesByType(type: DatabaseConnection['type']): DatabaseConnection[] {
    return this.getDatabases().filter(db => db.type === type);
  }

  /**
   * Get coordinator databases.
   */
  public static getCoordinatorDatabases(): DatabaseConnection[] {
    return this.getDatabases().filter(db => db.role === 'coordinator');
  }

  /**
   * Get participant databases.
   */
  public static getParticipantDatabases(): DatabaseConnection[] {
    return this.getDatabases().filter(db => db.role === 'participant');
  }

  /**
   * Start a new cross-database transaction.
   */
  public static startTransaction(
    databases: string[],
    coordinatorNodeId?: string
  ): CrossDatabaseTransaction {
    if (!this.config) {
      throw new Error('Cross-database configuration not initialized');
    }

    // Validate databases exist
    for (const dbId of databases) {
      if (!this.connections.has(dbId)) {
        throw new Error(`Database not found: ${dbId}`);
      }
    }

    // Determine coordinator
    const coordinator = coordinatorNodeId || this.config.coordinatorNodeId;
    if (!coordinator) {
      throw new Error('No coordinator node available');
    }

    // Create transaction
    const transaction: CrossDatabaseTransaction = {
      id: this.generateTransactionId(),
      coordinatorNodeId: coordinator,
      participantNodes: this.getParticipantNodes(databases),
      databases,
      status: 'PENDING',
      startTime: new Date(),
      timeout: this.config.timeout,
      operations: [],
      metadata: {},
    };

    this.activeTransactions.set(transaction.id, transaction);
    this.notifyTransactionChange(transaction);

    console.log(`Cross-database transaction started: ${transaction.id}`);
    return transaction;
  }

  /**
   * Add operation to transaction.
   */
  public static addOperation(
    transactionId: string,
    operation: Omit<TransactionOperation, 'id' | 'status'>
  ): TransactionOperation {
    const transaction = this.activeTransactions.get(transactionId);
    if (!transaction) {
      throw new Error(`Transaction not found: ${transactionId}`);
    }

    if (transaction.status !== 'PENDING') {
      throw new Error(`Cannot add operation to transaction in status: ${transaction.status}`);
    }

    const fullOperation: TransactionOperation = {
      ...operation,
      id: this.generateOperationId(),
      status: 'PENDING',
    };

    transaction.operations.push(fullOperation);
    this.notifyTransactionChange(transaction);

    return fullOperation;
  }

  /**
   * Prepare transaction (Phase 1 of 2PC).
   */
  public static async prepareTransaction(transactionId: string): Promise<boolean> {
    const transaction = this.activeTransactions.get(transactionId);
    if (!transaction) {
      throw new Error(`Transaction not found: ${transactionId}`);
    }

    if (transaction.status !== 'PENDING') {
      throw new Error(`Cannot prepare transaction in status: ${transaction.status}`);
    }

    transaction.status = 'PREPARING';
    this.notifyTransactionChange(transaction);

    try {
      // Check if current node can coordinate transactions
      const currentNode = NodeRoleManager.getCurrentNode();
      if (!currentNode || !NodeRoleManager.canPerformOperation('canTransaction')) {
        throw new Error('Current node cannot coordinate transactions');
      }

      // Prepare all operations
      let allPrepared = true;
      for (const operation of transaction.operations) {
        const prepared = await this.prepareOperation(operation);
        if (!prepared) {
          allPrepared = false;
          break;
        }
      }

      if (allPrepared) {
        transaction.status = 'PREPARED';
        console.log(`Transaction prepared: ${transactionId}`);
      } else {
        transaction.status = 'ABORTING';
        console.log(`Transaction preparation failed: ${transactionId}`);
      }

      this.notifyTransactionChange(transaction);
      return allPrepared;

    } catch (error) {
      transaction.status = 'ABORTING';
      console.error(`Error preparing transaction ${transactionId}:`, error);
      this.notifyTransactionChange(transaction);
      return false;
    }
  }

  /**
   * Commit transaction (Phase 2 of 2PC).
   */
  public static async commitTransaction(transactionId: string): Promise<boolean> {
    const transaction = this.activeTransactions.get(transactionId);
    if (!transaction) {
      throw new Error(`Transaction not found: ${transactionId}`);
    }

    if (transaction.status !== 'PREPARED') {
      throw new Error(`Cannot commit transaction in status: ${transaction.status}`);
    }

    transaction.status = 'COMMITTING';
    this.notifyTransactionChange(transaction);

    try {
      // Commit all operations
      let allCommitted = true;
      for (const operation of transaction.operations) {
        const committed = await this.commitOperation(operation);
        if (!committed) {
          allCommitted = false;
          break;
        }
      }

      if (allCommitted) {
        transaction.status = 'COMMITTED';
        console.log(`Transaction committed: ${transactionId}`);
      } else {
        transaction.status = 'ABORTING';
        console.log(`Transaction commit failed: ${transactionId}`);
      }

      this.notifyTransactionChange(transaction);
      return allCommitted;

    } catch (error) {
      transaction.status = 'ABORTING';
      console.error(`Error committing transaction ${transactionId}:`, error);
      this.notifyTransactionChange(transaction);
      return false;
    }
  }

  /**
   * Abort transaction.
   */
  public static async abortTransaction(transactionId: string): Promise<void> {
    const transaction = this.activeTransactions.get(transactionId);
    if (!transaction) {
      throw new Error(`Transaction not found: ${transactionId}`);
    }

    transaction.status = 'ABORTING';
    this.notifyTransactionChange(transaction);

    try {
      // Abort all operations
      for (const operation of transaction.operations) {
        await this.abortOperation(operation);
      }

      transaction.status = 'ABORTED';
      console.log(`Transaction aborted: ${transactionId}`);

    } catch (error) {
      console.error(`Error aborting transaction ${transactionId}:`, error);
      transaction.status = 'ABORTED';
    }

    this.notifyTransactionChange(transaction);
  }

  /**
   * Get transaction by ID.
   */
  public static getTransaction(transactionId: string): CrossDatabaseTransaction | undefined {
    return this.activeTransactions.get(transactionId);
  }

  /**
   * Get all active transactions.
   */
  public static getActiveTransactions(): CrossDatabaseTransaction[] {
    return Array.from(this.activeTransactions.values());
  }

  /**
   * Get transactions by status.
   */
  public static getTransactionsByStatus(status: CrossDatabaseTransaction['status']): CrossDatabaseTransaction[] {
    return this.getActiveTransactions().filter(tx => tx.status === status);
  }

  /**
   * Register callback for transaction changes.
   */
  public static onTransactionChange(callback: (transaction: CrossDatabaseTransaction) => void): void {
    this.transactionCallbacks.add(callback);
  }

  /**
   * Unregister transaction change callback.
   */
  public static offTransactionChange(callback: (transaction: CrossDatabaseTransaction) => void): void {
    this.transactionCallbacks.delete(callback);
  }

  /**
   * Clean up completed transactions.
   */
  public static cleanupTransactions(): void {
    const completedStatuses: CrossDatabaseTransaction['status'][] = ['COMMITTED', 'ABORTED'];
    const now = new Date();
    const cleanupThreshold = 300000; // 5 minutes

    for (const [id, transaction] of this.activeTransactions.entries()) {
      if (completedStatuses.includes(transaction.status)) {
        const age = now.getTime() - transaction.startTime.getTime();
        if (age > cleanupThreshold) {
          this.activeTransactions.delete(id);
          console.log(`Cleaned up transaction: ${id}`);
        }
      }
    }
  }

  /**
   * Initialize database connections from configuration.
   */
  private static initializeDatabaseConnections(config: CollectionStoreConfig): void {
    // Register primary database
    this.registerDatabase({
      id: 'primary',
      type: 'primary',
      adapterType: 'collection-store',
      config: config.indexManager || {},
      enabled: true,
      priority: 1,
      role: 'coordinator',
    });

    // Register external adapters as databases
    for (const [adapterId, adapterConfig] of Object.entries(config.adapters)) {
      if (adapterConfig.enabled) {
        this.registerDatabase({
          id: adapterId,
          type: 'external',
          adapterType: adapterConfig.type,
          config: adapterConfig.config || {},
          enabled: adapterConfig.enabled,
          priority: adapterConfig.priority,
          role: adapterConfig.role === 'primary' ? 'coordinator' : 'participant',
        });
      }
    }
  }

  /**
   * Handle configuration changes.
   */
  private static handleConfigurationChange(newConfig: CollectionStoreConfig): void {
    if (!this.config) return;

    // Update transaction timeout from IndexManager config
    if (newConfig.indexManager?.transactions?.timeout) {
      this.config.timeout = newConfig.indexManager.transactions.timeout;
    }

    // Update coordinator node if needed
    const currentNode = NodeRoleManager.getCurrentNode();
    if (currentNode) {
      this.config.coordinatorNodeId = currentNode.nodeId;
    }

    // Reinitialize database connections
    this.connections.clear();
    this.initializeDatabaseConnections(newConfig);

    console.log('Cross-database configuration updated from config change');
  }

  /**
   * Get participant nodes for databases.
   */
  private static getParticipantNodes(databases: string[]): string[] {
    const nodes = new Set<string>();

    for (const dbId of databases) {
      const db = this.connections.get(dbId);
      if (db && db.role === 'participant') {
        // In a real implementation, this would map to actual node IDs
        nodes.add(`node-${dbId}`);
      }
    }

    return Array.from(nodes);
  }

  /**
   * Prepare a single operation.
   */
  private static async prepareOperation(operation: TransactionOperation): Promise<boolean> {
    try {
      // In a real implementation, this would prepare the operation on the target database
      // For now, we'll simulate preparation
      operation.status = 'EXECUTED';
      return true;
    } catch (error) {
      operation.error = (error as Error).message;
      return false;
    }
  }

  /**
   * Commit a single operation.
   */
  private static async commitOperation(operation: TransactionOperation): Promise<boolean> {
    try {
      // In a real implementation, this would commit the operation on the target database
      operation.status = 'COMMITTED';
      return true;
    } catch (error) {
      operation.error = (error as Error).message;
      return false;
    }
  }

  /**
   * Abort a single operation.
   */
  private static async abortOperation(operation: TransactionOperation): Promise<void> {
    try {
      // In a real implementation, this would rollback the operation on the target database
      operation.status = 'ABORTED';
    } catch (error) {
      operation.error = (error as Error).message;
    }
  }

  /**
   * Generate unique transaction ID.
   */
  private static generateTransactionId(): string {
    const timestamp = Date.now().toString(36);
    const random = Math.random().toString(36).substring(2, 8);
    return `tx-${timestamp}-${random}`;
  }

  /**
   * Generate unique operation ID.
   */
  private static generateOperationId(): string {
    const timestamp = Date.now().toString(36);
    const random = Math.random().toString(36).substring(2, 6);
    return `op-${timestamp}-${random}`;
  }

  /**
   * Notify callbacks about transaction changes.
   */
  private static notifyTransactionChange(transaction: CrossDatabaseTransaction): void {
    for (const callback of this.transactionCallbacks) {
      try {
        callback(transaction);
      } catch (error) {
        console.error('Error in transaction change callback:', error);
      }
    }
  }

  /**
   * Cleanup method.
   */
  public static cleanup(): void {
    this.config = null;
    this.connections.clear();
    this.activeTransactions.clear();
    this.transactionCallbacks.clear();
  }
}
