import { describe, it, expect, beforeEach } from 'bun:test';
import { ConfigurationManager } from '../ConfigurationManager';
import { NodeRoleManager } from '../database/NodeRoleManager';
import type { CollectionStoreConfig } from '../schemas/CollectionStoreConfig';

describe('NodeRoleManager', () => {

  beforeEach(() => {
    // Reset the static ConfigurationManager state
    (ConfigurationManager as any).currentConfig = null;
  });

  it('should return the correct role for a configured node', () => {
    const mockConfig: CollectionStoreConfig = {
      core: {
        name: 'test',
        version: '1.0',
        environment: 'development',
        nodeId: 'node-1',
      },
      adapters: {
        primaryAdapter: {
          enabled: true,
          priority: 1,
          role: 'primary',
          type: 'memory',
        },
      },
      features: {
        replication: { enabled: false },
        realtime: { enabled: false },
        offline: { enabled: false },
        analytics: { enabled: false },
      },
    };

    // Manually set the config for the test
    (ConfigurationManager as any).currentConfig = mockConfig;

    const role = NodeRoleManager.getNodeRole('node-1');
    expect(role).toBe('primary');
  });

  it('should throw an error if the node ID does not match the one in the config', () => {
    const mockConfig: CollectionStoreConfig = {
      core: {
        name: 'test',
        version: '1.0',
        environment: 'development',
        nodeId: 'node-1',
      },
      adapters: {
        adapter: {
          enabled: true,
          priority: 1,
          role: 'primary',
          type: 'memory',
        },
      },
      features: {
        replication: { enabled: false },
        realtime: { enabled: false },
        offline: { enabled: false },
        analytics: { enabled: false },
      },
    };

    (ConfigurationManager as any).currentConfig = mockConfig;

    expect(() => {
      NodeRoleManager.getNodeRole('unknown-node');
    }).toThrow('Role for node ID "unknown-node" could not be determined from the configuration.');
  });

  it('should throw an error if no configuration is loaded', () => {
    expect(() => {
      NodeRoleManager.getNodeRole('any-node');
    }).toThrow('Configuration has not been loaded. Call loadFromFile() first.');
  });
});