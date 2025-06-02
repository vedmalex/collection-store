import { User, CreateUserData, UpdateUserData, AuthContext } from './types';
export interface IUserManager {
    createUser(userData: CreateUserData, context?: AuthContext): Promise<User>;
    getUserById(userId: string): Promise<User | undefined>;
    getUserByEmail(email: string): Promise<User | undefined>;
    updateUser(userId: string, updates: UpdateUserData, context?: AuthContext): Promise<User>;
    changePassword(userId: string, currentPassword: string, newPassword: string, context?: AuthContext): Promise<void>;
    resetPassword(userId: string, newPassword: string, requireChange: boolean, context?: AuthContext): Promise<void>;
    deactivateUser(userId: string, context?: AuthContext): Promise<void>;
    activateUser(userId: string, context?: AuthContext): Promise<void>;
    deleteUser(userId: string, context?: AuthContext): Promise<void>;
    findUsers(criteria: UserSearchCriteria): Promise<User[]>;
    listUsers(options: UserListOptions): Promise<UserListResult>;
    searchUsers(query: string, options?: UserSearchOptions): Promise<User[]>;
    assignRole(userId: string, roleId: string, context?: AuthContext): Promise<void>;
    removeRole(userId: string, roleId: string, context?: AuthContext): Promise<void>;
    getUserRoles(userId: string, includeInherited?: boolean): Promise<string[]>;
    hasRole(userId: string, roleId: string, includeInherited?: boolean): Promise<boolean>;
    setAttribute(userId: string, key: string, value: any, context?: AuthContext): Promise<void>;
    getAttribute(userId: string, key: string): Promise<any>;
    removeAttribute(userId: string, key: string, context?: AuthContext): Promise<void>;
    getAttributes(userId: string): Promise<Record<string, any>>;
    verifyPassword(userId: string, password: string): Promise<boolean>;
    lockUser(userId: string, reason: string, context?: AuthContext): Promise<void>;
    unlockUser(userId: string, context?: AuthContext): Promise<void>;
    isUserLocked(userId: string): Promise<boolean>;
    recordFailedLogin(userId: string, context?: AuthContext): Promise<void>;
    resetFailedLogins(userId: string): Promise<void>;
    updateLastLogin(userId: string, context?: AuthContext): Promise<void>;
    validateUserData(userData: Partial<CreateUserData>): Promise<ValidationResult>;
    validatePassword(password: string): Promise<PasswordValidationResult>;
    isEmailAvailable(email: string, excludeUserId?: string): Promise<boolean>;
    createUsers(usersData: CreateUserData[], context?: AuthContext): Promise<BulkOperationResult<User>>;
    updateUsers(updates: Array<{
        userId: string;
        data: UpdateUserData;
    }>, context?: AuthContext): Promise<BulkOperationResult<User>>;
    deactivateUsers(userIds: string[], context?: AuthContext): Promise<BulkOperationResult<void>>;
    getUserStats(): Promise<UserStats>;
    getUserActivity(userId: string, days?: number): Promise<UserActivity>;
}
export interface UserSearchCriteria {
    email?: string;
    department?: string;
    roles?: string[];
    isActive?: boolean;
    attributes?: Record<string, any>;
    createdAfter?: Date;
    createdBefore?: Date;
    lastLoginAfter?: Date;
    lastLoginBefore?: Date;
}
export interface UserListOptions {
    page?: number;
    limit?: number;
    sortBy?: keyof User;
    sortOrder?: 'asc' | 'desc';
    filter?: UserSearchCriteria;
}
export interface UserListResult {
    users: User[];
    total: number;
    page: number;
    limit: number;
    hasMore: boolean;
}
export interface UserSearchOptions {
    limit?: number;
    includeInactive?: boolean;
    departments?: string[];
    roles?: string[];
}
export interface ValidationResult {
    valid: boolean;
    errors: ValidationError[];
    warnings: ValidationWarning[];
}
export interface ValidationError {
    field: string;
    message: string;
    code: string;
}
export interface ValidationWarning {
    field: string;
    message: string;
    code: string;
}
export interface PasswordValidationResult {
    valid: boolean;
    score: number;
    errors: string[];
    suggestions: string[];
}
export interface BulkOperationResult<T> {
    successful: Array<{
        index: number;
        result: T;
    }>;
    failed: Array<{
        index: number;
        error: string;
    }>;
    totalProcessed: number;
    successCount: number;
    failureCount: number;
}
export interface UserStats {
    totalUsers: number;
    activeUsers: number;
    inactiveUsers: number;
    lockedUsers: number;
    usersByDepartment: Record<string, number>;
    usersByRole: Record<string, number>;
    recentRegistrations: number;
    recentLogins: number;
}
export interface UserActivity {
    userId: string;
    loginCount: number;
    lastLogin: Date | null;
    actionsPerformed: number;
    averageSessionDuration: number;
    mostActiveHours: number[];
    deviceTypes: Record<string, number>;
    ipAddresses: string[];
}
