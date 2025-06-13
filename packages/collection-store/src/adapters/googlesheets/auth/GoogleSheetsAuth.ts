// Google Sheets Authentication Manager - OAuth2 and Service Account authentication
// Based on creative phase decisions: Flexible authentication with multiple strategies

import { EventEmitter } from 'events';

export interface OAuth2Config {
  clientId: string;
  clientSecret: string;
  redirectUri: string;
  scopes: string[];
  tokenPath?: string;
}

export interface ServiceAccountConfig {
  keyFilePath: string;
  scopes: string[];
  subject?: string; // For domain-wide delegation
}

export interface AuthConfig {
  strategy: 'oauth2' | 'service_account';
  oauth2?: OAuth2Config;
  serviceAccount?: ServiceAccountConfig;

  // Token management
  tokenRefresh: {
    enabled: boolean;
    refreshThresholdMs: number;
    maxRetries: number;
    retryDelayMs: number;
  };

  // Security
  security: {
    validateTokens: boolean;
    encryptStoredTokens: boolean;
    tokenExpiryBuffer: number;
  };
}

export interface AuthState {
  strategy: 'oauth2' | 'service_account';
  authenticated: boolean;
  tokenExpiry?: Date;
  lastRefresh?: Date;
  refreshCount: number;
  errorCount: number;
  scopes: string[];
}

export interface AuthMetrics {
  totalAuthentications: number;
  successfulAuthentications: number;
  failedAuthentications: number;
  tokenRefreshes: number;
  averageAuthTime: number;
  lastAuthTime: number;
  uptime: number;
  startTime: Date;
}

export class GoogleSheetsAuth extends EventEmitter {
  private auth?: any; // Simplified for now
  private state: AuthState;
  private metrics: AuthMetrics;
  private refreshTimeout?: NodeJS.Timeout;
  private isShuttingDown = false;

  constructor(private config: AuthConfig) {
    super();

    this.state = {
      strategy: config.strategy,
      authenticated: false,
      refreshCount: 0,
      errorCount: 0,
      scopes: config.strategy === 'oauth2'
        ? (config.oauth2?.scopes || [])
        : (config.serviceAccount?.scopes || [])
    };

    this.metrics = {
      totalAuthentications: 0,
      successfulAuthentications: 0,
      failedAuthentications: 0,
      tokenRefreshes: 0,
      averageAuthTime: 0,
      lastAuthTime: 0,
      uptime: 0,
      startTime: new Date()
    };
  }

  // Authentication management
  async authenticate(): Promise<void> {
    if (this.isShuttingDown) {
      throw new Error('Authentication manager is shutting down');
    }

    const startTime = Date.now();
    this.metrics.totalAuthentications++;

    this.emit('authentication-started', {
      strategy: this.state.strategy,
      attempt: this.metrics.totalAuthentications
    });

    try {
      switch (this.config.strategy) {
        case 'oauth2':
          await this.authenticateOAuth2();
          break;
        case 'service_account':
          await this.authenticateServiceAccount();
          break;
        default:
          throw new Error(`Unsupported authentication strategy: ${this.config.strategy}`);
      }

      const authTime = Date.now() - startTime;
      this.updateAuthMetrics(authTime, true);

      this.state.authenticated = true;
      this.state.lastRefresh = new Date();
      this.state.errorCount = 0;

      // Schedule token refresh if enabled
      if (this.config.tokenRefresh.enabled) {
        this.scheduleTokenRefresh();
      }

      this.emit('authentication-success', {
        strategy: this.state.strategy,
        authTime,
        tokenExpiry: this.state.tokenExpiry
      });

    } catch (error) {
      this.updateAuthMetrics(Date.now() - startTime, false);
      this.state.authenticated = false;
      this.state.errorCount++;

      this.emit('authentication-failed', {
        strategy: this.state.strategy,
        error: (error as Error).message,
        errorCount: this.state.errorCount
      });

      throw error;
    }
  }

  // Getters
  getAuth(): any {
    return this.auth;
  }

  getState(): AuthState {
    return { ...this.state };
  }

  getMetrics(): AuthMetrics {
    const now = Date.now();
    const uptimeMs = now - this.metrics.startTime.getTime();

    return {
      ...this.metrics,
      uptime: Math.floor(uptimeMs / 1000)
    };
  }

  isAuthenticated(): boolean {
    return this.state.authenticated && this.auth !== undefined;
  }

  isTokenValid(): boolean {
    if (!this.isAuthenticated()) {
      return false;
    }

    if (!this.state.tokenExpiry) {
      return true; // Service account tokens don't expire
    }

    const now = new Date();
    const bufferMs = this.config.security.tokenExpiryBuffer * 1000;
    const expiryWithBuffer = new Date(this.state.tokenExpiry.getTime() - bufferMs);

    return now < expiryWithBuffer;
  }

  // OAuth2 URL generation
  generateAuthUrl(): string {
    if (this.state.strategy !== 'oauth2' || !this.config.oauth2) {
      throw new Error('Auth URL generation only available for OAuth2 strategy');
    }

    // Simplified implementation
    const scopes = this.config.oauth2.scopes.join(' ');
    return `https://accounts.google.com/oauth/authorize?client_id=${this.config.oauth2.clientId}&redirect_uri=${this.config.oauth2.redirectUri}&scope=${scopes}&response_type=code&access_type=offline`;
  }

  async handleAuthCallback(code: string): Promise<void> {
    if (this.state.strategy !== 'oauth2' || !this.config.oauth2) {
      throw new Error('Auth callback handling only available for OAuth2 strategy');
    }

    try {
      // Simplified implementation - would exchange code for tokens
      this.auth = { accessToken: 'mock_token', refreshToken: 'mock_refresh' };
      this.state.authenticated = true;
      this.state.lastRefresh = new Date();
      this.state.tokenExpiry = new Date(Date.now() + 3600000); // 1 hour

      this.emit('auth-callback-success', {
        tokenExpiry: this.state.tokenExpiry
      });

    } catch (error) {
      this.emit('auth-callback-failed', {
        error: (error as Error).message
      });
      throw error;
    }
  }

  // Shutdown
  async shutdown(): Promise<void> {
    this.isShuttingDown = true;

    // Clear refresh timeout
    if (this.refreshTimeout) {
      clearTimeout(this.refreshTimeout);
      this.refreshTimeout = undefined;
    }

    this.emit('auth-shutdown');
  }

  // Private methods
  private async authenticateOAuth2(): Promise<void> {
    if (!this.config.oauth2) {
      throw new Error('OAuth2 configuration not provided');
    }

    // Simplified implementation
    this.auth = { accessToken: 'mock_oauth_token' };
    this.state.tokenExpiry = new Date(Date.now() + 3600000); // 1 hour
  }

  private async authenticateServiceAccount(): Promise<void> {
    if (!this.config.serviceAccount) {
      throw new Error('Service account configuration not provided');
    }

    // Simplified implementation
    this.auth = { serviceAccountToken: 'mock_sa_token' };
    // Service account tokens don't expire
  }

  private scheduleTokenRefresh(): void {
    // Clear existing timeout
    if (this.refreshTimeout) {
      clearTimeout(this.refreshTimeout);
    }

    if (!this.state.tokenExpiry || this.state.strategy !== 'oauth2') {
      return;
    }

    const now = new Date();
    const refreshTime = new Date(
      this.state.tokenExpiry.getTime() - this.config.tokenRefresh.refreshThresholdMs
    );

    const delayMs = Math.max(0, refreshTime.getTime() - now.getTime());

    this.refreshTimeout = setTimeout(async () => {
      this.refreshTimeout = undefined;

      try {
        this.emit('token-refresh-needed');
      } catch (error) {
        this.emit('scheduled-refresh-failed', {
          error: (error as Error).message
        });
      }
    }, delayMs);
  }

  private updateAuthMetrics(authTime: number, success: boolean): void {
    if (success) {
      this.metrics.successfulAuthentications++;
      this.metrics.lastAuthTime = authTime;

      // Update average auth time
      const totalTime = this.metrics.averageAuthTime * (this.metrics.successfulAuthentications - 1) + authTime;
      this.metrics.averageAuthTime = totalTime / this.metrics.successfulAuthentications;
    } else {
      this.metrics.failedAuthentications++;
    }
  }
}
