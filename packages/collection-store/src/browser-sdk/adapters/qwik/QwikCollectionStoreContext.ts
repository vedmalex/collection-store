import { createContextId } from '@builder.io/qwik';
import type { CollectionStoreContextType } from './types';

/**
 * Context ID for the Collection Store Qwik SDK.
 * This ID is used to retrieve the SDK context within Qwik components.
 */
export const CollectionStoreContext = createContextId<CollectionStoreContextType>(
  'collection-store.context'
);