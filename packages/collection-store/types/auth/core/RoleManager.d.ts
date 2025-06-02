import { CSDatabase } from '../../';
import { Role, Permission, CreateRoleData, UpdateRoleData, AuthContext } from '../interfaces/types';
import { ValidationResult } from '../interfaces/IUserManager';
import { IRoleManager } from '../interfaces/IRoleManager';
import { RoleHierarchy, PermissionSet, RoleAssignment, RoleOperationResult, PermissionCheck, SystemRole, SystemRoleId, PermissionTemplate, RoleValidationResult, BulkRoleOperation, BulkRoleResult, RoleStats, PermissionStats } from '../rbac/types';
export declare class RoleManager implements IRoleManager {
    private database;
    private rolesCollection?;
    private roleAssignmentsCollection?;
    private roleHierarchyCache;
    private permissionCache;
    private initialized;
    constructor(database: CSDatabase);
    private ensureInitialized;
    private initializeCollections;
    createRole(roleData: CreateRoleData, context: AuthContext): Promise<Role>;
    getRoleById(roleId: string): Promise<Role | null>;
    getRoleByName(name: string): Promise<Role | null>;
    updateRole(roleId: string, updates: UpdateRoleData, context: AuthContext): Promise<Role>;
    deleteRole(roleId: string, context: AuthContext): Promise<boolean>;
    listRoles(options?: {
        page?: number;
        limit?: number;
        includeSystemRoles?: boolean;
        includeInactive?: boolean;
        search?: string;
        sortBy?: 'name' | 'createdAt' | 'updatedAt';
        sortOrder?: 'asc' | 'desc';
    }): Promise<{
        roles: Role[];
        total: number;
        page: number;
        limit: number;
        hasMore: boolean;
    }>;
    private paginateRoles;
    initializeSystemRoles(): Promise<void>;
    getSystemRole(roleId: SystemRoleId): Promise<SystemRole | null>;
    isSystemRole(roleId: string): boolean;
    validateRoleData(roleData: CreateRoleData | UpdateRoleData): Promise<RoleValidationResult>;
    validatePermission(permission: Permission): Promise<ValidationResult>;
    validateRoleName(name: string, excludeRoleId?: string): Promise<boolean>;
    clearRoleCache(roleId?: string): Promise<void>;
    clearPermissionCache(userId?: string): Promise<void>;
    refreshHierarchyCache(): Promise<void>;
    addPermissionToRole(roleId: string, permission: Permission, context: AuthContext): Promise<RoleOperationResult>;
    removePermissionFromRole(roleId: string, permission: Permission, context: AuthContext): Promise<RoleOperationResult>;
    updateRolePermissions(roleId: string, permissions: Permission[], context: AuthContext): Promise<RoleOperationResult>;
    getEffectivePermissions(roleId: string): Promise<PermissionSet>;
    hasPermission(roleId: string, resource: string, action: string): Promise<boolean>;
    addParentRole(childRoleId: string, parentRoleId: string, context: AuthContext): Promise<RoleOperationResult>;
    removeParentRole(childRoleId: string, parentRoleId: string, context: AuthContext): Promise<RoleOperationResult>;
    getRoleHierarchy(roleId: string): Promise<RoleHierarchy>;
    getChildRoles(roleId: string, recursive?: boolean): Promise<Role[]>;
    getParentRoles(roleId: string, recursive?: boolean): Promise<Role[]>;
    validateHierarchy(roleId: string, parentRoleId: string): Promise<ValidationResult>;
    assignRoleToUser(userId: string, roleId: string, context: AuthContext, options?: {
        expiresAt?: Date;
        metadata?: Record<string, any>;
    }): Promise<RoleOperationResult>;
    unassignRoleFromUser(userId: string, roleId: string, context: AuthContext): Promise<RoleOperationResult>;
    getUserRoles(userId: string, includeInherited?: boolean): Promise<Role[]>;
    getUsersWithRole(roleId: string, options?: {
        page?: number;
        limit?: number;
        includeInactive?: boolean;
    }): Promise<{
        users: Array<{
            userId: string;
            assignedAt: Date;
            expiresAt?: Date;
        }>;
        total: number;
        page: number;
        limit: number;
    }>;
    getUserRoleAssignments(userId: string): Promise<RoleAssignment[]>;
    checkUserPermission(userId: string, resource: string, action: string, context?: AuthContext): Promise<PermissionCheck>;
    checkUserPermissions(userId: string, checks: Array<{
        resource: string;
        action: string;
    }>, context?: AuthContext): Promise<PermissionCheck[]>;
    getUserPermissions(userId: string): Promise<Permission[]>;
    updateSystemRolePermissions(roleId: SystemRoleId, permissions: Permission[], context: AuthContext): Promise<RoleOperationResult>;
    createPermissionTemplate(template: Omit<PermissionTemplate, 'id' | 'isBuiltIn'>): Promise<PermissionTemplate>;
    applyPermissionTemplate(roleId: string, templateId: string, context: AuthContext): Promise<RoleOperationResult>;
    listPermissionTemplates(category?: string): Promise<PermissionTemplate[]>;
    bulkRoleOperation(operation: BulkRoleOperation, context: AuthContext): Promise<BulkRoleResult>;
    bulkAssignRoles(userIds: string[], roleIds: string[], context: AuthContext): Promise<BulkRoleResult>;
    bulkUnassignRoles(userIds: string[], roleIds: string[], context: AuthContext): Promise<BulkRoleResult>;
    getRoleStats(): Promise<RoleStats>;
    getPermissionStats(): Promise<PermissionStats>;
    getRoleUsageAnalytics(roleId: string, timeRange?: {
        from: Date;
        to: Date;
    }): Promise<{
        assignmentCount: number;
        activeUsers: number;
        permissionChecks: number;
        topResources: Array<{
            resource: string;
            accessCount: number;
        }>;
        topActions: Array<{
            action: string;
            accessCount: number;
        }>;
    }>;
    exportRoles(options?: {
        includeSystemRoles?: boolean;
        includePermissions?: boolean;
        includeHierarchy?: boolean;
        format?: 'json' | 'yaml';
    }): Promise<string>;
    importRoles(data: string, options?: {
        overwriteExisting?: boolean;
        validateOnly?: boolean;
        format?: 'json' | 'yaml';
    }, context?: AuthContext): Promise<{
        imported: number;
        skipped: number;
        errors: Array<{
            role: string;
            error: string;
        }>;
    }>;
}
