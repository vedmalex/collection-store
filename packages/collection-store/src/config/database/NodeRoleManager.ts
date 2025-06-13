import { ConfigurationManager } from '../ConfigurationManager';

export type NodeRole = 'primary' | 'backup' | 'readonly' | 'worker';

export class NodeRoleManager {
  /**
   * Determines the role of the current node based on its ID and the configuration.
   * This is a simplified implementation. In a real distributed system, this would
   * involve more complex logic, potentially including leader election.
   *
   * @param nodeId The unique identifier for the node.
   * @returns The determined role of the node.
   * @throws {Error} If the node ID is not found in any adapter configuration.
   */
  public static getNodeRole(nodeId: string): NodeRole {
    const config = ConfigurationManager.getConfig();

    // In this simplified model, we assume a node's role is tied to an adapter's role.
    // A more complex setup might have a dedicated 'nodes' section in the config.
    for (const adapterName in config.adapters) {
      // This is a placeholder for logic that would map a nodeId to an adapter.
      // For now, let's assume the first adapter's role is the node's role if the nodeId matches.
      // This part of the logic needs to be refined once node identification is clearer.
      if (config.core.nodeId === nodeId) {
        return config.adapters[adapterName].role;
      }
    }

    throw new Error(`Role for node ID "${nodeId}" could not be determined from the configuration.`);
  }
}
