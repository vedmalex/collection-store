/**
 * Browser Configuration Module
 * Exports browser-specific configuration components
 */

// Main Manager
export { BrowserFallbackManager } from './BrowserFallbackManager';

// Interfaces
export {
  IBrowserFallbackManager,
  FallbackStrategy,
  StorageType,
  QuotaStatus,
  StorageQuotaInfo,
  FallbackRule,
  FallbackExecution,
  FallbackStep,
  FallbackResult,
  BrowserFallbackStats,
  QuotaMonitoringConfig,
  BrowserFallbackEvent,
  BrowserFallbackManagerConfig
} from './interfaces/IBrowserFallbackManager';

// Type Guards and Utilities
import { FallbackStrategy, StorageType, QuotaStatus } from './interfaces/IBrowserFallbackManager';

export const isFallbackStrategy = (value: any): value is FallbackStrategy => {
  return Object.values(FallbackStrategy).includes(value);
};

export const isStorageType = (value: any): value is StorageType => {
  return Object.values(StorageType).includes(value);
};

export const isQuotaStatus = (value: any): value is QuotaStatus => {
  return Object.values(QuotaStatus).includes(value);
};