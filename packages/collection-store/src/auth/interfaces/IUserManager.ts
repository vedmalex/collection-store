// User Management Interface for Collection Store Auth System
// Integrates with CSDatabase and TypedCollection

import { User, CreateUserData, UpdateUserData, AuthContext } from './types'

export interface IUserManager {
  // ============================================================================
  // User CRUD Operations
  // ============================================================================

  /**
   * Create a new user with password hashing and validation
   */
  createUser(userData: CreateUserData, context?: AuthContext): Promise<User>

  /**
   * Get user by ID
   */
  getUserById(userId: string): Promise<User | undefined>

  /**
   * Get user by email
   */
  getUserByEmail(email: string): Promise<User | undefined>

  /**
   * Update user data (excluding password)
   */
  updateUser(userId: string, updates: UpdateUserData, context?: AuthContext): Promise<User>

  /**
   * Change user password with validation
   */
  changePassword(
    userId: string,
    currentPassword: string,
    newPassword: string,
    context?: AuthContext
  ): Promise<void>

  /**
   * Reset user password (admin operation)
   */
  resetPassword(
    userId: string,
    newPassword: string,
    requireChange: boolean,
    context?: AuthContext
  ): Promise<void>

  /**
   * Soft delete user (set isActive = false)
   */
  deactivateUser(userId: string, context?: AuthContext): Promise<void>

  /**
   * Reactivate user
   */
  activateUser(userId: string, context?: AuthContext): Promise<void>

  /**
   * Hard delete user (permanent removal)
   */
  deleteUser(userId: string, context?: AuthContext): Promise<void>

  // ============================================================================
  // User Search and Listing
  // ============================================================================

  /**
   * Find users by criteria
   */
  findUsers(criteria: UserSearchCriteria): Promise<User[]>

  /**
   * Get all users with pagination
   */
  listUsers(options: UserListOptions): Promise<UserListResult>

  /**
   * Search users by text (email, name, department)
   */
  searchUsers(query: string, options?: UserSearchOptions): Promise<User[]>

  // ============================================================================
  // Role Management
  // ============================================================================

  /**
   * Assign role to user
   */
  assignRole(userId: string, roleId: string, context?: AuthContext): Promise<void>

  /**
   * Remove role from user
   */
  removeRole(userId: string, roleId: string, context?: AuthContext): Promise<void>

  /**
   * Get user roles with hierarchy
   */
  getUserRoles(userId: string, includeInherited?: boolean): Promise<string[]>

  /**
   * Check if user has specific role
   */
  hasRole(userId: string, roleId: string, includeInherited?: boolean): Promise<boolean>

  // ============================================================================
  // User Attributes
  // ============================================================================

  /**
   * Set user attribute
   */
  setAttribute(
    userId: string,
    key: string,
    value: any,
    context?: AuthContext
  ): Promise<void>

  /**
   * Get user attribute
   */
  getAttribute(userId: string, key: string): Promise<any>

  /**
   * Remove user attribute
   */
  removeAttribute(userId: string, key: string, context?: AuthContext): Promise<void>

  /**
   * Get all user attributes
   */
  getAttributes(userId: string): Promise<Record<string, any>>

  // ============================================================================
  // Security Operations
  // ============================================================================

  /**
   * Verify user password
   */
  verifyPassword(userId: string, password: string): Promise<boolean>

  /**
   * Lock user account
   */
  lockUser(userId: string, reason: string, context?: AuthContext): Promise<void>

  /**
   * Unlock user account
   */
  unlockUser(userId: string, context?: AuthContext): Promise<void>

  /**
   * Check if user is locked
   */
  isUserLocked(userId: string): Promise<boolean>

  /**
   * Record failed login attempt
   */
  recordFailedLogin(userId: string, context?: AuthContext): Promise<void>

  /**
   * Reset failed login attempts
   */
  resetFailedLogins(userId: string): Promise<void>

  /**
   * Update last login time
   */
  updateLastLogin(userId: string, context?: AuthContext): Promise<void>

  // ============================================================================
  // Validation
  // ============================================================================

  /**
   * Validate user data
   */
  validateUserData(userData: Partial<CreateUserData>): Promise<ValidationResult>

  /**
   * Validate password strength
   */
  validatePassword(password: string): Promise<PasswordValidationResult>

  /**
   * Check if email is available
   */
  isEmailAvailable(email: string, excludeUserId?: string): Promise<boolean>

  // ============================================================================
  // Bulk Operations
  // ============================================================================

  /**
   * Create multiple users
   */
  createUsers(usersData: CreateUserData[], context?: AuthContext): Promise<BulkOperationResult<User>>

  /**
   * Update multiple users
   */
  updateUsers(
    updates: Array<{ userId: string; data: UpdateUserData }>,
    context?: AuthContext
  ): Promise<BulkOperationResult<User>>

  /**
   * Deactivate multiple users
   */
  deactivateUsers(userIds: string[], context?: AuthContext): Promise<BulkOperationResult<void>>

  // ============================================================================
  // Statistics and Monitoring
  // ============================================================================

  /**
   * Get user statistics
   */
  getUserStats(): Promise<UserStats>

  /**
   * Get user activity summary
   */
  getUserActivity(userId: string, days?: number): Promise<UserActivity>
}

// ============================================================================
// Supporting Types
// ============================================================================

export interface UserSearchCriteria {
  email?: string
  department?: string
  roles?: string[]
  isActive?: boolean
  attributes?: Record<string, any>
  createdAfter?: Date
  createdBefore?: Date
  lastLoginAfter?: Date
  lastLoginBefore?: Date
}

export interface UserListOptions {
  page?: number
  limit?: number
  sortBy?: keyof User
  sortOrder?: 'asc' | 'desc'
  filter?: UserSearchCriteria
}

export interface UserListResult {
  users: User[]
  total: number
  page: number
  limit: number
  hasMore: boolean
}

export interface UserSearchOptions {
  limit?: number
  includeInactive?: boolean
  departments?: string[]
  roles?: string[]
}

export interface ValidationResult {
  valid: boolean
  errors: ValidationError[]
  warnings: ValidationWarning[]
}

export interface ValidationError {
  field: string
  message: string
  code: string
}

export interface ValidationWarning {
  field: string
  message: string
  code: string
}

export interface PasswordValidationResult {
  valid: boolean
  score: number // 0-100
  errors: string[]
  suggestions: string[]
}

export interface BulkOperationResult<T> {
  successful: Array<{ index: number; result: T }>
  failed: Array<{ index: number; error: string }>
  totalProcessed: number
  successCount: number
  failureCount: number
}

export interface UserStats {
  totalUsers: number
  activeUsers: number
  inactiveUsers: number
  lockedUsers: number
  usersByDepartment: Record<string, number>
  usersByRole: Record<string, number>
  recentRegistrations: number // last 30 days
  recentLogins: number // last 24 hours
}

export interface UserActivity {
  userId: string
  loginCount: number
  lastLogin: Date | null
  actionsPerformed: number
  averageSessionDuration: number // minutes
  mostActiveHours: number[] // hours of day (0-23)
  deviceTypes: Record<string, number>
  ipAddresses: string[]
}