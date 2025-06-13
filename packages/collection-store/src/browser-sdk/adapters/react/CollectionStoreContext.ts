import React from 'react';
import { CollectionStoreContextType } from './types';

/**
 * React Context for the Collection Store SDK.
 * This context provides access to the core managers and engines of the SDK.
 */
export const CollectionStoreContext = React.createContext<CollectionStoreContextType | undefined>(undefined);