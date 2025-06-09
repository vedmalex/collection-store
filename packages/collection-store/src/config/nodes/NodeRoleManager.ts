import { CollectionStoreConfig } from '../schemas/CollectionStoreConfig';
import { ConfigurationManager } from '../ConfigurationManager';

export enum NodeRole {
  PRIMARY = 'PRIMARY',
  SECONDARY = 'SECONDARY',
  CLIENT = 'CLIENT',
  BROWSER = 'BROWSER',
  ADAPTER = 'ADAPTER',
}

export interface NodeCapabilities {
  canWrite: boolean;
  canRead: boolean;
  canReplicate: boolean;
  canIndex: boolean;
  canTransaction: boolean;
  canCache: boolean;
  canOffline: boolean;
  canRealtime: boolean;
  maxConnections: number;
  storageLimit?: number; // in MB
  memoryLimit?: number; // in MB
}

export interface NodeInfo {
  nodeId: string;
  role: NodeRole;
  capabilities: NodeCapabilities;
  clusterId?: string;
  environment: 'development' | 'staging' | 'production';
  version: string;
  startTime: Date;
  lastHeartbeat: Date;
  metadata: Record<string, any>;
}

export class NodeRoleManager {
  private static currentNode: NodeInfo | null = null;
  private static clusterNodes: Map<string, NodeInfo> = new Map();
  private static roleChangeCallbacks: Set<(nodeInfo: NodeInfo) => void> = new Set();

  /**
   * Initialize the node with automatic role detection based on environment and configuration.
   */
  public static initialize(config?: CollectionStoreConfig): NodeInfo {
    const nodeConfig = config || ConfigurationManager.getConfig();

    // Detect node role based on environment and capabilities
    const detectedRole = this.detectNodeRole(nodeConfig);
    const capabilities = this.getCapabilitiesForRole(detectedRole, nodeConfig);

    this.currentNode = {
      nodeId: nodeConfig.core.nodeId || this.generateNodeId(),
      role: detectedRole,
      capabilities,
      clusterId: nodeConfig.core.clusterId,
      environment: nodeConfig.core.environment,
      version: nodeConfig.core.version,
      startTime: new Date(),
      lastHeartbeat: new Date(),
      metadata: {},
    };

    // Register for configuration changes
    ConfigurationManager.onConfigChange((newConfig) => {
      this.handleConfigurationChange(newConfig);
    });

    console.log(`Node initialized: ${this.currentNode.nodeId} as ${this.currentNode.role}`);
    return this.currentNode;
  }

  /**
   * Get current node information.
   */
  public static getCurrentNode(): NodeInfo | null {
    return this.currentNode;
  }

  /**
   * Get all known cluster nodes.
   */
  public static getClusterNodes(): NodeInfo[] {
    return Array.from(this.clusterNodes.values());
  }

  /**
   * Register a node in the cluster.
   */
  public static registerNode(nodeInfo: NodeInfo): void {
    this.clusterNodes.set(nodeInfo.nodeId, {
      ...nodeInfo,
      lastHeartbeat: new Date(),
    });

    console.log(`Node registered: ${nodeInfo.nodeId} as ${nodeInfo.role}`);
  }

  /**
   * Update heartbeat for a node.
   */
  public static updateHeartbeat(nodeId: string): void {
    const node = this.clusterNodes.get(nodeId);
    if (node) {
      node.lastHeartbeat = new Date();
    }

    // Update own heartbeat if it's our node
    if (this.currentNode && this.currentNode.nodeId === nodeId) {
      this.currentNode.lastHeartbeat = new Date();
    }
  }

  /**
   * Remove a node from the cluster (e.g., when it goes offline).
   */
  public static unregisterNode(nodeId: string): void {
    this.clusterNodes.delete(nodeId);
    console.log(`Node unregistered: ${nodeId}`);
  }

  /**
   * Get nodes by role.
   */
  public static getNodesByRole(role: NodeRole): NodeInfo[] {
    return this.getClusterNodes().filter(node => node.role === role);
  }

  /**
   * Get primary nodes in the cluster.
   */
  public static getPrimaryNodes(): NodeInfo[] {
    return this.getNodesByRole(NodeRole.PRIMARY);
  }

  /**
   * Get secondary nodes in the cluster.
   */
  public static getSecondaryNodes(): NodeInfo[] {
    return this.getNodesByRole(NodeRole.SECONDARY);
  }

  /**
   * Check if current node can perform a specific operation.
   */
  public static canPerformOperation(operation: keyof NodeCapabilities): boolean {
    if (!this.currentNode) {
      throw new Error('Node not initialized');
    }

    return this.currentNode.capabilities[operation] as boolean;
  }

  /**
   * Promote current node to a higher role (if possible).
   */
  public static promoteNode(newRole: NodeRole): boolean {
    if (!this.currentNode) {
      throw new Error('Node not initialized');
    }

    // Check if promotion is valid
    if (!this.isValidRoleTransition(this.currentNode.role, newRole)) {
      console.warn(`Invalid role transition from ${this.currentNode.role} to ${newRole}`);
      return false;
    }

    const oldRole = this.currentNode.role;
    this.currentNode.role = newRole;
    this.currentNode.capabilities = this.getCapabilitiesForRole(newRole);

    // Notify callbacks
    this.notifyRoleChange(this.currentNode);

    console.log(`Node promoted from ${oldRole} to ${newRole}`);
    return true;
  }

  /**
   * Demote current node to a lower role.
   */
  public static demoteNode(newRole: NodeRole): boolean {
    if (!this.currentNode) {
      throw new Error('Node not initialized');
    }

    const oldRole = this.currentNode.role;
    this.currentNode.role = newRole;
    this.currentNode.capabilities = this.getCapabilitiesForRole(newRole);

    // Notify callbacks
    this.notifyRoleChange(this.currentNode);

    console.log(`Node demoted from ${oldRole} to ${newRole}`);
    return true;
  }

  /**
   * Register a callback for role changes.
   */
  public static onRoleChange(callback: (nodeInfo: NodeInfo) => void): void {
    this.roleChangeCallbacks.add(callback);
  }

  /**
   * Unregister a role change callback.
   */
  public static offRoleChange(callback: (nodeInfo: NodeInfo) => void): void {
    this.roleChangeCallbacks.delete(callback);
  }

  /**
   * Get cluster health status.
   */
  public static getClusterHealth(): {
    totalNodes: number;
    primaryNodes: number;
    secondaryNodes: number;
    clientNodes: number;
    healthyNodes: number;
    unhealthyNodes: number;
  } {
    const nodes = this.getClusterNodes();
    const now = new Date();
    const healthThreshold = 30000; // 30 seconds

    const healthyNodes = nodes.filter(node =>
      now.getTime() - node.lastHeartbeat.getTime() < healthThreshold
    );

    return {
      totalNodes: nodes.length,
      primaryNodes: this.getNodesByRole(NodeRole.PRIMARY).length,
      secondaryNodes: this.getNodesByRole(NodeRole.SECONDARY).length,
      clientNodes: this.getNodesByRole(NodeRole.CLIENT).length,
      healthyNodes: healthyNodes.length,
      unhealthyNodes: nodes.length - healthyNodes.length,
    };
  }

    /**
   * Detect node role based on environment and configuration.
   */
  private static detectNodeRole(config: CollectionStoreConfig): NodeRole {
    const environment = config.core.environment;

    // Browser environment detection
    if (typeof globalThis !== 'undefined' &&
        typeof (globalThis as any).window !== 'undefined' &&
        typeof (globalThis as any).document !== 'undefined') {
      return NodeRole.BROWSER;
    }

    // Check if this is a dedicated adapter node (only external adapters, no primary storage)
    const hasOnlyExternalAdapters = Object.values(config.adapters).length > 0 &&
      Object.values(config.adapters).every(adapter =>
        adapter.enabled && ['mongodb', 'googlesheets', 'telegram', 'markdown'].includes(adapter.type)
      ) && !config.indexManager?.enabled;

    if (hasOnlyExternalAdapters) {
      return NodeRole.ADAPTER;
    }

    // Default role based on environment
    switch (environment) {
      case 'development':
        return NodeRole.PRIMARY; // Development usually runs as primary
      case 'staging':
        return NodeRole.SECONDARY; // Staging as secondary for testing
      case 'production':
        // In production, check cluster configuration
        if (config.core.clusterId) {
          // If part of cluster, default to secondary unless explicitly configured
          return NodeRole.SECONDARY;
        }
        return NodeRole.PRIMARY;
      default:
        return NodeRole.CLIENT;
    }
  }

  /**
   * Get capabilities for a specific role.
   */
  private static getCapabilitiesForRole(role: NodeRole, config?: CollectionStoreConfig): NodeCapabilities {
    const nodeConfig = config || ConfigurationManager.getConfig();
    const environment = nodeConfig.core.environment;

    switch (role) {
      case NodeRole.PRIMARY:
        return {
          canWrite: true,
          canRead: true,
          canReplicate: true,
          canIndex: true,
          canTransaction: true,
          canCache: true,
          canOffline: true,
          canRealtime: true,
          maxConnections: environment === 'production' ? 1000 : 100,
          storageLimit: environment === 'production' ? 10000 : 1000, // MB
          memoryLimit: environment === 'production' ? 4000 : 1000, // MB
        };

      case NodeRole.SECONDARY:
        return {
          canWrite: false,
          canRead: true,
          canReplicate: true,
          canIndex: true,
          canTransaction: false,
          canCache: true,
          canOffline: true,
          canRealtime: true,
          maxConnections: environment === 'production' ? 500 : 50,
          storageLimit: environment === 'production' ? 5000 : 500, // MB
          memoryLimit: environment === 'production' ? 2000 : 500, // MB
        };

      case NodeRole.CLIENT:
        return {
          canWrite: false,
          canRead: true,
          canReplicate: false,
          canIndex: false,
          canTransaction: false,
          canCache: true,
          canOffline: true,
          canRealtime: true,
          maxConnections: 10,
          storageLimit: 100, // MB
          memoryLimit: 200, // MB
        };

      case NodeRole.BROWSER:
        return {
          canWrite: false,
          canRead: true,
          canReplicate: false,
          canIndex: false,
          canTransaction: false,
          canCache: true,
          canOffline: true,
          canRealtime: true,
          maxConnections: 5,
          storageLimit: 50, // MB (IndexedDB)
          memoryLimit: 100, // MB
        };

      case NodeRole.ADAPTER:
        return {
          canWrite: true,
          canRead: true,
          canReplicate: false,
          canIndex: false,
          canTransaction: false,
          canCache: false,
          canOffline: false,
          canRealtime: false,
          maxConnections: 20,
          storageLimit: 200, // MB
          memoryLimit: 300, // MB
        };

      default:
        throw new Error(`Unknown node role: ${role}`);
    }
  }

  /**
   * Check if role transition is valid.
   */
  private static isValidRoleTransition(fromRole: NodeRole, toRole: NodeRole): boolean {
    // Define valid transitions
    const validTransitions: Record<NodeRole, NodeRole[]> = {
      [NodeRole.CLIENT]: [NodeRole.SECONDARY],
      [NodeRole.SECONDARY]: [NodeRole.PRIMARY, NodeRole.CLIENT],
      [NodeRole.PRIMARY]: [NodeRole.SECONDARY],
      [NodeRole.BROWSER]: [], // Browser nodes cannot be promoted
      [NodeRole.ADAPTER]: [], // Adapter nodes cannot be promoted
    };

    return validTransitions[fromRole]?.includes(toRole) || false;
  }

  /**
   * Generate a unique node ID.
   */
  private static generateNodeId(): string {
    const timestamp = Date.now().toString(36);
    const random = Math.random().toString(36).substring(2, 8);
    return `node-${timestamp}-${random}`;
  }

  /**
   * Handle configuration changes.
   */
  private static handleConfigurationChange(newConfig: CollectionStoreConfig): void {
    if (!this.currentNode) return;

    // Check if role should change based on new configuration
    const newRole = this.detectNodeRole(newConfig);
    if (newRole !== this.currentNode.role) {
      console.log(`Configuration change detected, updating role from ${this.currentNode.role} to ${newRole}`);
      this.currentNode.role = newRole;
      this.currentNode.capabilities = this.getCapabilitiesForRole(newRole, newConfig);
      this.notifyRoleChange(this.currentNode);
    }

    // Update other node properties
    this.currentNode.clusterId = newConfig.core.clusterId;
    this.currentNode.environment = newConfig.core.environment;
    this.currentNode.version = newConfig.core.version;
  }

  /**
   * Notify all callbacks about role changes.
   */
  private static notifyRoleChange(nodeInfo: NodeInfo): void {
    for (const callback of this.roleChangeCallbacks) {
      try {
        callback(nodeInfo);
      } catch (error) {
        console.error('Error in role change callback:', error);
      }
    }
  }

  /**
   * Cleanup method.
   */
  public static cleanup(): void {
    this.currentNode = null;
    this.clusterNodes.clear();
    this.roleChangeCallbacks.clear();
  }
}