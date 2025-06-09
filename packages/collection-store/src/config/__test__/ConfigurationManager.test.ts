import { describe, it, expect, beforeEach } from 'bun:test';
import * as path from 'path';
import { ConfigurationManager } from '../ConfigurationManager';

describe('ConfigurationManager', () => {
  const validYamlPath = path.join(import.meta.dir, '../../../test-data/config/valid.yml');
  const validJsonPath = path.join(import.meta.dir, '../../../test-data/config/valid.json');
  const invalidStructurePath = path.join(import.meta.dir, '../../../test-data/config/invalid-structure.yml');
  const invalidSyntaxPath = path.join(import.meta.dir, '../../../test-data/config/invalid-syntax.yml');
  const nonExistentPath = path.join(import.meta.dir, '../../../test-data/config/non-existent.yml');

  // Reset the manager's state before each test
  beforeEach(() => {
    // This is a bit of a hack to reset the static class state.
    // In a real app, you might use dependency injection or a different pattern.
    (ConfigurationManager as any).currentConfig = null;
  });

  describe('loadFromFile', () => {
    it('should load and validate a correct YAML configuration file', () => {
      const config = ConfigurationManager.loadFromFile(validYamlPath);
      expect(config).toBeDefined();
      expect(config.core.name).toBe('test-store');
      expect(config.core.environment).toBe('development');
      expect(config.adapters.file.enabled).toBe(true);
    });

    it('should load and validate a correct JSON configuration file', () => {
      const config = ConfigurationManager.loadFromFile(validJsonPath);
      expect(config).toBeDefined();
      expect(config.core.name).toBe('test-store-json');
      expect(config.core.environment).toBe('production');
    });

    it('should throw an error if the file does not exist', () => {
      expect(() => {
        ConfigurationManager.loadFromFile(nonExistentPath);
      }).toThrow(/Configuration file not found/);
    });

    it('should throw an error for a file with invalid syntax', () => {
      expect(() => {
        ConfigurationManager.loadFromFile(invalidSyntaxPath);
      }).toThrow(/Failed to parse configuration file/);
    });

    it('should throw a validation error for a file with invalid structure', () => {
      expect(() => {
        ConfigurationManager.loadFromFile(invalidStructurePath);
      }).toThrow(/Configuration validation failed/);
    });

    it('should throw an error for unsupported file formats', () => {
      const unsupportedPath = path.join(import.meta.dir, '../../../test-data/config/valid.yml').replace('.yml', '.txt');
      require('fs').copyFileSync(validYamlPath, unsupportedPath);

      expect(() => {
        ConfigurationManager.loadFromFile(unsupportedPath);
      }).toThrow(/Unsupported configuration file format/);

      require('fs').unlinkSync(unsupportedPath);
    });
  });

  describe('getConfig', () => {
    it('should return the loaded configuration', () => {
      ConfigurationManager.loadFromFile(validYamlPath);
      const config = ConfigurationManager.getConfig();
      expect(config).toBeDefined();
      expect(config.core.name).toBe('test-store');
    });

    it('should throw an error if getConfig is called before loadFromFile', () => {
      expect(() => {
        ConfigurationManager.getConfig();
      }).toThrow(/Configuration has not been loaded/);
    });
  });
});