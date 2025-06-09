import { z } from 'zod';

// Base schema for any adapter configuration.
// Adapters will extend this with their specific settings.
export const AdapterConfigSchema = z.object({
  // Configuration specific to the adapter type will be added here.
  // For example, for a 'file' adapter, this could include 'directory' and 'format'.
  // For a 'mongodb' adapter, it could include 'connectionString'.
});

export type AdapterConfig = z.infer<typeof AdapterConfigSchema>;
