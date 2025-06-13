// User Manager Implementation for Collection Store Auth System
// Handles user CRUD operations, password management, and security

import { CSDatabase } from '../../CSDatabase'
import { IDataCollection } from '../../IDataCollection'
import {
  IUserManager,
  User,
  CreateUserData,
  UpdateUserData,
  AuthContext,
  UserSearchCriteria,
  UserListOptions,
  UserListResult,
  UserSearchOptions,
  ValidationResult,
  PasswordValidationResult,
  BulkOperationResult,
  UserStats,
  UserActivity,
  PasswordConfig
} from '../interfaces'
import {
  hashPassword,
  verifyPassword,
  needsRehash,
  generateId
} from '../utils/crypto'
import {
  validateCreateUserData,
  validateUpdateUserData,
  validatePassword,
  validateEmail,
  sanitizeString
} from '../utils/validation'
import {
  createUserNotFoundError,
  createEmailExistsError,
  createWeakPasswordError,
  createValidationError,
  createDatabaseError,
  withErrorHandling
} from '../utils/errors'

export class UserManager implements IUserManager {
  private database: CSDatabase
  private config: PasswordConfig
  private usersCollection?: IDataCollection<User>
  private userActivityCollection?: IDataCollection<UserActivityRecord>
  private initialized = false

  constructor(database: CSDatabase, config: PasswordConfig) {
    this.database = database
    this.config = config
  }

  private async ensureInitialized() {
    if (!this.initialized) {
      await this.initializeCollections()
      this.initialized = true
    }
  }

  private async initializeCollections() {
    try {
      this.usersCollection = this.database.collection<User>('auth_users')
    } catch (error) {
      this.usersCollection = await this.database.createCollection<User>('auth_users')
    }

    try {
      this.userActivityCollection = this.database.collection<UserActivityRecord>('auth_user_activity')
    } catch (error) {
      this.userActivityCollection = await this.database.createCollection<UserActivityRecord>('auth_user_activity')
    }
  }

  // ============================================================================
  // User CRUD Operations
  // ============================================================================

  async createUser(userData: CreateUserData, context?: AuthContext): Promise<User> {
    return withErrorHandling(async () => {
      await this.ensureInitialized()

      // Validate user data
      const validation = validateCreateUserData(userData)
      if (!validation.valid) {
        throw createValidationError(
          'User data validation failed',
          { errors: validation.errors }
        )
      }

      // Validate password strength
      const passwordValidation = validatePassword(userData.password, this.config)
      if (!passwordValidation.valid) {
        throw createWeakPasswordError(passwordValidation.suggestions)
      }

      // Check if email already exists
      const existingUser = await this.usersCollection!.findFirst({ email: userData.email } as any)
      if (existingUser) {
        throw createEmailExistsError(userData.email)
      }

      // Hash password
      const passwordHash = await hashPassword(userData.password, this.config.saltRounds)

      // Create user object
      const now = new Date()
      const user: User = {
        id: generateId(),
        email: sanitizeString(userData.email).toLowerCase(),
        passwordHash,
        roles: userData.roles || [],
        attributes: userData.attributes || {},
        firstName: userData.firstName ? sanitizeString(userData.firstName) : undefined,
        lastName: userData.lastName ? sanitizeString(userData.lastName) : undefined,
        department: userData.department ? sanitizeString(userData.department) : undefined,
        createdAt: now,
        updatedAt: now,
        isActive: true,
        lastLogin: undefined,
        failedLoginAttempts: 0,
        lockedUntil: undefined,
        passwordChangedAt: now
      }

      // Store user
      await this.usersCollection!.create(user)

      // Log activity
      await this.logUserActivity(user.id, 'user_created', context)

      return user
    })()
  }

  async getUserById(userId: string): Promise<User | undefined> {
    return withErrorHandling(async () => {
      await this.ensureInitialized()
      return await this.usersCollection!.findFirst({ id: userId } as any) || undefined
    })()
  }

  async getUserByEmail(email: string): Promise<User | undefined> {
    return withErrorHandling(async () => {
      await this.ensureInitialized()
      const normalizedEmail = sanitizeString(email).toLowerCase()
      return await this.usersCollection!.findFirst({ email: normalizedEmail } as any) || undefined
    })()
  }

  async updateUser(userId: string, updates: UpdateUserData, context?: AuthContext): Promise<User> {
    return withErrorHandling(async () => {
      await this.ensureInitialized()

      // Get existing user
      const user = await this.getUserById(userId)
      if (!user) {
        throw createUserNotFoundError(userId)
      }

      // Validate update data
      const validation = validateUpdateUserData(updates)
      if (!validation.valid) {
        throw createValidationError(
          'User update data validation failed',
          { errors: validation.errors }
        )
      }

      // Check email uniqueness if email is being updated
      if (updates.email && updates.email !== user.email) {
        const emailAvailable = await this.isEmailAvailable(updates.email, userId)
        if (!emailAvailable) {
          throw createEmailExistsError(updates.email)
        }
      }

      // Prepare update object
      const updateData: Partial<User> = {
        ...updates,
        updatedAt: new Date()
      }

      // Sanitize string fields
      if (updates.email) {
        updateData.email = sanitizeString(updates.email).toLowerCase()
      }
      if (updates.firstName) {
        updateData.firstName = sanitizeString(updates.firstName)
      }
      if (updates.lastName) {
        updateData.lastName = sanitizeString(updates.lastName)
      }
      if (updates.department) {
        updateData.department = sanitizeString(updates.department)
      }

      // Update user
      await this.usersCollection!.updateWithId(userId, updateData)

      // Get updated user
      const updatedUser = await this.getUserById(userId)
      if (!updatedUser) {
        throw createDatabaseError('update user', new Error('User not found after update'))
      }

      // Log activity
      await this.logUserActivity(userId, 'user_updated', context)

      return updatedUser
    })()
  }

  async changePassword(
    userId: string,
    currentPassword: string,
    newPassword: string,
    context?: AuthContext
  ): Promise<void> {
    return withErrorHandling(async () => {
      await this.ensureInitialized()

      // Get user
      const user = await this.getUserById(userId)
      if (!user) {
        throw createUserNotFoundError(userId)
      }

      // Verify current password
      const isCurrentPasswordValid = await verifyPassword(currentPassword, user.passwordHash)
      if (!isCurrentPasswordValid) {
        throw createValidationError('Current password is incorrect')
      }

      // Validate new password
      const passwordValidation = validatePassword(newPassword, this.config)
      if (!passwordValidation.valid) {
        throw createWeakPasswordError(passwordValidation.suggestions)
      }

      // Hash new password
      const newPasswordHash = await hashPassword(newPassword, this.config.saltRounds)

      // Update password
      await this.usersCollection!.updateWithId(userId, {
        passwordHash: newPasswordHash,
        passwordChangedAt: new Date(),
        updatedAt: new Date(),
        failedLoginAttempts: 0, // Reset failed attempts
        lockedUntil: undefined // Unlock if locked
      })

      // Log activity
      await this.logUserActivity(userId, 'password_changed', context)
    })()
  }

  async resetPassword(
    userId: string,
    newPassword: string,
    requireChange: boolean,
    context?: AuthContext
  ): Promise<void> {
    return withErrorHandling(async () => {
      await this.ensureInitialized()

      // Get user
      const user = await this.getUserById(userId)
      if (!user) {
        throw createUserNotFoundError(userId)
      }

      // Validate new password
      const passwordValidation = validatePassword(newPassword, this.config)
      if (!passwordValidation.valid) {
        throw createWeakPasswordError(passwordValidation.suggestions)
      }

      // Hash new password
      const newPasswordHash = await hashPassword(newPassword, this.config.saltRounds)

      // Update password
      const updateData: Partial<User> = {
        passwordHash: newPasswordHash,
        passwordChangedAt: new Date(),
        updatedAt: new Date(),
        failedLoginAttempts: 0,
        lockedUntil: undefined
      }

      if (requireChange) {
        updateData.attributes = {
          ...user.attributes,
          requirePasswordChange: true
        }
      }

      await this.usersCollection!.updateWithId(userId, updateData)

      // Log activity
      await this.logUserActivity(userId, 'password_reset', context)
    })()
  }

  async deactivateUser(userId: string, context?: AuthContext): Promise<void> {
    return withErrorHandling(async () => {
      await this.ensureInitialized()

      const user = await this.getUserById(userId)
      if (!user) {
        throw createUserNotFoundError(userId)
      }

      await this.usersCollection!.updateWithId(userId, {
        isActive: false,
        updatedAt: new Date()
      })

      await this.logUserActivity(userId, 'user_deactivated', context)
    })()
  }

  async activateUser(userId: string, context?: AuthContext): Promise<void> {
    return withErrorHandling(async () => {
      await this.ensureInitialized()

      const user = await this.getUserById(userId)
      if (!user) {
        throw createUserNotFoundError(userId)
      }

      await this.usersCollection!.updateWithId(userId, {
        isActive: true,
        updatedAt: new Date(),
        failedLoginAttempts: 0,
        lockedUntil: undefined
      })

      await this.logUserActivity(userId, 'user_activated', context)
    })()
  }

  async deleteUser(userId: string, context?: AuthContext): Promise<void> {
    return withErrorHandling(async () => {
      await this.ensureInitialized()

      const user = await this.getUserById(userId)
      if (!user) {
        throw createUserNotFoundError(userId)
      }

      await this.usersCollection!.removeWithId(userId)
      await this.logUserActivity(userId, 'user_deleted', context)
    })()
  }

  // ============================================================================
  // User Search and Listing
  // ============================================================================

  async findUsers(criteria: UserSearchCriteria): Promise<User[]> {
    return withErrorHandling(async () => {
      await this.ensureInitialized()

      // Build query object
      const query: any = {}

      if (criteria.email) {
        query.email = criteria.email.toLowerCase()
      }
      if (criteria.department) {
        query.department = criteria.department
      }
      if (criteria.isActive !== undefined) {
        query.isActive = criteria.isActive
      }
      if (criteria.roles && criteria.roles.length > 0) {
        query.roles = { $in: criteria.roles }
      }
      if (criteria.createdAfter) {
        query.createdAt = { ...query.createdAt, $gte: criteria.createdAfter }
      }
      if (criteria.createdBefore) {
        query.createdAt = { ...query.createdAt, $lte: criteria.createdBefore }
      }
      if (criteria.lastLoginAfter) {
        query.lastLogin = { ...query.lastLogin, $gte: criteria.lastLoginAfter }
      }
      if (criteria.lastLoginBefore) {
        query.lastLogin = { ...query.lastLogin, $lte: criteria.lastLoginBefore }
      }

      return await this.usersCollection!.find(query)
    })()
  }

  async listUsers(options: UserListOptions): Promise<UserListResult> {
    return withErrorHandling(async () => {
      await this.ensureInitialized()

      const page = options.page || 1
      const limit = options.limit || 50
      const skip = (page - 1) * limit

      // Build query
      let query: any = {}
      if (options.filter) {
        const users = await this.findUsers(options.filter)
        const userIds = users.map(u => u.id)
        query = { id: { $in: userIds } }
      }

      // Get total count
      const allUsers = await this.usersCollection!.find(query)
      const total = allUsers.length

      // Apply pagination and sorting
      let users = allUsers
      if (options.sortBy) {
        users.sort((a, b) => {
          const aVal = a[options.sortBy!]
          const bVal = b[options.sortBy!]
          const order = options.sortOrder === 'desc' ? -1 : 1

          if (aVal < bVal) return -1 * order
          if (aVal > bVal) return 1 * order
          return 0
        })
      }

      users = users.slice(skip, skip + limit)

      return {
        users,
        total,
        page,
        limit,
        hasMore: skip + limit < total
      }
    })()
  }

  async searchUsers(query: string, options?: UserSearchOptions): Promise<User[]> {
    return withErrorHandling(async () => {
      await this.ensureInitialized()

      const searchTerm = sanitizeString(query).toLowerCase()
      const limit = options?.limit || 100

      // Get all users and filter in memory (for simplicity)
      const allUsers = await this.usersCollection!.find({})

      const matchingUsers = allUsers.filter(user => {
        // Skip inactive users unless explicitly included
        if (!options?.includeInactive && !user.isActive) {
          return false
        }

        // Filter by departments if specified
        if (options?.departments && options.departments.length > 0) {
          if (!user.department || !options.departments.includes(user.department)) {
            return false
          }
        }

        // Filter by roles if specified
        if (options?.roles && options.roles.length > 0) {
          const hasRole = options.roles.some(role => user.roles.includes(role))
          if (!hasRole) {
            return false
          }
        }

        // Text search in email, firstName, lastName, department
        const searchFields = [
          user.email,
          user.firstName,
          user.lastName,
          user.department
        ].filter(Boolean).map(field => field!.toLowerCase())

        return searchFields.some(field => field.includes(searchTerm))
      })

      return matchingUsers.slice(0, limit)
    })()
  }

  // ============================================================================
  // Role Management
  // ============================================================================

  async assignRole(userId: string, roleId: string, context?: AuthContext): Promise<void> {
    return withErrorHandling(async () => {
      await this.ensureInitialized()

      const user = await this.getUserById(userId)
      if (!user) {
        throw createUserNotFoundError(userId)
      }

      if (!user.roles.includes(roleId)) {
        const updatedRoles = [...user.roles, roleId]
        await this.usersCollection!.updateWithId(userId, {
          roles: updatedRoles,
          updatedAt: new Date()
        })

        await this.logUserActivity(userId, 'role_assigned', context, { roleId })
      }
    })()
  }

  async removeRole(userId: string, roleId: string, context?: AuthContext): Promise<void> {
    return withErrorHandling(async () => {
      await this.ensureInitialized()

      const user = await this.getUserById(userId)
      if (!user) {
        throw createUserNotFoundError(userId)
      }

            if (user.roles.includes(roleId)) {
        const updatedRoles = user.roles.filter(role => role !== roleId)

        // Update the user object and save it
        const updatedUser = {
          ...user,
          roles: updatedRoles,
          updatedAt: new Date()
        }

        await this.usersCollection!.save(updatedUser)

        await this.logUserActivity(userId, 'role_removed', context, { roleId })
      }
    })()
  }

  async getUserRoles(userId: string, includeInherited?: boolean): Promise<string[]> {
    return withErrorHandling(async () => {
      const user = await this.getUserById(userId)
      if (!user) {
        throw createUserNotFoundError(userId)
      }

      // For now, just return direct roles
      // In a full implementation, this would resolve role hierarchy
      return user.roles
    })()
  }

  async hasRole(userId: string, roleId: string, includeInherited?: boolean): Promise<boolean> {
    return withErrorHandling(async () => {
      await this.ensureInitialized()
      // Get fresh user data directly from database
      const user = await this.usersCollection!.findFirst({ id: userId } as any)
      if (!user) {
        return false
      }
      return user.roles.includes(roleId)
    })()
  }

  // ============================================================================
  // User Attributes
  // ============================================================================

  async setAttribute(
    userId: string,
    key: string,
    value: any,
    context?: AuthContext
  ): Promise<void> {
    return withErrorHandling(async () => {
      await this.ensureInitialized()

      const user = await this.getUserById(userId)
      if (!user) {
        throw createUserNotFoundError(userId)
      }

      const updatedAttributes = {
        ...user.attributes,
        [key]: value
      }

      await this.usersCollection!.updateWithId(userId, {
        attributes: updatedAttributes,
        updatedAt: new Date()
      })

      await this.logUserActivity(userId, 'attribute_set', context, { key, value })
    })()
  }

  async getAttribute(userId: string, key: string): Promise<any> {
    return withErrorHandling(async () => {
      await this.ensureInitialized()
      // Get fresh user data directly from database
      const user = await this.usersCollection!.findFirst({ id: userId } as any)
      if (!user) {
        throw createUserNotFoundError(userId)
      }

      return user.attributes[key]
    })()
  }

  async removeAttribute(userId: string, key: string, context?: AuthContext): Promise<void> {
    return withErrorHandling(async () => {
      await this.ensureInitialized()

      const user = await this.getUserById(userId)
      if (!user) {
        throw createUserNotFoundError(userId)
      }

      if (key in user.attributes) {
        const updatedAttributes = { ...user.attributes }
        delete updatedAttributes[key]

        // Update the user object and save it
        const updatedUser = {
          ...user,
          attributes: updatedAttributes,
          updatedAt: new Date()
        }

        await this.usersCollection!.save(updatedUser)

        await this.logUserActivity(userId, 'attribute_removed', context, { key })
      }
    })()
  }

  async getAttributes(userId: string): Promise<Record<string, any>> {
    return withErrorHandling(async () => {
      const user = await this.getUserById(userId)
      if (!user) {
        throw createUserNotFoundError(userId)
      }

      return user.attributes
    })()
  }

  // ============================================================================
  // Security Operations
  // ============================================================================

  async verifyPassword(userId: string, password: string): Promise<boolean> {
    return withErrorHandling(async () => {
      const user = await this.getUserById(userId)
      if (!user) {
        return false
      }

      const isValid = await verifyPassword(password, user.passwordHash)

      // Check if password hash needs rehashing
      if (isValid && needsRehash(user.passwordHash, this.config.saltRounds)) {
        const newHash = await hashPassword(password, this.config.saltRounds)
        await this.usersCollection!.updateWithId(userId, {
          passwordHash: newHash,
          updatedAt: new Date()
        })
      }

      return isValid
    })()
  }

  async lockUser(userId: string, reason: string, context?: AuthContext): Promise<void> {
    return withErrorHandling(async () => {
      await this.ensureInitialized()

      const user = await this.getUserById(userId)
      if (!user) {
        throw createUserNotFoundError(userId)
      }

      // Lock for 24 hours by default
      const lockUntil = new Date(Date.now() + 24 * 60 * 60 * 1000)

      await this.usersCollection!.updateWithId(userId, {
        lockedUntil: lockUntil,
        updatedAt: new Date(),
        attributes: {
          ...user.attributes,
          lockReason: reason
        }
      })

      await this.logUserActivity(userId, 'user_locked', context, { reason })
    })()
  }

  async unlockUser(userId: string, context?: AuthContext): Promise<void> {
    return withErrorHandling(async () => {
      await this.ensureInitialized()

      const user = await this.getUserById(userId)
      if (!user) {
        throw createUserNotFoundError(userId)
      }

      const updatedAttributes = { ...user.attributes }
      delete updatedAttributes.lockReason

      await this.usersCollection!.updateWithId(userId, {
        lockedUntil: null, // Use null instead of undefined
        failedLoginAttempts: 0,
        updatedAt: new Date(),
        attributes: updatedAttributes
      })

      await this.logUserActivity(userId, 'user_unlocked', context)
    })()
  }

  async isUserLocked(userId: string): Promise<boolean> {
    return withErrorHandling(async () => {
      const user = await this.getUserById(userId)
      if (!user) {
        return false
      }

      return user.lockedUntil ? user.lockedUntil > new Date() : false
    })()
  }

  async recordFailedLogin(userId: string, context?: AuthContext): Promise<void> {
    return withErrorHandling(async () => {
      await this.ensureInitialized()

      const user = await this.getUserById(userId)
      if (!user) {
        return
      }

      const failedAttempts = (user.failedLoginAttempts || 0) + 1
      const updateData: Partial<User> = {
        failedLoginAttempts: failedAttempts,
        updatedAt: new Date()
      }

      // Lock user if too many failed attempts
      if (failedAttempts >= 5) { // Configurable threshold
        updateData.lockedUntil = new Date(Date.now() + 30 * 60 * 1000) // 30 minutes
      }

      await this.usersCollection!.updateWithId(userId, updateData)
      await this.logUserActivity(userId, 'failed_login', context)
    })()
  }

  async resetFailedLogins(userId: string): Promise<void> {
    return withErrorHandling(async () => {
      await this.ensureInitialized()

      await this.usersCollection!.updateWithId(userId, {
        failedLoginAttempts: 0,
        updatedAt: new Date()
      })
    })()
  }

  async updateLastLogin(userId: string, context?: AuthContext): Promise<void> {
    return withErrorHandling(async () => {
      await this.ensureInitialized()

      await this.usersCollection!.updateWithId(userId, {
        lastLogin: new Date(),
        failedLoginAttempts: 0, // Reset on successful login
        updatedAt: new Date()
      })

      await this.logUserActivity(userId, 'login', context)
    })()
  }

  // ============================================================================
  // Validation
  // ============================================================================

  async validateUserData(userData: Partial<CreateUserData>): Promise<ValidationResult> {
    return withErrorHandling(async () => {
      if (userData.email) {
        const emailValidation = validateEmail(userData.email)
        if (!emailValidation.valid) {
          return {
            valid: false,
            errors: emailValidation.errors.map(error => ({
              field: 'email',
              message: error,
              code: 'INVALID_EMAIL'
            })),
            warnings: []
          }
        }
      }

      return {
        valid: true,
        errors: [],
        warnings: []
      }
    })()
  }

  async validatePassword(password: string): Promise<PasswordValidationResult> {
    return validatePassword(password, this.config)
  }

  async isEmailAvailable(email: string, excludeUserId?: string): Promise<boolean> {
    return withErrorHandling(async () => {
      const normalizedEmail = sanitizeString(email).toLowerCase()
      const existingUser = await this.getUserByEmail(normalizedEmail)

      if (!existingUser) {
        return true
      }

      return excludeUserId ? existingUser.id === excludeUserId : false
    })()
  }

  // ============================================================================
  // Bulk Operations
  // ============================================================================

  async createUsers(usersData: CreateUserData[], context?: AuthContext): Promise<BulkOperationResult<User>> {
    const result: BulkOperationResult<User> = {
      successful: [],
      failed: [],
      totalProcessed: usersData.length,
      successCount: 0,
      failureCount: 0
    }

    for (let i = 0; i < usersData.length; i++) {
      try {
        const user = await this.createUser(usersData[i], context)
        result.successful.push({ index: i, result: user })
        result.successCount++
      } catch (error: any) {
        result.failed.push({ index: i, error: error.message })
        result.failureCount++
      }
    }

    return result
  }

  async updateUsers(
    updates: Array<{ userId: string; data: UpdateUserData }>,
    context?: AuthContext
  ): Promise<BulkOperationResult<User>> {
    const result: BulkOperationResult<User> = {
      successful: [],
      failed: [],
      totalProcessed: updates.length,
      successCount: 0,
      failureCount: 0
    }

    for (let i = 0; i < updates.length; i++) {
      try {
        const user = await this.updateUser(updates[i].userId, updates[i].data, context)
        result.successful.push({ index: i, result: user })
        result.successCount++
      } catch (error: any) {
        result.failed.push({ index: i, error: error.message })
        result.failureCount++
      }
    }

    return result
  }

  async deactivateUsers(userIds: string[], context?: AuthContext): Promise<BulkOperationResult<void>> {
    const result: BulkOperationResult<void> = {
      successful: [],
      failed: [],
      totalProcessed: userIds.length,
      successCount: 0,
      failureCount: 0
    }

    for (let i = 0; i < userIds.length; i++) {
      try {
        await this.deactivateUser(userIds[i], context)
        result.successful.push({ index: i, result: undefined })
        result.successCount++
      } catch (error: any) {
        result.failed.push({ index: i, error: error.message })
        result.failureCount++
      }
    }

    return result
  }

  // ============================================================================
  // Statistics and Monitoring
  // ============================================================================

  async getUserStats(): Promise<UserStats> {
    return withErrorHandling(async () => {
      await this.ensureInitialized()

      const allUsers = await this.usersCollection!.find({})
      const now = new Date()
      const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)
      const twentyFourHoursAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000)

      const stats: UserStats = {
        totalUsers: allUsers.length,
        activeUsers: allUsers.filter(u => u.isActive).length,
        inactiveUsers: allUsers.filter(u => !u.isActive).length,
        lockedUsers: allUsers.filter(u => u.lockedUntil && u.lockedUntil > now).length,
        usersByDepartment: {},
        usersByRole: {},
        recentRegistrations: allUsers.filter(u => u.createdAt > thirtyDaysAgo).length,
        recentLogins: allUsers.filter(u => u.lastLogin && u.lastLogin > twentyFourHoursAgo).length
      }

      // Count by department
      allUsers.forEach(user => {
        const dept = user.department || 'Unknown'
        stats.usersByDepartment[dept] = (stats.usersByDepartment[dept] || 0) + 1
      })

      // Count by role
      allUsers.forEach(user => {
        user.roles.forEach(role => {
          stats.usersByRole[role] = (stats.usersByRole[role] || 0) + 1
        })
      })

      return stats
    })()
  }

  async getUserActivity(userId: string, days: number = 30): Promise<UserActivity> {
    return withErrorHandling(async () => {
      await this.ensureInitialized()

      const user = await this.getUserById(userId)
      if (!user) {
        throw createUserNotFoundError(userId)
      }

      const startDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000)

      // Get activity records
      const activities = await this.userActivityCollection!.find({
        userId,
        timestamp: { $gte: startDate }
      } as any)

      const loginActivities = activities.filter(a => a.action === 'login')

      return {
        userId,
        loginCount: loginActivities.length,
        lastLogin: user.lastLogin,
        actionsPerformed: activities.length,
        averageSessionDuration: 0, // Would need session tracking
        mostActiveHours: [], // Would need detailed analysis
        deviceTypes: {}, // Would need user agent parsing
        ipAddresses: [...new Set(activities.map(a => a.ipAddress).filter(Boolean))]
      }
    })()
  }

  // ============================================================================
  // Helper Methods
  // ============================================================================

  private async logUserActivity(
    userId: string,
    action: string,
    context?: AuthContext,
    metadata?: Record<string, any>
  ): Promise<void> {
    try {
      await this.ensureInitialized()

      const activity: UserActivityRecord = {
        id: generateId(),
        userId,
        action,
        timestamp: new Date(),
        ipAddress: context?.ip || 'unknown',
        userAgent: context?.userAgent || 'unknown',
        metadata: metadata || {}
      }

      await this.userActivityCollection!.create(activity)
    } catch (error) {
      // Don't fail the main operation if activity logging fails
      console.error('Failed to log user activity:', error)
    }
  }
}

// ============================================================================
// Supporting Types
// ============================================================================

interface UserActivityRecord {
  id: string
  userId: string
  action: string
  timestamp: Date
  ipAddress: string
  userAgent: string
  metadata: Record<string, any>
}