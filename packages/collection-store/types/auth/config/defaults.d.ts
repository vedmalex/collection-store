import { AuthConfig } from '../interfaces/types';
export declare function generateJWTKeys(algorithm: 'ES256' | 'RS256' | 'HS256'): {
    privateKey?: string;
    publicKey?: string;
    secret?: string;
};
export declare const DEFAULT_AUTH_CONFIG: AuthConfig;
export declare const DEVELOPMENT_AUTH_CONFIG: AuthConfig;
export declare const TEST_AUTH_CONFIG: AuthConfig;
export declare const HIGH_SECURITY_AUTH_CONFIG: AuthConfig;
export declare function getDefaultConfig(environment?: string): AuthConfig;
export declare function validateConfig(config: AuthConfig): ConfigValidationResult;
export declare function mergeConfig(userConfig: Partial<AuthConfig>, baseConfig?: AuthConfig): AuthConfig;
export interface ConfigValidationResult {
    valid: boolean;
    errors: string[];
    warnings: string[];
}
export declare function detectEnvironment(): string;
export declare function getAutoConfig(): AuthConfig;
