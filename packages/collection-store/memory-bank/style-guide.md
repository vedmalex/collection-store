# STYLE GUIDE

## Code Style Standards

### Language Usage
- **Code & Comments**: English only
- **User Responses**: Russian
- **Documentation**: Russian for user-facing, English for technical

### TypeScript Style

#### Formatting
```typescript
// ✅ Correct: 2 spaces, no tabs
interface IStorageAdapter {
  create(data: any): Promise<string>;
  read(id: string): Promise<any>;
}

// ❌ Incorrect: tabs or 4 spaces
interface IStorageAdapter {
    create(data: any): Promise<string>;
    read(id: string): Promise<any>;
}
```

#### Naming Conventions
```typescript
// ✅ Interfaces: PascalCase with 'I' prefix
interface IConfigurationManager {
  loadConfig(): Promise<Config>;
}

// ✅ Classes: PascalCase
class ConfigurationManager implements IConfigurationManager {
  // ✅ Private fields: camelCase with underscore prefix
  private _config: Config;

  // ✅ Public methods: camelCase
  public async loadConfig(): Promise<Config> {
    return this._config;
  }
}

// ✅ Functions: camelCase
function validateConfiguration(config: Config): boolean {
  return true;
}

// ✅ Constants: UPPER_SNAKE_CASE
const DEFAULT_TIMEOUT = 5000;
const MAX_RETRY_ATTEMPTS = 3;

// ✅ Enums: PascalCase
enum StorageType {
  Memory = 'memory',
  File = 'file',
  Database = 'database'
}
```

#### Type Definitions
```typescript
// ✅ Explicit return types for public methods
public async create(data: CreateData): Promise<string> {
  // implementation
}

// ✅ Generic constraints
interface IRepository<T extends BaseEntity> {
  save(entity: T): Promise<void>;
}

// ✅ Union types with meaningful names
type StorageBackend = 'memory' | 'file' | 'database';

// ✅ Avoid 'any' - use specific types
interface ConfigData {
  host: string;
  port: number;
  options?: Record<string, unknown>;
}
```

### File Organization

#### File Naming
```
// ✅ Interfaces
IStorageAdapter.ts
IConfigurationManager.ts

// ✅ Classes
ConfigurationManager.ts
StorageAdapter.ts

// ✅ Utilities (kebab-case)
config-validator.ts
error-handler.ts

// ✅ Tests
ConfigurationManager.test.ts
storage-adapter.spec.ts
```

#### Directory Structure
```
src/
├── interfaces/     # All interface definitions
├── implementations/ # Concrete implementations
├── utils/          # Utility functions
├── types/          # Type definitions
└── __test__/       # Test files
```

### Comment Style

#### Documentation Comments
```typescript
/**
 * Manages configuration loading and validation for the Collection Store.
 *
 * This class handles YAML and JSON configuration files, validates them
 * against Zod schemas, and provides type-safe access to configuration data.
 *
 * @example
 * ```typescript
 * const manager = new ConfigurationManager();
 * const config = await manager.loadConfig('config.yml');
 * ```
 */
class ConfigurationManager {
  /**
   * Loads and validates configuration from a file.
   *
   * @param filePath - Path to the configuration file (YAML or JSON)
   * @returns Promise resolving to validated configuration object
   * @throws {ConfigurationError} When file is invalid or validation fails
   */
  public async loadConfig(filePath: string): Promise<Config> {
    // implementation
  }
}
```

#### Inline Comments
```typescript
// Check if file exists before attempting to read
if (!fs.existsSync(filePath)) {
  throw new ConfigurationError(`Configuration file not found: ${filePath}`);
}

// Parse YAML or JSON based on file extension
const content = filePath.endsWith('.yml') || filePath.endsWith('.yaml')
  ? yaml.load(fileContent) as unknown
  : JSON.parse(fileContent);

// Validate against schema and return typed result
return ConfigSchema.parse(content);
```

### Error Handling

#### Error Types
```typescript
// ✅ Custom error classes with descriptive names
class ConfigurationError extends Error {
  constructor(message: string, public readonly filePath?: string) {
    super(message);
    this.name = 'ConfigurationError';
  }
}

class ValidationError extends Error {
  constructor(message: string, public readonly errors: string[]) {
    super(message);
    this.name = 'ValidationError';
  }
}
```

#### Error Handling Patterns
```typescript
// ✅ Result pattern for operations that can fail
type Result<T, E = Error> =
  | { success: true; data: T }
  | { success: false; error: E };

// ✅ Explicit error handling
public async loadConfig(filePath: string): Promise<Result<Config, ConfigurationError>> {
  try {
    const config = await this.parseConfigFile(filePath);
    return { success: true, data: config };
  } catch (error) {
    return {
      success: false,
      error: new ConfigurationError(`Failed to load config: ${error.message}`, filePath)
    };
  }
}
```

### Testing Style

#### Test Structure
```typescript
import { describe, it, expect, beforeEach, afterEach } from 'bun:test';

describe('ConfigurationManager', () => {
  let manager: ConfigurationManager;

  beforeEach(() => {
    manager = new ConfigurationManager();
  });

  afterEach(() => {
    // Cleanup test files, reset state
  });

  describe('loadConfig', () => {
    it('should load valid YAML configuration', async () => {
      // Arrange
      const configPath = 'test-config.yml';

      // Act
      const result = await manager.loadConfig(configPath);

      // Assert
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.host).toBe('localhost');
      }
    });

    it('should return error for invalid configuration', async () => {
      // Arrange
      const invalidConfigPath = 'invalid-config.yml';

      // Act
      const result = await manager.loadConfig(invalidConfigPath);

      // Assert
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toBeInstanceOf(ConfigurationError);
      }
    });
  });
});
```

#### Test Naming
```typescript
// ✅ Descriptive test names
it('should load valid YAML configuration successfully')
it('should return error when configuration file does not exist')
it('should validate configuration against schema')
it('should handle malformed JSON gracefully')

// ❌ Vague test names
it('should work')
it('test config')
it('error case')
```

### Performance Guidelines

#### Async/Await Usage
```typescript
// ✅ Proper async/await usage
public async loadMultipleConfigs(paths: string[]): Promise<Config[]> {
  const configs = await Promise.all(
    paths.map(path => this.loadConfig(path))
  );
  return configs.filter(result => result.success).map(result => result.data);
}

// ✅ Error handling in async functions
public async saveConfig(config: Config, path: string): Promise<void> {
  try {
    const content = yaml.dump(config);
    await fs.promises.writeFile(path, content, 'utf8');
  } catch (error) {
    throw new ConfigurationError(`Failed to save config: ${error.message}`, path);
  }
}
```

#### Performance Measurements
```typescript
// ✅ Use performance.now() for timing
public async loadConfig(filePath: string): Promise<Config> {
  const startTime = performance.now();

  try {
    const config = await this.parseConfigFile(filePath);
    const endTime = performance.now();

    console.log(`Config loaded in ${endTime - startTime}ms`);
    return config;
  } catch (error) {
    const endTime = performance.now();
    console.log(`Config loading failed after ${endTime - startTime}ms`);
    throw error;
  }
}
```

### Import/Export Style

#### Import Organization
```typescript
// ✅ Import order: Node.js built-ins, external packages, internal modules
import fs from 'fs';
import path from 'path';

import yaml from 'js-yaml';
import { z } from 'zod';

import { IConfigurationManager } from '../interfaces/IConfigurationManager';
import { ConfigSchema } from '../schemas/ConfigSchema';
import { ConfigurationError } from '../errors/ConfigurationError';
```

#### Export Style
```typescript
// ✅ Named exports for utilities
export { validateConfiguration, parseConfigFile };

// ✅ Default export for main classes
export default class ConfigurationManager implements IConfigurationManager {
  // implementation
}

// ✅ Re-exports for public API
export { ConfigurationManager } from './ConfigurationManager';
export type { Config } from './types/Config';
```

### Documentation Standards

#### README Structure
```markdown
# Component Name

## Overview
Brief description of the component's purpose and functionality.

## Installation
```bash
bun add collection-store
```

## Usage
```typescript
import { ConfigurationManager } from 'collection-store';

const manager = new ConfigurationManager();
const config = await manager.loadConfig('config.yml');
```

## API Reference
Detailed API documentation with examples.

## Testing
Instructions for running tests and contributing.
```

#### Code Examples
- Always include working code examples
- Show both success and error cases
- Include TypeScript types in examples
- Provide realistic use cases