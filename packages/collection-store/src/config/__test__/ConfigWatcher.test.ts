import { describe, it, expect, afterEach, spyOn } from 'bun:test';
import * as fs from 'fs';
import * as path from 'path';
import { ConfigWatcher } from '../watchers/ConfigWatcher';
import { ConfigurationManager } from '../ConfigurationManager';

describe('ConfigWatcher', () => {
  const testDir = path.join(import.meta.dir, 'temp');
  const tempConfigFile = path.join(testDir, 'test-config.yml');

  // Create a temporary directory for test files
  if (!fs.existsSync(testDir)) {
    fs.mkdirSync(testDir);
  }

  afterEach(() => {
    ConfigWatcher.unwatchAll();
    if (fs.existsSync(tempConfigFile)) {
      fs.unlinkSync(tempConfigFile);
    }
    // Reset ConfigurationManager state as well
    (ConfigurationManager as any).currentConfig = null;
  });

  const createTestConfig = (content: string) => {
    fs.writeFileSync(tempConfigFile, content, 'utf8');
  };

  it('should call the callback with the new config when the file changes', async () => {
    const initialContent = `
core:
  name: "initial"
  version: "1.0.0"
  environment: "development"
adapters: {}
features: { replication: { enabled: false }, realtime: { enabled: false }, offline: { enabled: false }, analytics: { enabled: false } }
`;
    createTestConfig(initialContent);

    let receivedConfig: any = null;
    const promise = new Promise<void>((resolve) => {
      ConfigWatcher.watch(tempConfigFile, (config) => {
        receivedConfig = config;
        resolve();
      });
    });

    // Give the watcher a moment to initialize
    await new Promise(res => setTimeout(res, 100));

    const updatedContent = initialContent.replace('initial', 'updated');
    createTestConfig(updatedContent);

    await promise;

    expect(receivedConfig).not.toBeNull();
    expect(receivedConfig.core.name).toBe('updated');
  });

  it('should stop watching a file with unwatch()', async () => {
    const content = `
core:
  name: "unwatch-test"
  version: "1.0.0"
  environment: "development"
adapters: {}
features: { replication: { enabled: false }, realtime: { enabled: false }, offline: { enabled: false }, analytics: { enabled: false } }
`;
    createTestConfig(content);

    let callCount = 0;
    ConfigWatcher.watch(tempConfigFile, () => {
      callCount++;
    });

    await new Promise(res => setTimeout(res, 100));

    ConfigWatcher.unwatch(tempConfigFile);

    // This change should not be detected
    createTestConfig(content.replace('unwatch-test', 'unwatched'));

    // Wait a bit to see if the callback is triggered
    await new Promise(res => setTimeout(res, 200));

    expect(callCount).toBe(0); // Should not have been called after unwatching
  });

  it('should handle errors gracefully if the updated file is invalid', async () => {
    const initialContent = `
core:
  name: "valid"
  version: "1.0.0"
  environment: "development"
adapters: {}
features: { replication: { enabled: false }, realtime: { enabled: false }, offline: { enabled: false }, analytics: { enabled: false } }
`;
    createTestConfig(initialContent);

    const promise = new Promise<void>((resolve) => {
        // Watch for changes, but we don't expect a successful callback
        ConfigWatcher.watch(tempConfigFile, () => {
            // This should not be called
            expect(true).toBe(false);
        });

        // Mock console.error to check if it's called
        const consoleErrorSpy = spyOn(console, 'error').mockImplementation(() => {});

        // Give watcher time to set up
        setTimeout(() => {
            const invalidContent = 'this: is: invalid: yaml';
            createTestConfig(invalidContent);

            // Give it time to process the change
            setTimeout(() => {
                expect(consoleErrorSpy).toHaveBeenCalled();
                consoleErrorSpy.mockRestore();
                resolve();
            }, 100);
        }, 100);
    });

    await promise;
  });
});