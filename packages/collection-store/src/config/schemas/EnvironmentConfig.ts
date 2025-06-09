import { z } from 'zod';

// Environment-specific configuration schemas
export const DevelopmentConfigSchema = z.object({
  debug: z.boolean().default(true),
  logLevel: z.enum(['debug', 'info', 'warn', 'error']).default('debug'),
  hotReload: z.boolean().default(true),
  devTools: z.boolean().default(true),
  mockData: z.boolean().default(true),
  performance: z.object({
    enableProfiling: z.boolean().default(true),
    slowQueryThreshold: z.number().default(100), // ms
    memoryMonitoring: z.boolean().default(true),
  }).default({}),
  testing: z.object({
    enableTestData: z.boolean().default(true),
    resetOnRestart: z.boolean().default(true),
    seedData: z.boolean().default(true),
  }).default({}),
});

export const StagingConfigSchema = z.object({
  debug: z.boolean().default(false),
  logLevel: z.enum(['debug', 'info', 'warn', 'error']).default('info'),
  hotReload: z.boolean().default(false),
  devTools: z.boolean().default(false),
  mockData: z.boolean().default(false),
  performance: z.object({
    enableProfiling: z.boolean().default(true),
    slowQueryThreshold: z.number().default(50), // ms
    memoryMonitoring: z.boolean().default(true),
  }).default({}),
  monitoring: z.object({
    enableMetrics: z.boolean().default(true),
    enableTracing: z.boolean().default(true),
    sampleRate: z.number().min(0).max(1).default(0.1),
  }).default({}),
  security: z.object({
    enableAuditLog: z.boolean().default(true),
    strictValidation: z.boolean().default(true),
    rateLimiting: z.boolean().default(true),
  }).default({}),
});

export const ProductionConfigSchema = z.object({
  debug: z.boolean().default(false),
  logLevel: z.enum(['debug', 'info', 'warn', 'error']).default('warn'),
  hotReload: z.boolean().default(false),
  devTools: z.boolean().default(false),
  mockData: z.boolean().default(false),
  performance: z.object({
    enableProfiling: z.boolean().default(false),
    slowQueryThreshold: z.number().default(25), // ms
    memoryMonitoring: z.boolean().default(true),
    caching: z.object({
      enabled: z.boolean().default(true),
      ttl: z.number().default(300), // seconds
      maxSize: z.number().default(1000),
    }).default({}),
  }).default({}),
  monitoring: z.object({
    enableMetrics: z.boolean().default(true),
    enableTracing: z.boolean().default(true),
    sampleRate: z.number().min(0).max(1).default(0.01),
    alerting: z.object({
      enabled: z.boolean().default(true),
      errorThreshold: z.number().default(10),
      responseTimeThreshold: z.number().default(1000),
    }).default({}),
  }).default({}),
  security: z.object({
    enableAuditLog: z.boolean().default(true),
    strictValidation: z.boolean().default(true),
    rateLimiting: z.boolean().default(true),
    encryption: z.object({
      enabled: z.boolean().default(true),
      algorithm: z.string().default('aes-256-gcm'),
    }).default({}),
  }).default({}),
  backup: z.object({
    enabled: z.boolean().default(true),
    interval: z.number().default(3600), // seconds
    retention: z.number().default(30), // days
    compression: z.boolean().default(true),
  }).default({}),
});

// Union type for environment-specific configurations
export const EnvironmentSpecificConfigSchema = z.discriminatedUnion('environment', [
  z.object({
    environment: z.literal('development'),
    config: DevelopmentConfigSchema,
  }),
  z.object({
    environment: z.literal('staging'),
    config: StagingConfigSchema,
  }),
  z.object({
    environment: z.literal('production'),
    config: ProductionConfigSchema,
  }),
]);

// Environment configuration with overrides
export const EnvironmentConfigSchema = z.object({
  // Base environment settings
  environment: z.enum(['development', 'staging', 'production']),

  // Environment-specific configurations
  development: DevelopmentConfigSchema.optional(),
  staging: StagingConfigSchema.optional(),
  production: ProductionConfigSchema.optional(),

  // Global overrides that apply to all environments
  overrides: z.object({
    logLevel: z.enum(['debug', 'info', 'warn', 'error']).optional(),
    debug: z.boolean().optional(),
    hotReload: z.boolean().optional(),
    performance: z.object({
      slowQueryThreshold: z.number().optional(),
      memoryMonitoring: z.boolean().optional(),
    }).optional(),
  }).optional(),
});

// Type exports
export type DevelopmentConfig = z.infer<typeof DevelopmentConfigSchema>;
export type StagingConfig = z.infer<typeof StagingConfigSchema>;
export type ProductionConfig = z.infer<typeof ProductionConfigSchema>;
export type EnvironmentSpecificConfig = z.infer<typeof EnvironmentSpecificConfigSchema>;
export type EnvironmentConfig = z.infer<typeof EnvironmentConfigSchema>;

// Helper function to get environment-specific configuration
export function getEnvironmentDefaults(environment: 'development' | 'staging' | 'production') {
  switch (environment) {
    case 'development':
      return DevelopmentConfigSchema.parse({});
    case 'staging':
      return StagingConfigSchema.parse({});
    case 'production':
      return ProductionConfigSchema.parse({});
    default:
      throw new Error(`Unknown environment: ${environment}`);
  }
}

// Helper function to merge environment config with overrides
export function mergeEnvironmentConfig(
  environment: 'development' | 'staging' | 'production',
  envConfig?: EnvironmentConfig,
  overrides?: Record<string, any>
) {
  const defaults = getEnvironmentDefaults(environment);
  const environmentSpecific = envConfig?.[environment] || {};
  const globalOverrides = envConfig?.overrides || {};

  // Deep merge: defaults < environment-specific < global overrides < local overrides
  return {
    ...defaults,
    ...environmentSpecific,
    ...globalOverrides,
    ...overrides,
  };
}