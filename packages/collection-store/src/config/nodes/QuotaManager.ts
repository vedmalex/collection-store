import { ConfigurationManager } from '../ConfigurationManager';
import { QuotaConfig } from '../schemas/FeatureConfig';

// A simple utility to parse byte strings like '10GB', '500MB', '1TB'
const parseBytes = (byteString: string): number => {
  const multipliers: { [key: string]: number } = {
    kb: 1024,
    mb: 1024 ** 2,
    gb: 1024 ** 3,
    tb: 1024 ** 4,
  };

  const regex = /^(\d+)(kb|mb|gb|tb)$/i;
  const match = byteString.match(regex);

  if (!match) {
    throw new Error(`Invalid byte string format: ${byteString}`);
  }

  const value = parseInt(match[1], 10);
  const unit = match[2].toLowerCase();

  return value * multipliers[unit];
};

export class QuotaManager {
  /**
   * Retrieves the quota settings from the current configuration.
   *
   * @returns The quota configuration object, or null if not defined.
   */
  public static getQuotas(): QuotaConfig | null {
    const config = ConfigurationManager.getConfig();
    return config.features.quotas ?? null;
  }

  /**
   * Checks if the storage usage exceeds the configured quota.
   *
   * @param currentStorageBytes The current storage usage in bytes.
   * @returns True if the quota is exceeded, false otherwise.
   */
  public static isStorageExceeded(currentStorageBytes: number): boolean {
    const quotas = this.getQuotas();
    if (!quotas?.maxStorage) {
      return false; // No quota set
    }

    const maxStorageBytes = parseBytes(quotas.maxStorage);
    return currentStorageBytes > maxStorageBytes;
  }
}
