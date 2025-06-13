// src/browser-sdk/adapters/qwik/components/CollectionStoreProvider.tsx

import { component$, Slot, useVisibleTask$, useStore } from '@builder.io/qwik';
import { CollectionStoreContext } from '../QwikCollectionStoreContext';
import { BrowserStorageManager } from '../../../storage/BrowserStorageManager';
import { OfflineSyncEngine } from '../../../sync/OfflineSyncEngine';
import { ConfigLoader } from '../../../config/ConfigLoader';
import { FeatureToggleManager } from '../../../feature-toggles/FeatureToggleManager';
import { BrowserEventEmitter } from '../../../events/BrowserEventEmitter';
import { StorageRequirements } from '../../../storage/types';
import { BrowserCollectionManager } from '../../../collection/BrowserCollectionManager';

/**
 * Props for the CollectionStoreProvider component.
 */
interface CollectionStoreProviderProps {
  configUrl?: string;
  storageRequirements?: StorageRequirements;
}

/**
 * Provides the Collection Store SDK context to its children.
 * Initializes and manages the lifecycle of the SDK's core components.
 */
export const CollectionStoreProvider = component$<CollectionStoreProviderProps>((
  { configUrl = '/api/v6/config', storageRequirements }
) => {
  const state = useStore({ initialized: false, sdkContext: null as any });

  useVisibleTask$(async ({ cleanup }) => {
    try {
      // Initialize core SDK components
      const storageManager = new BrowserStorageManager();
      await storageManager.initialize(storageRequirements);

      const eventEmitter = new BrowserEventEmitter();
      const configLoader = new ConfigLoader(storageManager, configUrl);
      const featureToggleManager = new FeatureToggleManager(configLoader);
      const syncEngine = new OfflineSyncEngine(storageManager, eventEmitter);
      const browserCollectionManager = new BrowserCollectionManager(storageManager);

      await configLoader.initialize();
      // No explicit initialize needed for featureToggleManager, it listens to configLoader

      state.sdkContext = {
        storageManager,
        syncEngine,
        eventEmitter,
        configLoader,
        featureToggleManager,
        browserCollectionManager,
      };
      state.initialized = true;

      // TODO: Add cleanup logic if necessary for SDK components
      cleanup(() => {
        console.log('Collection Store SDK cleanup.');
        // Example cleanup for event listeners if any were registered globally
        // eventEmitter.removeAllListeners();
      });

    } catch (error) {
      console.error('Failed to initialize Collection Store SDK:', error);
      // Handle initialization error, e.g., show a fallback UI or error message
    }
  });

  if (!state.initialized) {
    return <div>Loading Collection Store SDK...</div>; // Or a more sophisticated loading indicator
  }

  return (
    <CollectionStoreContext.Provider value={state.sdkContext}>
      <Slot />
    </CollectionStoreContext.Provider>
  );
});
