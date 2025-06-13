import { EventEmitter } from 'events';
import {
  AttributeDependencyDetailed,
  DependencyChangeEvent,
  DependencyValidationResult,
  ComputedAttributeErrorFactory,
  ComputedAttributeErrorCodeDetailed
} from '../types';

/**
 * Configuration for DependencyTracker
 */
export interface DependencyTrackerConfig {
  maxDependencyDepth: number;
  enableCircularDependencyDetection: boolean;
  enablePerformanceHints: boolean;
  dependencyResolutionTimeout: number;
  maxDependenciesPerAttribute: number;
}

/**
 * Default configuration for DependencyTracker
 */
export const DEFAULT_DEPENDENCY_TRACKER_CONFIG: DependencyTrackerConfig = {
  maxDependencyDepth: 10,
  enableCircularDependencyDetection: true,
  enablePerformanceHints: true,
  dependencyResolutionTimeout: 5000,
  maxDependenciesPerAttribute: 50
};

/**
 * Simple DependencyTracker for Day 4 implementation
 * Manages basic dependencies between computed attributes
 */
export class DependencyTracker extends EventEmitter {
  private dependencies = new Map<string, AttributeDependencyDetailed[]>();
  private dependencyGraph = new Map<string, Set<string>>();
  private reverseDependencyGraph = new Map<string, Set<string>>();
  private config: DependencyTrackerConfig;
  private isInitialized = false;

  constructor(config: Partial<DependencyTrackerConfig> = {}) {
    super();
    this.config = { ...DEFAULT_DEPENDENCY_TRACKER_CONFIG, ...config };
  }

  /**
   * Initialize the dependency tracker
   */
  async initialize(): Promise<void> {
    if (this.isInitialized) {
      throw ComputedAttributeErrorFactory.create(
        'DependencyTracker already initialized',
        ComputedAttributeErrorCodeDetailed.DEPENDENCY_TRACKER_ALREADY_INITIALIZED,
        'configuration'
      );
    }

    this.isInitialized = true;
    this.emit('initialized');
  }

  /**
   * Add dependency for an attribute
   */
  async addDependency(
    attributeId: string,
    dependency: AttributeDependencyDetailed
  ): Promise<void> {
    this.ensureInitialized();

    // Validate dependency
    const validation = await this.validateDependency(attributeId, dependency);
    if (!validation.isValid) {
      throw ComputedAttributeErrorFactory.create(
        `Invalid dependency: ${validation.errors.join(', ')}`,
        ComputedAttributeErrorCodeDetailed.INVALID_DEPENDENCY,
        'validation'
      );
    }

    // Check for circular dependencies
    if (this.config.enableCircularDependencyDetection) {
      const wouldCreateCycle = this.wouldCreateCircularDependency(attributeId, dependency.attributeId);
      if (wouldCreateCycle) {
        throw ComputedAttributeErrorFactory.create(
          `Circular dependency detected: ${attributeId} -> ${dependency.attributeId}`,
          ComputedAttributeErrorCodeDetailed.CIRCULAR_DEPENDENCY,
          'dependency'
        );
      }
    }

    // Check max dependencies limit
    const currentDependencies = this.dependencies.get(attributeId) || [];
    if (currentDependencies.length >= this.config.maxDependenciesPerAttribute) {
      throw ComputedAttributeErrorFactory.create(
        `Maximum dependencies limit exceeded for attribute: ${attributeId}`,
        ComputedAttributeErrorCodeDetailed.MAX_DEPENDENCIES_EXCEEDED,
        'configuration'
      );
    }

    // Add dependency
    if (!this.dependencies.has(attributeId)) {
      this.dependencies.set(attributeId, []);
    }
    this.dependencies.get(attributeId)!.push(dependency);

    // Update dependency graphs
    this.updateDependencyGraphs(attributeId, dependency.attributeId);

    // Emit change event
    const changeEvent: DependencyChangeEvent = {
      type: 'added',
      attributeId,
      dependency,
      timestamp: Date.now(),
      affectedAttributes: this.getAffectedAttributes(attributeId)
    };
    this.emit('dependencyChanged', changeEvent);
  }

  /**
   * Get all dependencies for an attribute
   */
  async getDependencies(attributeId: string): Promise<AttributeDependencyDetailed[]> {
    this.ensureInitialized();
    return this.dependencies.get(attributeId) || [];
  }

  /**
   * Resolve dependencies for computation order
   */
  async resolveDependencies(attributeIds: string[]): Promise<string[]> {
    this.ensureInitialized();

    const resolved: string[] = [];
    const visiting = new Set<string>();
    const visited = new Set<string>();

    const visit = (attributeId: string): void => {
      if (visited.has(attributeId)) {
        return;
      }

      if (visiting.has(attributeId)) {
        throw ComputedAttributeErrorFactory.create(
          `Circular dependency detected during resolution: ${attributeId}`,
          ComputedAttributeErrorCodeDetailed.CIRCULAR_DEPENDENCY,
          'dependency'
        );
      }

      visiting.add(attributeId);

      const dependencies = this.dependencies.get(attributeId) || [];
      for (const dep of dependencies) {
        visit(dep.attributeId);
      }

      visiting.delete(attributeId);
      visited.add(attributeId);
      resolved.push(attributeId);
    };

    for (const attributeId of attributeIds) {
      visit(attributeId);
    }

    return resolved;
  }

  /**
   * Validate dependency
   */
  async validateDependency(
    attributeId: string,
    dependency: AttributeDependencyDetailed
  ): Promise<DependencyValidationResult> {
    const errors: string[] = [];
    const warnings: string[] = [];

    // Basic validation
    if (!dependency.attributeId) {
      errors.push('Dependency attribute ID is required');
    }

    if (dependency.attributeId === attributeId) {
      errors.push('Attribute cannot depend on itself');
    }

    // Check dependency depth
    const depth = this.calculateDependencyDepth(dependency.attributeId);
    if (depth >= this.config.maxDependencyDepth) {
      errors.push(`Dependency depth exceeds maximum: ${depth} >= ${this.config.maxDependencyDepth}`);
    }

    return {
      isValid: errors.length === 0,
      valid: errors.length === 0,
      errors,
      warnings,
      metadata: {
        dependencyDepth: depth,
        wouldCreateCycle: this.wouldCreateCircularDependency(attributeId, dependency.attributeId),
        estimatedImpact: this.estimateDependencyImpact(attributeId, dependency)
      }
    };
  }

  /**
   * Get all attributes affected by changes to the given attribute
   */
  getAffectedAttributes(attributeId: string): string[] {
    const affected = new Set<string>();
    const queue = [attributeId];

    while (queue.length > 0) {
      const current = queue.shift()!;
      const dependents = this.getDependents(current);

      for (const dependent of dependents) {
        if (!affected.has(dependent)) {
          affected.add(dependent);
          queue.push(dependent);
        }
      }
    }

    return Array.from(affected);
  }

  /**
   * Get attributes that depend on the given attribute
   */
  getDependents(attributeId: string): string[] {
    return Array.from(this.reverseDependencyGraph.get(attributeId) || []);
  }

  /**
   * Check if there would be a circular dependency
   */
  private wouldCreateCircularDependency(from: string, to: string): boolean {
    const visited = new Set<string>();
    const queue = [to];

    while (queue.length > 0) {
      const current = queue.shift()!;
      if (current === from) {
        return true;
      }

      if (visited.has(current)) {
        continue;
      }
      visited.add(current);

      const dependencies = this.dependencyGraph.get(current) || new Set();
      queue.push(...Array.from(dependencies));
    }

    return false;
  }

  /**
   * Update dependency graphs
   */
  private updateDependencyGraphs(from: string, to: string): void {
    // Forward graph
    if (!this.dependencyGraph.has(from)) {
      this.dependencyGraph.set(from, new Set());
    }
    this.dependencyGraph.get(from)!.add(to);

    // Reverse graph
    if (!this.reverseDependencyGraph.has(to)) {
      this.reverseDependencyGraph.set(to, new Set());
    }
    this.reverseDependencyGraph.get(to)!.add(from);
  }

  /**
   * Calculate dependency depth for an attribute
   */
  private calculateDependencyDepth(attributeId: string, visited = new Set<string>()): number {
    if (visited.has(attributeId)) {
      return 0; // Circular dependency, return 0 to avoid infinite recursion
    }

    visited.add(attributeId);
    const dependencies = this.dependencyGraph.get(attributeId) || new Set();

    if (dependencies.size === 0) {
      return 0;
    }

    let maxDepth = 0;
    for (const dep of dependencies) {
      const depth = this.calculateDependencyDepth(dep, new Set(visited));
      maxDepth = Math.max(maxDepth, depth + 1);
    }

    return maxDepth;
  }

  /**
   * Estimate dependency impact
   */
  private estimateDependencyImpact(
    attributeId: string,
    dependency: AttributeDependencyDetailed
  ): number {
    // Simple heuristic: count affected attributes
    const affectedCount = this.getAffectedAttributes(dependency.attributeId).length;
    const priorityMultiplier = dependency.priority === 'high' ? 2 : dependency.priority === 'low' ? 0.5 : 1;

    return affectedCount * priorityMultiplier;
  }

  /**
   * Ensure tracker is initialized
   */
  private ensureInitialized(): void {
    if (!this.isInitialized) {
      throw ComputedAttributeErrorFactory.create(
        'DependencyTracker not initialized',
        ComputedAttributeErrorCodeDetailed.DEPENDENCY_TRACKER_NOT_INITIALIZED,
        'configuration'
      );
    }
  }
}
