import { z } from 'zod';

// Placeholder schemas for various features.
// These will be detailed in later implementation phases.

export const ReplicationConfigSchema = z.object({
  enabled: z.boolean().default(false),
  strategy: z.string().optional(), // e.g., 'multi-source'
});
export type ReplicationConfig = z.infer<typeof ReplicationConfigSchema>;

export const RealtimeConfigSchema = z.object({
  enabled: z.boolean().default(false),
  websockets: z.boolean().optional(),
});
export type RealtimeConfig = z.infer<typeof RealtimeConfigSchema>;

export const OfflineConfigSchema = z.object({
  enabled: z.boolean().default(false),
});
export type OfflineConfig = z.infer<typeof OfflineConfigSchema>;

export const AnalyticsConfigSchema = z.object({
  enabled: z.boolean().default(false),
});
export type AnalyticsConfig = z.infer<typeof AnalyticsConfigSchema>;

export const QuotaConfigSchema = z.object({
  maxStorage: z.string().optional(), // e.g., '10GB'
  maxRequestsPerMinute: z.number().optional(),
});
export type QuotaConfig = z.infer<typeof QuotaConfigSchema>;
