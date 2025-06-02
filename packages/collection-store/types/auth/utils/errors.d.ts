import { AuthError, AuthorizationError, TokenError, ValidationError } from '../interfaces/types';
export declare function createAuthError(message: string, code?: string, statusCode?: number, details?: Record<string, any>): AuthError;
export declare function createAuthorizationError(message: string, details?: Record<string, any>): AuthorizationError;
export declare function createTokenError(message: string, details?: Record<string, any>): TokenError;
export declare function createValidationError(message: string, details?: Record<string, any>): ValidationError;
export declare function createInvalidCredentialsError(): AuthError;
export declare function createAccountLockedError(unlockTime?: Date): AuthError;
export declare function createAccountDisabledError(): AuthError;
export declare function createPasswordExpiredError(): AuthError;
export declare function createInvalidTokenError(reason?: string): TokenError;
export declare function createExpiredTokenError(): TokenError;
export declare function createRevokedTokenError(): TokenError;
export declare function createInsufficientPermissionsError(resource: string, action: string): AuthorizationError;
export declare function createUserNotFoundError(identifier: string): AuthError;
export declare function createEmailExistsError(email: string): ValidationError;
export declare function createWeakPasswordError(suggestions: string[]): ValidationError;
export declare function createRateLimitError(retryAfter?: number): AuthError;
export declare function createSessionLimitError(maxSessions: number): AuthError;
export declare function createConfigurationError(message: string, details?: Record<string, any>): AuthError;
export declare function createDatabaseError(operation: string, originalError?: Error): AuthError;
export declare function isAuthError(error: any): error is AuthError;
export declare function isValidationError(error: any): error is ValidationError;
export declare function isTokenError(error: any): error is TokenError;
export declare function isAuthorizationError(error: any): error is AuthorizationError;
export declare function extractErrorDetails(error: any): ErrorDetails;
export declare function createSafeErrorResponse(error: any): SafeErrorResponse;
export declare function withErrorHandling<T extends any[], R>(fn: (...args: T) => Promise<R>, errorHandler?: (error: any) => AuthError): (...args: T) => Promise<R>;
export declare function withRetry<T>(fn: () => Promise<T>, options?: RetryOptions): Promise<T>;
export interface ErrorDetails {
    name: string;
    message: string;
    code?: string;
    statusCode?: number;
    details?: Record<string, any>;
    stack?: string;
}
export interface SafeErrorResponse {
    error: true;
    message: string;
    code: string;
    statusCode: number;
    details?: Record<string, any>;
    timestamp: string;
}
export interface RetryOptions {
    maxAttempts?: number;
    baseDelay?: number;
    maxDelay?: number;
    backoffFactor?: number;
    retryCondition?: (error: any) => boolean;
}
export declare const ERROR_CODES: {
    readonly INVALID_CREDENTIALS: "INVALID_CREDENTIALS";
    readonly ACCOUNT_LOCKED: "ACCOUNT_LOCKED";
    readonly ACCOUNT_DISABLED: "ACCOUNT_DISABLED";
    readonly PASSWORD_EXPIRED: "PASSWORD_EXPIRED";
    readonly INVALID_TOKEN: "INVALID_TOKEN";
    readonly EXPIRED_TOKEN: "EXPIRED_TOKEN";
    readonly REVOKED_TOKEN: "REVOKED_TOKEN";
    readonly INSUFFICIENT_PERMISSIONS: "INSUFFICIENT_PERMISSIONS";
    readonly ACCESS_DENIED: "ACCESS_DENIED";
    readonly VALIDATION_FAILED: "VALIDATION_FAILED";
    readonly WEAK_PASSWORD: "WEAK_PASSWORD";
    readonly EMAIL_EXISTS: "EMAIL_EXISTS";
    readonly RATE_LIMIT_EXCEEDED: "RATE_LIMIT_EXCEEDED";
    readonly SESSION_LIMIT_EXCEEDED: "SESSION_LIMIT_EXCEEDED";
    readonly CONFIGURATION_ERROR: "CONFIGURATION_ERROR";
    readonly DATABASE_ERROR: "DATABASE_ERROR";
    readonly INTERNAL_ERROR: "INTERNAL_ERROR";
};
export type ErrorCode = typeof ERROR_CODES[keyof typeof ERROR_CODES];
