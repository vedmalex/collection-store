import { z } from 'zod';

// Adapter Configuration Schemas
// Based on creative phase decisions: Hierarchical schema inheritance with environment overrides

// Base adapter configuration schema
export const BaseAdapterConfigSchema = z.object({
  id: z.string().min(1, 'Adapter ID is required'),
  type: z.enum(['mongodb', 'googlesheets', 'markdown']),
  enabled: z.boolean().default(true),
  description: z.string().optional(),
  tags: z.array(z.string()).default([]),

  // Lifecycle configuration
  lifecycle: z.object({
    autoStart: z.boolean().default(true),
    startupTimeout: z.number().min(1000).default(30000), // 30 seconds
    shutdownTimeout: z.number().min(1000).default(10000), // 10 seconds
    healthCheckInterval: z.number().min(0).default(30000) // 30 seconds, 0 to disable
  }).default({}),

  // Capabilities
  capabilities: z.object({
    read: z.boolean().default(true),
    write: z.boolean().default(true),
    realtime: z.boolean().default(false),
    transactions: z.boolean().default(false),
    batch: z.boolean().default(false)
  }).default({})
});

// MongoDB adapter configuration
export const MongoDBAdapterConfigSchema = BaseAdapterConfigSchema.extend({
  type: z.literal('mongodb'),
  capabilities: z.object({
    read: z.boolean().default(true),
    write: z.boolean().default(true),
    realtime: z.boolean().default(true), // Change streams support
    transactions: z.boolean().default(true), // MongoDB transactions
    batch: z.boolean().default(true)
  }).default({}),

  config: z.object({
    // Connection settings
    connectionString: z.string().url('Invalid MongoDB connection string'),
    database: z.string().min(1, 'Database name is required'),

    // Connection pool settings
    maxPoolSize: z.number().min(1).default(10),
    minPoolSize: z.number().min(0).default(0),
    maxIdleTimeMS: z.number().min(0).default(30000),

    // Change streams settings
    changeStreams: z.object({
      enabled: z.boolean().default(true),
      fullDocument: z.enum(['default', 'updateLookup']).default('updateLookup'),
      resumeAfter: z.string().optional(),
      startAtOperationTime: z.date().optional(),
      batchSize: z.number().min(1).default(100)
    }).default({}),

    // Transaction settings
    transactions: z.object({
      readConcern: z.enum(['local', 'available', 'majority', 'linearizable', 'snapshot']).default('majority'),
      writeConcern: z.object({
        w: z.union([z.number(), z.string()]).default('majority'),
        j: z.boolean().default(true),
        wtimeout: z.number().min(0).default(10000)
      }).default({}),
      readPreference: z.enum(['primary', 'primaryPreferred', 'secondary', 'secondaryPreferred', 'nearest']).default('primary')
    }).default({}),

    // Collection mappings
    collections: z.record(z.string(), z.object({
      name: z.string(),
      schema: z.record(z.any()).optional(),
      indexes: z.array(z.object({
        fields: z.record(z.union([z.literal(1), z.literal(-1)])),
        options: z.record(z.any()).optional()
      })).default([])
    })).default({}),

    // Security settings
    ssl: z.object({
      enabled: z.boolean().default(false),
      ca: z.string().optional(),
      cert: z.string().optional(),
      key: z.string().optional(),
      allowInvalidCertificates: z.boolean().default(false)
    }).default({})
  })
});

// Google Sheets adapter configuration
export const GoogleSheetsAdapterConfigSchema = BaseAdapterConfigSchema.extend({
  type: z.literal('googlesheets'),
  capabilities: z.object({
    read: z.boolean().default(true),
    write: z.boolean().default(true),
    realtime: z.boolean().default(false), // Polling-based
    transactions: z.boolean().default(false), // No native transactions
    batch: z.boolean().default(true)
  }).default({}),

  config: z.object({
    // Authentication
    auth: z.object({
      type: z.enum(['service_account', 'oauth2']).default('service_account'),
      serviceAccountKey: z.string().optional(),
      clientId: z.string().optional(),
      clientSecret: z.string().optional(),
      refreshToken: z.string().optional(),
      scopes: z.array(z.string()).default(['https://www.googleapis.com/auth/spreadsheets'])
    }),

    // Rate limiting
    rateLimit: z.object({
      requestsPerMinute: z.number().min(1).default(100),
      requestsPerSecond: z.number().min(1).default(10),
      batchSize: z.number().min(1).default(100),
      retryAttempts: z.number().min(0).default(3),
      retryDelayMs: z.number().min(100).default(1000)
    }).default({}),

    // Spreadsheet mappings
    spreadsheets: z.record(z.string(), z.object({
      spreadsheetId: z.string().min(1, 'Spreadsheet ID is required'),
      sheets: z.record(z.string(), z.object({
        range: z.string().default('A:Z'),
        headerRow: z.number().min(1).default(1),
        dataStartRow: z.number().min(1).default(2),
        schema: z.record(z.object({
          column: z.string(),
          type: z.enum(['string', 'number', 'boolean', 'date']).default('string'),
          required: z.boolean().default(false),
          format: z.string().optional()
        })).optional()
      }))
    })).default({}),

    // Polling settings (for real-time simulation)
    polling: z.object({
      enabled: z.boolean().default(false),
      intervalMs: z.number().min(1000).default(30000), // 30 seconds
      changeDetection: z.enum(['revision', 'content_hash']).default('revision')
    }).default({})
  })
});

// Markdown adapter configuration
export const MarkdownAdapterConfigSchema = BaseAdapterConfigSchema.extend({
  type: z.literal('markdown'),
  capabilities: z.object({
    read: z.boolean().default(true),
    write: z.boolean().default(true),
    realtime: z.boolean().default(true), // File system watching
    transactions: z.boolean().default(false), // File-based, no transactions
    batch: z.boolean().default(true)
  }).default({}),

  config: z.object({
    // File system settings
    basePath: z.string().min(1, 'Base path is required'),
    filePattern: z.string().default('**/*.md'),
    encoding: z.string().default('utf8'),

    // File watching
    watching: z.object({
      enabled: z.boolean().default(true),
      debounceMs: z.number().min(100).default(500),
      ignoreInitial: z.boolean().default(true),
      followSymlinks: z.boolean().default(false),
      ignored: z.array(z.string()).default(['node_modules/**', '.git/**'])
    }).default({}),

    // Frontmatter parsing
    frontmatter: z.object({
      enabled: z.boolean().default(true),
      delimiter: z.string().default('---'),
      schema: z.record(z.object({
        type: z.enum(['string', 'number', 'boolean', 'date', 'array']).default('string'),
        required: z.boolean().default(false),
        default: z.any().optional()
      })).optional()
    }).default({}),

    // Content processing
    content: z.object({
      parseMarkdown: z.boolean().default(true),
      extractMetadata: z.boolean().default(true),
      generateSummary: z.boolean().default(false),
      summaryLength: z.number().min(50).default(200)
    }).default({}),

    // Git integration
    git: z.object({
      enabled: z.boolean().default(false),
      autoCommit: z.boolean().default(false),
      commitMessage: z.string().default('Auto-commit from Collection Store'),
      branch: z.string().default('main'),
      remote: z.string().optional(),
      author: z.object({
        name: z.string().default('Collection Store'),
        email: z.string().default('noreply@collection-store.dev')
      }).default({})
    }).default({}),

    // Collection mapping
    collections: z.record(z.string(), z.object({
      path: z.string(),
      fileNaming: z.enum(['slug', 'id', 'title', 'date']).default('slug'),
      subdirectories: z.boolean().default(false),
      template: z.string().optional()
    })).default({})
  })
});

// Environment-specific configuration overlays
export const DevelopmentAdapterOverrideSchema = z.object({
  lifecycle: z.object({
    healthCheckInterval: z.number().default(10000) // More frequent in dev
  }).partial().optional(),

  // MongoDB dev overrides
  mongodb: z.object({
    config: z.object({
      maxPoolSize: z.number().default(5), // Smaller pool in dev
      changeStreams: z.object({
        batchSize: z.number().default(10) // Smaller batches in dev
      }).partial()
    }).partial()
  }).partial().optional(),

  // Google Sheets dev overrides
  googlesheets: z.object({
    config: z.object({
      rateLimit: z.object({
        requestsPerMinute: z.number().default(30) // Lower rate limit in dev
      }).partial(),
      polling: z.object({
        intervalMs: z.number().default(10000) // More frequent polling in dev
      }).partial()
    }).partial()
  }).partial().optional(),

  // Markdown dev overrides
  markdown: z.object({
    config: z.object({
      watching: z.object({
        debounceMs: z.number().default(200) // Faster response in dev
      }).partial()
    }).partial()
  }).partial().optional()
}).partial();

export const ProductionAdapterOverrideSchema = z.object({
  lifecycle: z.object({
    healthCheckInterval: z.number().default(60000) // Less frequent in prod
  }).partial().optional(),

  // MongoDB prod overrides
  mongodb: z.object({
    config: z.object({
      maxPoolSize: z.number().default(20), // Larger pool in prod
      ssl: z.object({
        enabled: z.boolean().default(true) // SSL required in prod
      }).partial(),
      transactions: z.object({
        wtimeout: z.number().default(5000) // Shorter timeout in prod
      }).partial()
    }).partial()
  }).partial().optional(),

  // Google Sheets prod overrides
  googlesheets: z.object({
    config: z.object({
      rateLimit: z.object({
        requestsPerMinute: z.number().default(200) // Higher rate limit in prod
      }).partial(),
      polling: z.object({
        intervalMs: z.number().default(60000) // Less frequent polling in prod
      }).partial()
    }).partial()
  }).partial().optional(),

  // Markdown prod overrides
  markdown: z.object({
    config: z.object({
      watching: z.object({
        debounceMs: z.number().default(1000) // Slower response in prod for stability
      }).partial(),
      git: z.object({
        enabled: z.boolean().default(true), // Git integration in prod
        autoCommit: z.boolean().default(true)
      }).partial()
    }).partial()
  }).partial().optional()
}).partial();

// Unified adapter configuration type
export type BaseAdapterConfig = z.infer<typeof BaseAdapterConfigSchema>;
export type MongoDBAdapterConfig = z.infer<typeof MongoDBAdapterConfigSchema>;
export type GoogleSheetsAdapterConfig = z.infer<typeof GoogleSheetsAdapterConfigSchema>;
export type MarkdownAdapterConfig = z.infer<typeof MarkdownAdapterConfigSchema>;
export type DevelopmentAdapterOverride = z.infer<typeof DevelopmentAdapterOverrideSchema>;
export type ProductionAdapterOverride = z.infer<typeof ProductionAdapterOverrideSchema>;

export type AdapterConfig = MongoDBAdapterConfig | GoogleSheetsAdapterConfig | MarkdownAdapterConfig;

// Schema factory for environment-specific configurations
export class AdapterSchemaFactory {
  static createSchema(type: 'mongodb' | 'googlesheets' | 'markdown', environment: 'development' | 'staging' | 'production') {
    let baseSchema;

    switch (type) {
      case 'mongodb':
        baseSchema = MongoDBAdapterConfigSchema;
        break;
      case 'googlesheets':
        baseSchema = GoogleSheetsAdapterConfigSchema;
        break;
      case 'markdown':
        baseSchema = MarkdownAdapterConfigSchema;
        break;
      default:
        throw new Error(`Unknown adapter type: ${type}`);
    }

    // Apply environment-specific overrides
    if (environment === 'development') {
      return baseSchema; // Dev overrides applied at runtime
    } else if (environment === 'production') {
      return baseSchema; // Prod overrides applied at runtime
    }

    return baseSchema;
  }

  static validateConfig(config: any, environment: 'development' | 'staging' | 'production'): AdapterConfig {
    const schema = this.createSchema(config.type, environment);
    return schema.parse(config);
  }

  static applyEnvironmentOverrides(config: AdapterConfig, environment: 'development' | 'staging' | 'production'): AdapterConfig {
    if (environment === 'development') {
      const overrides = DevelopmentAdapterOverrideSchema.parse({});
      return this.mergeConfigs(config, overrides);
    } else if (environment === 'production') {
      const overrides = ProductionAdapterOverrideSchema.parse({});
      return this.mergeConfigs(config, overrides);
    }

    return config;
  }

  private static mergeConfigs(base: AdapterConfig, overrides: any): AdapterConfig {
    // Deep merge configuration with environment overrides
    const typeOverrides = overrides[base.type];
    if (!typeOverrides) {
      return base;
    }

    return {
      ...base,
      ...overrides,
      config: {
        ...base.config,
        ...typeOverrides.config
      }
    };
  }
}
