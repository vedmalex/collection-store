// src/browser-sdk/feature-toggles/FeatureToggleManager.ts

import { FeatureToggles, FeatureToggleChangeHandler, FeatureDetectionResult, FeatureVariant, ABTestAssignment } from './types';
import { ConfigLoader } from '../config/ConfigLoader';
import { BrowserConfig } from '../config/types';

/**
 * Manages feature toggles and provides methods to check feature status,
 * register for changes, and integrate with A/B testing.
 */
export class FeatureToggleManager {
  private currentToggles: FeatureToggles = {};
  private configLoader: ConfigLoader;
  private changeHandlers: FeatureToggleChangeHandler[] = [];
  private abTestAssignments: Map<string, string> = new Map(); // featureName -> assignedVariant

  constructor(configLoader: ConfigLoader) {
    this.configLoader = configLoader;
    this.configLoader.onConfigChange(this.handleConfigChange.bind(this));
    // Initialize with current config if available
    const initialConfig = this.configLoader.getCurrentConfig();
    if (initialConfig?.featureToggles) {
      this.currentToggles = initialConfig.featureToggles;
    }
  }

  private handleConfigChange(newConfig: BrowserConfig): void {
    const newToggles = newConfig.featureToggles || {};
    // Only update and emit if toggles have actually changed
    if (JSON.stringify(this.currentToggles) !== JSON.stringify(newToggles)) {
      this.currentToggles = newToggles;
      this.emitFeatureToggleChange(this.currentToggles);
      console.log('Feature toggles updated:', this.currentToggles);
    }
  }

  /**
   * Checks if a specific feature is enabled.
   * @param featureName The name of the feature to check.
   * @returns True if the feature is enabled, false otherwise.
   */
  isFeatureEnabled(featureName: string): boolean {
    return !!this.currentToggles[featureName];
  }

  /**
   * Registers a handler for when feature toggles change.
   * @param handler The function to call when feature toggles change.
   */
  onFeatureToggleChange(handler: FeatureToggleChangeHandler): void {
    this.changeHandlers.push(handler);
  }

  /**
   * Unregisters a feature toggle change handler.
   * @param handler The handler to remove.
   */
  offFeatureToggleChange(handler: FeatureToggleChangeHandler): void {
    this.changeHandlers = this.changeHandlers.filter(h => h !== handler);
  }

  private emitFeatureToggleChange(newToggles: FeatureToggles): void {
    this.changeHandlers.forEach(handler => handler(newToggles));
  }

  /**
   * Detects if a specific browser feature is supported by the current environment.
   * This is a placeholder for actual browser API checks.
   * @param featureName The name of the browser feature (e.g., 'IndexedDB', 'ServiceWorker').
   * @returns A promise that resolves with the FeatureDetectionResult.
   */
  async detectBrowserFeature(featureName: string): Promise<FeatureDetectionResult> {
    let isSupported = false;
    let details = 'Not detected';

    switch (featureName) {
      case 'IndexedDB':
        isSupported = ('indexedDB' in window);
        details = isSupported ? 'IndexedDB API available.' : 'IndexedDB API not available.';
        break;
      case 'LocalStorage':
        isSupported = ('localStorage' in window);
        details = isSupported ? 'LocalStorage API available.' : 'LocalStorage API not available.';
        break;
      case 'ServiceWorker':
        isSupported = ('serviceWorker' in navigator);
        details = isSupported ? 'Service Worker API available.' : 'Service Worker API not available.';
        break;
      case 'WebSockets':
        isSupported = ('WebSocket' in window);
        details = isSupported ? 'WebSocket API available.' : 'WebSocket API not available.';
        break;
      // Add more browser feature detections as needed
      default:
        details = 'Unknown feature.';
        break;
    }

    return { featureName, isSupported, details };
  }

  /**
   * Assigns a user to an A/B test variant for a specific feature.
   * This is a simplified assignment logic; in real-world scenarios, it would involve
   * persistent storage, user IDs, and potentially a remote A/B testing service.
   * @param featureName The name of the feature under A/B testing.
   * @param variants An array of possible feature variants.
   * @returns A promise that resolves with the ABTestAssignment.
   */
  async assignABTestVariant(featureName: string, variants: FeatureVariant[]): Promise<ABTestAssignment> {
    if (variants.length === 0) {
      throw new Error('No variants provided for A/B test assignment.');
    }

    // Check if user is already assigned to a variant for this feature
    if (this.abTestAssignments.has(featureName)) {
      return { featureName, assignedVariant: this.abTestAssignments.get(featureName)!, isNewAssignment: false };
    }

    // Simple random assignment for demonstration purposes
    const assignedVariant = variants[Math.floor(Math.random() * variants.length)].name;
    this.abTestAssignments.set(featureName, assignedVariant);

    // In a real application, this assignment would be persisted (e.g., in localStorage or a cookie)
    // and reported to an A/B testing service.
    console.log(`Assigned user to A/B test variant for ${featureName}: ${assignedVariant}`);

    return { featureName, assignedVariant, isNewAssignment: true };
  }
}