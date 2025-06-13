import { describe, it, expect, beforeEach } from 'bun:test';
import { ConfigurationManager } from '../ConfigurationManager';
import { QuotaManager } from '../nodes/QuotaManager';
import type { CollectionStoreConfig } from '../schemas/CollectionStoreConfig';

describe('QuotaManager', () => {

  beforeEach(() => {
    (ConfigurationManager as any).currentConfig = null;
  });

  const mockConfigWithQuotas: CollectionStoreConfig = {
    core: { name: 'test', version: '1.0', environment: 'development' },
    adapters: {},
    features: {
      replication: { enabled: false },
      realtime: { enabled: false },
      offline: { enabled: false },
      analytics: { enabled: false },
      quotas: {
        maxStorage: '2GB',
        maxRequestsPerMinute: 1000,
      },
    },
  };

  const mockConfigWithoutQuotas: CollectionStoreConfig = {
    ...mockConfigWithQuotas,
    features: { ...mockConfigWithQuotas.features, quotas: undefined },
  };

  describe('getQuotas', () => {
    it('should return the quota config if it exists', () => {
      (ConfigurationManager as any).currentConfig = mockConfigWithQuotas;
      const quotas = QuotaManager.getQuotas();
      expect(quotas).toBeDefined();
      expect(quotas?.maxStorage).toBe('2GB');
    });

    it('should return null if no quota config exists', () => {
      (ConfigurationManager as any).currentConfig = mockConfigWithoutQuotas;
      const quotas = QuotaManager.getQuotas();
      expect(quotas).toBeNull();
    });
  });

  describe('isStorageExceeded', () => {
    beforeEach(() => {
      (ConfigurationManager as any).currentConfig = mockConfigWithQuotas;
    });

    it('should return false if usage is below the quota', () => {
      const oneGB = 1024 * 1024 * 1024;
      expect(QuotaManager.isStorageExceeded(oneGB)).toBe(false);
    });

    it('should return true if usage is above the quota', () => {
      const threeGB = 3 * 1024 * 1024 * 1024;
      expect(QuotaManager.isStorageExceeded(threeGB)).toBe(true);
    });

    it('should return false if no storage quota is set', () => {
      (ConfigurationManager as any).currentConfig = mockConfigWithoutQuotas;
      const oneHundredGB = 100 * 1024 * 1024 * 1024;
      expect(QuotaManager.isStorageExceeded(oneHundredGB)).toBe(false);
    });

    it('should correctly parse different byte units', () => {
      const configWithMB: CollectionStoreConfig = {
        ...mockConfigWithQuotas,
        features: { ...mockConfigWithQuotas.features, quotas: { maxStorage: '500MB' } },
      };
      (ConfigurationManager as any).currentConfig = configWithMB;

      const usage_400MB = 400 * 1024 * 1024;
      const usage_600MB = 600 * 1024 * 1024;

      expect(QuotaManager.isStorageExceeded(usage_400MB)).toBe(false);
      expect(QuotaManager.isStorageExceeded(usage_600MB)).toBe(true);
    });

    it('should throw an error for invalid byte strings', () => {
        const configWithInvalidQuota: CollectionStoreConfig = {
            ...mockConfigWithQuotas,
            features: { ...mockConfigWithQuotas.features, quotas: { maxStorage: '10ZB' } }, // ZB is not a valid unit
        };
        (ConfigurationManager as any).currentConfig = configWithInvalidQuota;

        expect(() => {
            QuotaManager.isStorageExceeded(1024);
        }).toThrow("Invalid byte string format: 10ZB");
    });
  });
});