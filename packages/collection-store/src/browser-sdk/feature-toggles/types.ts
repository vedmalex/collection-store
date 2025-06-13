/**
 * Defines the structure for feature toggle configurations.
 * Each key represents a feature name, and its value indicates if it's enabled.
 */
export interface FeatureToggles extends Record<string, boolean> {}

/**
 * Defines the result of a feature detection operation.
 */
export interface FeatureDetectionResult {
  featureName: string;
  isSupported: boolean;
  details?: string; // Optional details about why it's not supported
}

/**
 * Defines a handler for when feature toggles change.
 */
export type FeatureToggleChangeHandler = (newToggles: FeatureToggles) => void;

/**
 * Represents a feature variant for A/B testing.
 */
export interface FeatureVariant {
  name: string; // Name of the variant (e.g., 'control', 'experiment-A')
  config: any; // Associated configuration for this variant
}

/**
 * Defines the outcome of an A/B test assignment.
 */
export interface ABTestAssignment {
  featureName: string;
  assignedVariant: string;
  isNewAssignment: boolean;
}