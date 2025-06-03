/**
 * Phase 5.3: Offline-First Support - Resolution Strategies Export
 * Day 2: Conflict Resolution System
 *
 * ✅ IDEA: Central export for all resolution strategies
 * ✅ IDEA: Easy import and strategy management
 */

// Base strategy
export { BaseResolutionStrategy } from './base-strategy';

// Concrete strategies
export { ClientWinsStrategy } from './client-wins.strategy';
export { ServerWinsStrategy } from './server-wins.strategy';
export { TimestampBasedStrategy } from './timestamp-based.strategy';
export { MergeStrategy, type MergeRule, type MergeConfig } from './merge.strategy';

// Strategy factory for easy instantiation
import type { ConflictResolutionStrategy, IResolutionStrategy } from '../../interfaces';
import { ClientWinsStrategy } from './client-wins.strategy';
import { ServerWinsStrategy } from './server-wins.strategy';
import { TimestampBasedStrategy } from './timestamp-based.strategy';
import { MergeStrategy } from './merge.strategy';

/**
 * Factory for creating resolution strategies
 */
export class StrategyFactory {
  /**
   * Create a strategy instance by name
   */
  static createStrategy(name: ConflictResolutionStrategy, config?: any): IResolutionStrategy {
    switch (name) {
      case 'client-wins':
        return new ClientWinsStrategy();

      case 'server-wins':
        return new ServerWinsStrategy();

      case 'timestamp-based':
        return new TimestampBasedStrategy(config?.timestampTolerance);

      case 'merge':
        return new MergeStrategy(config);

      case 'manual':
        throw new Error('Manual strategy requires special handling - use ManualResolver');

      case 'custom':
        throw new Error('Custom strategy must be provided directly');

      default:
        throw new Error(`Unknown strategy: ${name}`);
    }
  }

  /**
   * Get all available strategy names
   */
  static getAvailableStrategies(): ConflictResolutionStrategy[] {
    return ['client-wins', 'server-wins', 'timestamp-based', 'merge'];
  }

  /**
   * Create default strategy set
   */
  static createDefaultStrategies(): IResolutionStrategy[] {
    return [
      new ClientWinsStrategy(),
      new ServerWinsStrategy(),
      new TimestampBasedStrategy(),
      new MergeStrategy()
    ];
  }

  /**
   * Get strategy priority order (highest to lowest)
   */
  static getStrategyPriorities(): Record<ConflictResolutionStrategy, number> {
    return {
      'merge': 4,
      'timestamp-based': 3,
      'server-wins': 2,
      'client-wins': 1,
      'manual': 0,
      'custom': 5
    };
  }
}