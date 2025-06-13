// RBAC-specific types for Collection Store Auth System
// Role-Based Access Control types and interfaces

import { User, Role, Permission, AuthContext } from '../interfaces/types'

// ============================================================================
// RBAC Core Types
// ============================================================================

export interface RoleHierarchy {
  roleId: string
  parentRoles: string[]
  childRoles: string[]
  level: number // depth in hierarchy
  effectivePermissions: Permission[]
}

export interface PermissionSet {
  roleId: string
  permissions: Permission[]
  inherited: Permission[]
  effective: Permission[]
}

export interface RoleAssignment {
  userId: string
  roleId: string
  assignedBy: string
  assignedAt: Date
  expiresAt?: Date
  isActive: boolean
  context?: Record<string, any>
}

// ============================================================================
// RBAC Operations
// ============================================================================

export interface RoleOperationResult {
  success: boolean
  roleId?: string
  message: string
  affectedUsers?: string[]
  changes?: RoleChange[]
}

export interface RoleChange {
  type: 'permission_added' | 'permission_removed' | 'parent_added' | 'parent_removed'
  target: string
  oldValue?: any
  newValue?: any
  timestamp: Date
}

export interface PermissionCheck {
  userId: string
  resource: string
  action: string
  context?: AuthContext
  result: boolean
  reason: string
  appliedRoles: string[]
  appliedPermissions: Permission[]
  evaluationTime: number
}

// ============================================================================
// System Roles
// ============================================================================

export interface SystemRole extends Role {
  isSystemRole: true
  cannotBeDeleted: boolean
  cannotBeModified: boolean
  autoAssign?: boolean // automatically assign to new users
}

export const SYSTEM_ROLES = {
  SUPER_ADMIN: 'system:super_admin',
  ADMIN: 'system:admin',
  USER: 'system:user',
  GUEST: 'system:guest',
  SERVICE: 'system:service'
} as const

export type SystemRoleId = typeof SYSTEM_ROLES[keyof typeof SYSTEM_ROLES]

// ============================================================================
// Permission Templates
// ============================================================================

export interface PermissionTemplate {
  id: string
  name: string
  description: string
  permissions: Permission[]
  category: 'database' | 'collection' | 'document' | 'system' | 'custom'
  isBuiltIn: boolean
}

export const PERMISSION_ACTIONS = {
  // Database level
  CREATE_DATABASE: 'create_database',
  DROP_DATABASE: 'drop_database',
  LIST_DATABASES: 'list_databases',

  // Collection level
  CREATE_COLLECTION: 'create_collection',
  DROP_COLLECTION: 'drop_collection',
  LIST_COLLECTIONS: 'list_collections',
  MODIFY_SCHEMA: 'modify_schema',

  // Document level
  READ: 'read',
  WRITE: 'write',
  DELETE: 'delete',
  BULK_WRITE: 'bulk_write',

  // System level
  MANAGE_USERS: 'manage_users',
  MANAGE_ROLES: 'manage_roles',
  VIEW_AUDIT_LOGS: 'view_audit_logs',
  SYSTEM_CONFIG: 'system_config'
} as const

export type PermissionAction = typeof PERMISSION_ACTIONS[keyof typeof PERMISSION_ACTIONS]

// ============================================================================
// Role Validation
// ============================================================================

export interface RoleValidationResult {
  valid: boolean
  errors: RoleValidationError[]
  warnings: RoleValidationWarning[]
}

export interface RoleValidationError {
  field: string
  message: string
  code: string
}

export interface RoleValidationWarning {
  field: string
  message: string
  code: string
}

// ============================================================================
// Bulk Operations
// ============================================================================

export interface BulkRoleOperation {
  type: 'assign' | 'unassign' | 'update_permissions'
  userIds: string[]
  roleIds: string[]
  permissions?: Permission[]
  context?: AuthContext
}

export interface BulkRoleResult {
  totalProcessed: number
  successful: Array<{ userId: string; roleId: string }>
  failed: Array<{ userId: string; roleId: string; error: string }>
  summary: {
    successCount: number
    failureCount: number
    skippedCount: number
  }
}

// ============================================================================
// Role Statistics
// ============================================================================

export interface RoleStats {
  totalRoles: number
  systemRoles: number
  customRoles: number
  activeRoles: number
  rolesWithUsers: number
  averagePermissionsPerRole: number
  rolesByCategory: Record<string, number>
  mostUsedRoles: Array<{ roleId: string; userCount: number }>
  leastUsedRoles: Array<{ roleId: string; userCount: number }>
}

export interface PermissionStats {
  totalPermissions: number
  uniqueResources: number
  uniqueActions: number
  permissionsByAction: Record<string, number>
  permissionsByResource: Record<string, number>
  mostGrantedPermissions: Array<{ permission: Permission; grantCount: number }>
}