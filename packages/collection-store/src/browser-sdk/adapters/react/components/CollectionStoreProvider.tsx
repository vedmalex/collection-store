// src/browser-sdk/adapters/react/components/CollectionStoreProvider.tsx

import React, { ReactNode, useEffect, useState } from 'react';
import { CollectionStoreContext } from '../CollectionStoreContext';
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
  children: ReactNode;
  configUrl?: string;
  storageRequirements?: StorageRequirements;
}

/**
 * Provides the Collection Store SDK context to its children.
 * Initializes and manages the lifecycle of the SDK's core components.
 */
export const CollectionStoreProvider: React.FC<CollectionStoreProviderProps> = ({
  children,
  configUrl = '/api/v6/config',
  storageRequirements,
}) => {
  const [isInitialized, setIsInitialized] = useState(false);
  const [sdkContext, setSdkContext] = useState<any>(null);

  useEffect(() => {
    const initializeSdk = async () => {
      try {
        // Initialize core SDK components
        const storageManager = new BrowserStorageManager();
        await storageManager.initialize(storageRequirements);

        const eventEmitter = new BrowserEventEmitter();
        const configLoader = new ConfigLoader(storageManager, configUrl);
        const featureToggleManager = new FeatureToggleManager(configLoader);
        const syncEngine = new OfflineSyncEngine(storageManager, eventEmitter); // Pass eventEmitter
        const browserCollectionManager = new BrowserCollectionManager(storageManager);

        await configLoader.initialize();
        // No explicit initialize needed for featureToggleManager, it listens to configLoader
        // No explicit initialize needed for syncEngine, it initializes storage internally

        setSdkContext({
          storageManager,
          syncEngine,
          eventEmitter,
          configLoader,
          featureToggleManager,
          browserCollectionManager,
        });
        setIsInitialized(true);
      } catch (error) {
        console.error('Failed to initialize Collection Store SDK:', error);
        // Handle initialization error, e.g., show a fallback UI or error message
      }
    };

    initializeSdk();
  }, [configUrl, storageRequirements]);

  if (!isInitialized) {
    return <div>Loading Collection Store SDK...</div>; // Or a more sophisticated loading indicator
  }

  return (
    <CollectionStoreContext.Provider value={sdkContext}>
      {children}
    </CollectionStoreContext.Provider>
  );
};