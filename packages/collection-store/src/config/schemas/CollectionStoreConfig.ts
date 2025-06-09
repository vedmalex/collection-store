import { z } from 'zod';
import { AdapterConfigSchema } from './AdapterConfig';
import {
  ReplicationConfigSchema,
  RealtimeConfigSchema,
  OfflineConfigSchema,
  AnalyticsConfigSchema,
  QuotaConfigSchema,
} from './FeatureConfig';
import { EnvironmentConfigSchema } from './EnvironmentConfig';

const CoreConfigSchema = z.object({
  name: z.string(),
  version: z.string(),
  environment: z.enum(['development', 'staging', 'production']),
  nodeId: z.string().optional(),
  clusterId: z.string().optional(),
  // Hot reload settings
  hotReload: z.object({
    enabled: z.boolean().default(false),
    watchPaths: z.array(z.string()).default([]),
    debounceMs: z.number().default(100),
  }).optional(),
});

const AdapterEntrySchema = AdapterConfigSchema.extend({
  enabled: z.boolean(),
  priority: z.number(),
  role: z.enum(['primary', 'backup', 'readonly']),
  // This allows for any adapter-specific properties.
  // We need to define a base type for adapter configs and merge it here.
  // For now, this is a good start. In the future, we might use a discriminated union for `type`.
  type: z.string(),
  config: z.any().optional(),
});

const AdaptersConfigSchema = z.record(AdapterEntrySchema);

const FeaturesConfigSchema = z.object({
  replication: ReplicationConfigSchema,
  realtime: RealtimeConfigSchema,
  offline: OfflineConfigSchema,
  analytics: AnalyticsConfigSchema,
  quotas: QuotaConfigSchema.optional(),
});

// Enhanced configuration schema with environment support
export const CollectionStoreConfigSchema = z.object({
  core: CoreConfigSchema,
  adapters: AdaptersConfigSchema,
  features: FeaturesConfigSchema,
  // Environment-specific configurations
  environment: EnvironmentConfigSchema.optional(),
  // IndexManager integration settings
  indexManager: z.object({
    enabled: z.boolean().default(true),
    btreeOptions: z.object({
      degree: z.number().default(3),
      unique: z.boolean().default(false),
    }).optional(),
    performance: z.object({
      cacheSize: z.number().default(1000),
      enableProfiling: z.boolean().default(false),
      slowQueryThreshold: z.number().default(100), // ms
    }).optional(),
    transactions: z.object({
      enabled: z.boolean().default(true),
      timeout: z.number().default(5000), // ms
      maxConcurrent: z.number().default(100),
    }).optional(),
  }).default({}),
});

export type CollectionStoreConfig = z.infer<typeof CollectionStoreConfigSchema>;
