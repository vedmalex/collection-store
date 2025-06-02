import * as jwt from 'jsonwebtoken';
import { JWTConfig } from '../interfaces/types';
import { TokenClaims, TokenHeader } from '../interfaces/ITokenManager';
export declare function hashPassword(password: string, saltRounds?: number): Promise<string>;
export declare function verifyPassword(password: string, hash: string): Promise<boolean>;
export declare function needsRehash(hash: string, saltRounds: number): boolean;
export declare function generateRandomString(length?: number): string;
export declare function generateId(): string;
export declare function generateApiKey(prefix?: string): string;
export declare function generateES256KeyPair(): {
    privateKey: string;
    publicKey: string;
};
export declare function generateRS256KeyPair(): {
    privateKey: string;
    publicKey: string;
};
export declare function generateHS256Secret(): string;
export declare function generateKeyPair(algorithm: 'ES256' | 'RS256' | 'HS256'): {
    privateKey?: string;
    publicKey?: string;
    secret?: string;
};
export declare function signJWT(payload: object, config: JWTConfig, options?: jwt.SignOptions): string;
export declare function verifyJWT(token: string, config: JWTConfig, options?: jwt.VerifyOptions): TokenClaims;
export declare function decodeJWT(token: string): {
    header: TokenHeader;
    payload: TokenClaims;
    signature: string;
} | null;
export declare function getTokenExpiration(token: string): Date | null;
export declare function isTokenExpired(token: string): boolean;
export declare function sha256(data: string): string;
export declare function sha512(data: string): string;
export declare function hmac(data: string, key: string, algorithm?: string): string;
export declare function timingSafeEqual(a: string, b: string): boolean;
export declare function validateJWTKeys(config: JWTConfig): {
    valid: boolean;
    errors: string[];
};
