import { Role, Permission, AuthContext } from '../interfaces/types';
export interface RoleHierarchy {
    roleId: string;
    parentRoles: string[];
    childRoles: string[];
    level: number;
    effectivePermissions: Permission[];
}
export interface PermissionSet {
    roleId: string;
    permissions: Permission[];
    inherited: Permission[];
    effective: Permission[];
}
export interface RoleAssignment {
    userId: string;
    roleId: string;
    assignedBy: string;
    assignedAt: Date;
    expiresAt?: Date;
    isActive: boolean;
    context?: Record<string, any>;
}
export interface RoleOperationResult {
    success: boolean;
    roleId?: string;
    message: string;
    affectedUsers?: string[];
    changes?: RoleChange[];
}
export interface RoleChange {
    type: 'permission_added' | 'permission_removed' | 'parent_added' | 'parent_removed';
    target: string;
    oldValue?: any;
    newValue?: any;
    timestamp: Date;
}
export interface PermissionCheck {
    userId: string;
    resource: string;
    action: string;
    context?: AuthContext;
    result: boolean;
    reason: string;
    appliedRoles: string[];
    appliedPermissions: Permission[];
    evaluationTime: number;
}
export interface SystemRole extends Role {
    isSystemRole: true;
    cannotBeDeleted: boolean;
    cannotBeModified: boolean;
    autoAssign?: boolean;
}
export declare const SYSTEM_ROLES: {
    readonly SUPER_ADMIN: "system:super_admin";
    readonly ADMIN: "system:admin";
    readonly USER: "system:user";
    readonly GUEST: "system:guest";
    readonly SERVICE: "system:service";
};
export type SystemRoleId = typeof SYSTEM_ROLES[keyof typeof SYSTEM_ROLES];
export interface PermissionTemplate {
    id: string;
    name: string;
    description: string;
    permissions: Permission[];
    category: 'database' | 'collection' | 'document' | 'system' | 'custom';
    isBuiltIn: boolean;
}
export declare const PERMISSION_ACTIONS: {
    readonly CREATE_DATABASE: "create_database";
    readonly DROP_DATABASE: "drop_database";
    readonly LIST_DATABASES: "list_databases";
    readonly CREATE_COLLECTION: "create_collection";
    readonly DROP_COLLECTION: "drop_collection";
    readonly LIST_COLLECTIONS: "list_collections";
    readonly MODIFY_SCHEMA: "modify_schema";
    readonly READ: "read";
    readonly WRITE: "write";
    readonly DELETE: "delete";
    readonly BULK_WRITE: "bulk_write";
    readonly MANAGE_USERS: "manage_users";
    readonly MANAGE_ROLES: "manage_roles";
    readonly VIEW_AUDIT_LOGS: "view_audit_logs";
    readonly SYSTEM_CONFIG: "system_config";
};
export type PermissionAction = typeof PERMISSION_ACTIONS[keyof typeof PERMISSION_ACTIONS];
export interface RoleValidationResult {
    valid: boolean;
    errors: RoleValidationError[];
    warnings: RoleValidationWarning[];
}
export interface RoleValidationError {
    field: string;
    message: string;
    code: string;
}
export interface RoleValidationWarning {
    field: string;
    message: string;
    code: string;
}
export interface BulkRoleOperation {
    type: 'assign' | 'unassign' | 'update_permissions';
    userIds: string[];
    roleIds: string[];
    permissions?: Permission[];
    context?: AuthContext;
}
export interface BulkRoleResult {
    totalProcessed: number;
    successful: Array<{
        userId: string;
        roleId: string;
    }>;
    failed: Array<{
        userId: string;
        roleId: string;
        error: string;
    }>;
    summary: {
        successCount: number;
        failureCount: number;
        skippedCount: number;
    };
}
export interface RoleStats {
    totalRoles: number;
    systemRoles: number;
    customRoles: number;
    activeRoles: number;
    rolesWithUsers: number;
    averagePermissionsPerRole: number;
    rolesByCategory: Record<string, number>;
    mostUsedRoles: Array<{
        roleId: string;
        userCount: number;
    }>;
    leastUsedRoles: Array<{
        roleId: string;
        userCount: number;
    }>;
}
export interface PermissionStats {
    totalPermissions: number;
    uniqueResources: number;
    uniqueActions: number;
    permissionsByAction: Record<string, number>;
    permissionsByResource: Record<string, number>;
    mostGrantedPermissions: Array<{
        permission: Permission;
        grantCount: number;
    }>;
}
