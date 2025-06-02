// Role Manager Interface for Collection Store Auth System
// Comprehensive role and permission management

import {
  Role,
  Permission,
  CreateRoleData,
  UpdateRoleData,
  AuthContext,
  ValidationResult,
  ValidationError
} from './types'

import {
  RoleHierarchy,
  PermissionSet,
  RoleAssignment,
  RoleOperationResult,
  PermissionCheck,
  SystemRole,
  SystemRoleId,
  PermissionTemplate,
  PermissionAction,
  RoleValidationResult,
  BulkRoleOperation,
  BulkRoleResult,
  RoleStats,
  PermissionStats
} from '../rbac/types'

// ============================================================================
// Core Role Management Interface
// ============================================================================

export interface IRoleManager {
  // ============================================================================
  // Role CRUD Operations
  // ============================================================================

  /**
   * Create a new role
   */
  createRole(roleData: CreateRoleData, context: AuthContext): Promise<Role>

  /**
   * Get role by ID
   */
  getRoleById(roleId: string): Promise<Role | null>

  /**
   * Get role by name
   */
  getRoleByName(name: string): Promise<Role | null>

  /**
   * Update role
   */
  updateRole(roleId: string, updates: UpdateRoleData, context: AuthContext): Promise<Role>

  /**
   * Delete role (soft delete)
   */
  deleteRole(roleId: string, context: AuthContext): Promise<boolean>

  /**
   * List all roles with pagination
   */
  listRoles(options?: {
    page?: number
    limit?: number
    includeSystemRoles?: boolean
    includeInactive?: boolean
    search?: string
    sortBy?: 'name' | 'createdAt' | 'updatedAt'
    sortOrder?: 'asc' | 'desc'
  }): Promise<{
    roles: Role[]
    total: number
    page: number
    limit: number
    hasMore: boolean
  }>

  // ============================================================================
  // Permission Management
  // ============================================================================

  /**
   * Add permission to role
   */
  addPermissionToRole(roleId: string, permission: Permission, context: AuthContext): Promise<RoleOperationResult>

  /**
   * Remove permission from role
   */
  removePermissionFromRole(roleId: string, permission: Permission, context: AuthContext): Promise<RoleOperationResult>

  /**
   * Update role permissions (replace all)
   */
  updateRolePermissions(roleId: string, permissions: Permission[], context: AuthContext): Promise<RoleOperationResult>

  /**
   * Get effective permissions for role (including inherited)
   */
  getEffectivePermissions(roleId: string): Promise<PermissionSet>

  /**
   * Check if role has specific permission
   */
  hasPermission(roleId: string, resource: string, action: string): Promise<boolean>

  // ============================================================================
  // Role Hierarchy Management
  // ============================================================================

  /**
   * Add parent role (inheritance)
   */
  addParentRole(childRoleId: string, parentRoleId: string, context: AuthContext): Promise<RoleOperationResult>

  /**
   * Remove parent role
   */
  removeParentRole(childRoleId: string, parentRoleId: string, context: AuthContext): Promise<RoleOperationResult>

  /**
   * Get role hierarchy
   */
  getRoleHierarchy(roleId: string): Promise<RoleHierarchy>

  /**
   * Get all child roles (recursive)
   */
  getChildRoles(roleId: string, recursive?: boolean): Promise<Role[]>

  /**
   * Get all parent roles (recursive)
   */
  getParentRoles(roleId: string, recursive?: boolean): Promise<Role[]>

  /**
   * Check for circular dependencies in hierarchy
   */
  validateHierarchy(roleId: string, parentRoleId: string): Promise<ValidationResult>

  // ============================================================================
  // User-Role Assignment
  // ============================================================================

  /**
   * Assign role to user
   */
  assignRoleToUser(userId: string, roleId: string, context: AuthContext, options?: {
    expiresAt?: Date
    metadata?: Record<string, any>
  }): Promise<RoleOperationResult>

  /**
   * Unassign role from user
   */
  unassignRoleFromUser(userId: string, roleId: string, context: AuthContext): Promise<RoleOperationResult>

  /**
   * Get user roles
   */
  getUserRoles(userId: string, includeInherited?: boolean): Promise<Role[]>

  /**
   * Get users with role
   */
  getUsersWithRole(roleId: string, options?: {
    page?: number
    limit?: number
    includeInactive?: boolean
  }): Promise<{
    users: Array<{ userId: string; assignedAt: Date; expiresAt?: Date }>
    total: number
    page: number
    limit: number
  }>

  /**
   * Get role assignments for user
   */
  getUserRoleAssignments(userId: string): Promise<RoleAssignment[]>

  // ============================================================================
  // Permission Checking
  // ============================================================================

  /**
   * Check if user has permission
   */
  checkUserPermission(userId: string, resource: string, action: string, context?: AuthContext): Promise<PermissionCheck>

  /**
   * Check multiple permissions at once
   */
  checkUserPermissions(userId: string, checks: Array<{
    resource: string
    action: string
  }>, context?: AuthContext): Promise<PermissionCheck[]>

  /**
   * Get all user permissions (effective)
   */
  getUserPermissions(userId: string): Promise<Permission[]>

  // ============================================================================
  // System Roles Management
  // ============================================================================

  /**
   * Initialize system roles
   */
  initializeSystemRoles(): Promise<void>

  /**
   * Get system role
   */
  getSystemRole(roleId: SystemRoleId): Promise<SystemRole | null>

  /**
   * Update system role permissions (admin only)
   */
  updateSystemRolePermissions(roleId: SystemRoleId, permissions: Permission[], context: AuthContext): Promise<RoleOperationResult>

  /**
   * Check if role is system role
   */
  isSystemRole(roleId: string): boolean

  // ============================================================================
  // Permission Templates
  // ============================================================================

  /**
   * Create permission template
   */
  createPermissionTemplate(template: Omit<PermissionTemplate, 'id' | 'isBuiltIn'>): Promise<PermissionTemplate>

  /**
   * Apply permission template to role
   */
  applyPermissionTemplate(roleId: string, templateId: string, context: AuthContext): Promise<RoleOperationResult>

  /**
   * List permission templates
   */
  listPermissionTemplates(category?: string): Promise<PermissionTemplate[]>

  // ============================================================================
  // Bulk Operations
  // ============================================================================

  /**
   * Bulk role operations
   */
  bulkRoleOperation(operation: BulkRoleOperation, context: AuthContext): Promise<BulkRoleResult>

  /**
   * Bulk assign roles to users
   */
  bulkAssignRoles(userIds: string[], roleIds: string[], context: AuthContext): Promise<BulkRoleResult>

  /**
   * Bulk unassign roles from users
   */
  bulkUnassignRoles(userIds: string[], roleIds: string[], context: AuthContext): Promise<BulkRoleResult>

  // ============================================================================
  // Validation
  // ============================================================================

  /**
   * Validate role data
   */
  validateRoleData(roleData: CreateRoleData | UpdateRoleData): Promise<RoleValidationResult>

  /**
   * Validate permission
   */
  validatePermission(permission: Permission): Promise<ValidationResult>

  /**
   * Validate role name uniqueness
   */
  validateRoleName(name: string, excludeRoleId?: string): Promise<boolean>

  // ============================================================================
  // Statistics and Analytics
  // ============================================================================

  /**
   * Get role statistics
   */
  getRoleStats(): Promise<RoleStats>

  /**
   * Get permission statistics
   */
  getPermissionStats(): Promise<PermissionStats>

  /**
   * Get role usage analytics
   */
  getRoleUsageAnalytics(roleId: string, timeRange?: {
    from: Date
    to: Date
  }): Promise<{
    assignmentCount: number
    activeUsers: number
    permissionChecks: number
    topResources: Array<{ resource: string; accessCount: number }>
    topActions: Array<{ action: string; accessCount: number }>
  }>

  // ============================================================================
  // Import/Export
  // ============================================================================

  /**
   * Export roles configuration
   */
  exportRoles(options?: {
    includeSystemRoles?: boolean
    includePermissions?: boolean
    includeHierarchy?: boolean
    format?: 'json' | 'yaml'
  }): Promise<string>

  /**
   * Import roles configuration
   */
  importRoles(data: string, options?: {
    overwriteExisting?: boolean
    validateOnly?: boolean
    format?: 'json' | 'yaml'
  }, context?: AuthContext): Promise<{
    imported: number
    skipped: number
    errors: Array<{ role: string; error: string }>
  }>

  // ============================================================================
  // Cache Management
  // ============================================================================

  /**
   * Clear role cache
   */
  clearRoleCache(roleId?: string): Promise<void>

  /**
   * Clear permission cache
   */
  clearPermissionCache(userId?: string): Promise<void>

  /**
   * Refresh role hierarchy cache
   */
  refreshHierarchyCache(): Promise<void>
}