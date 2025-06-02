import { CreateUserData, UpdateUserData, PasswordConfig } from '../interfaces/types';
import { ValidationResult as IValidationResult, PasswordValidationResult } from '../interfaces/IUserManager';
interface SimpleValidationResult {
    valid: boolean;
    errors: string[];
}
export declare function validateEmail(email: string): SimpleValidationResult;
export declare function validatePassword(password: string, config: PasswordConfig): PasswordValidationResult;
export declare function validateCreateUserData(userData: CreateUserData): IValidationResult;
export declare function validateUpdateUserData(userData: UpdateUserData): IValidationResult;
export declare function validateString(value: any, fieldName: string, options?: {
    required?: boolean;
    minLength?: number;
    maxLength?: number;
    pattern?: RegExp;
}): SimpleValidationResult;
export declare function validateArray(value: any, fieldName: string, options?: {
    required?: boolean;
    minLength?: number;
    maxLength?: number;
    itemValidator?: (item: any) => SimpleValidationResult;
}): SimpleValidationResult;
export declare function sanitizeString(value: string): string;
export declare function validateAndSanitizeEmail(email: string): {
    valid: boolean;
    email: string;
    errors: string[];
};
export {};
