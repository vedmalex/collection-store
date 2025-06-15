// UserManager Tests for Collection Store Auth System
// Basic functionality tests

import { describe, it, expect, beforeEach } from 'bun:test'
import { CSDatabase } from '../../core/Database'
import { UserManager } from '../core/UserManager'
import { TEST_AUTH_CONFIG } from '../config/defaults'
import { CreateUserData, UpdateUserData } from '../interfaces/types'

describe('UserManager', () => {
  let database: CSDatabase
  let userManager: UserManager
  let testUserData: CreateUserData

  beforeEach(async () => {
    // Create in-memory database for testing
    database = new CSDatabase(':memory:', 'test-auth')
    await database.connect()

    // Initialize UserManager with test config
    userManager = new UserManager(database, TEST_AUTH_CONFIG.password)

    // Create test user data
    testUserData = {
      email: 'test@example.com',
      password: 'TestPassword123!',
      roles: ['user', 'test'],
      firstName: 'Test',
      lastName: 'User',
      department: 'Engineering',
      attributes: { testAttribute: 'testValue' }
    }
  })

  describe('User Creation', () => {
    it('should create user successfully', async () => {
      const user = await userManager.createUser(testUserData)

      expect(user).toBeDefined()
      expect(user.id).toBeString()
      expect(user.email).toBe(testUserData.email)
      expect(user.roles).toEqual(testUserData.roles)
      expect(user.firstName).toBe(testUserData.firstName)
      expect(user.lastName).toBe(testUserData.lastName)
      expect(user.department).toBe(testUserData.department)
      expect(user.isActive).toBe(true)
      expect(user.passwordHash).toBeString()
      expect(user.passwordHash).not.toBe(testUserData.password)
    })

    it('should reject duplicate email', async () => {
      await userManager.createUser(testUserData)

      await expect(userManager.createUser(testUserData)).rejects.toThrow('Email address is already in use')
    })

    it('should reject weak password', async () => {
      const weakPasswordData = {
        ...testUserData,
        password: '123'
      }

      await expect(userManager.createUser(weakPasswordData)).rejects.toThrow()
    })

    it('should reject invalid email', async () => {
      const invalidEmailData = {
        ...testUserData,
        email: 'invalid-email'
      }

      await expect(userManager.createUser(invalidEmailData)).rejects.toThrow()
    })
  })

  describe('User Retrieval', () => {
    it('should get user by ID', async () => {
      const createdUser = await userManager.createUser(testUserData)
      const retrievedUser = await userManager.getUserById(createdUser.id)

      expect(retrievedUser).toBeDefined()
      expect(retrievedUser!.id).toBe(createdUser.id)
      expect(retrievedUser!.email).toBe(createdUser.email)
    })

    it('should get user by email', async () => {
      const createdUser = await userManager.createUser(testUserData)
      const retrievedUser = await userManager.getUserByEmail(testUserData.email)

      expect(retrievedUser).toBeDefined()
      expect(retrievedUser!.id).toBe(createdUser.id)
      expect(retrievedUser!.email).toBe(testUserData.email)
    })

    it('should return undefined for non-existent user', async () => {
      const user = await userManager.getUserById('non-existent-id')
      expect(user).toBeUndefined()
    })
  })

  describe('User Updates', () => {
    it('should update user data', async () => {
      const createdUser = await userManager.createUser(testUserData)

      const updateData: UpdateUserData = {
        firstName: 'Updated',
        lastName: 'Name',
        department: 'Marketing'
      }

      const updatedUser = await userManager.updateUser(createdUser.id, updateData)

      expect(updatedUser.firstName).toBe(updateData.firstName)
      expect(updatedUser.lastName).toBe(updateData.lastName)
      expect(updatedUser.department).toBe(updateData.department)
      expect(updatedUser.email).toBe(createdUser.email) // Should remain unchanged
    })

    it('should update user email', async () => {
      const createdUser = await userManager.createUser(testUserData)
      const newEmail = 'updated@example.com'

      const updatedUser = await userManager.updateUser(createdUser.id, { email: newEmail })

      expect(updatedUser.email).toBe(newEmail)
    })

    it('should reject duplicate email on update', async () => {
      const user1 = await userManager.createUser(testUserData)
      const user2Data = {
        ...testUserData,
        email: 'user2@example.com'
      }
      const user2 = await userManager.createUser(user2Data)

      await expect(
        userManager.updateUser(user2.id, { email: user1.email })
      ).rejects.toThrow('Email address is already in use')
    })
  })

  describe('Password Management', () => {
    it('should verify correct password', async () => {
      const user = await userManager.createUser(testUserData)
      const isValid = await userManager.verifyPassword(user.id, testUserData.password)

      expect(isValid).toBe(true)
    })

    it('should reject incorrect password', async () => {
      const user = await userManager.createUser(testUserData)
      const isValid = await userManager.verifyPassword(user.id, 'wrong-password')

      expect(isValid).toBe(false)
    })

    it('should change password', async () => {
      const user = await userManager.createUser(testUserData)
      const newPassword = 'NewPassword123!'

      await userManager.changePassword(user.id, testUserData.password, newPassword)

      // Old password should not work
      const oldPasswordValid = await userManager.verifyPassword(user.id, testUserData.password)
      expect(oldPasswordValid).toBe(false)

      // New password should work
      const newPasswordValid = await userManager.verifyPassword(user.id, newPassword)
      expect(newPasswordValid).toBe(true)
    })

    it('should reject password change with wrong current password', async () => {
      const user = await userManager.createUser(testUserData)

      await expect(
        userManager.changePassword(user.id, 'wrong-password', 'NewPassword123!')
      ).rejects.toThrow('Current password is incorrect')
    })

    it('should reset password', async () => {
      const user = await userManager.createUser(testUserData)
      const newPassword = 'ResetPassword123!'

      await userManager.resetPassword(user.id, newPassword, false)

      // New password should work
      const isValid = await userManager.verifyPassword(user.id, newPassword)
      expect(isValid).toBe(true)
    })
  })

  describe('User Status Management', () => {
    it('should deactivate user', async () => {
      const user = await userManager.createUser(testUserData)
      await userManager.deactivateUser(user.id)

      const updatedUser = await userManager.getUserById(user.id)
      expect(updatedUser!.isActive).toBe(false)
    })

    it('should activate user', async () => {
      const user = await userManager.createUser(testUserData)
      await userManager.deactivateUser(user.id)
      await userManager.activateUser(user.id)

      const updatedUser = await userManager.getUserById(user.id)
      expect(updatedUser!.isActive).toBe(true)
    })

    it('should lock user', async () => {
      const user = await userManager.createUser(testUserData)
      await userManager.lockUser(user.id, 'Test lock')

      const isLocked = await userManager.isUserLocked(user.id)
      expect(isLocked).toBe(true)
    })

    it('should unlock user', async () => {
      const user = await userManager.createUser(testUserData)
      await userManager.lockUser(user.id, 'Test lock')
      await userManager.unlockUser(user.id)

      const isLocked = await userManager.isUserLocked(user.id)
      expect(isLocked).toBe(false)
    })
  })

  describe('Role Management', () => {
    it('should assign role to user', async () => {
      const user = await userManager.createUser(testUserData)
      await userManager.assignRole(user.id, 'admin')

      const hasRole = await userManager.hasRole(user.id, 'admin')
      expect(hasRole).toBe(true)

      const roles = await userManager.getUserRoles(user.id)
      expect(roles).toContain('admin')
    })

    it('should remove role from user', async () => {
      const user = await userManager.createUser(testUserData)
      await userManager.assignRole(user.id, 'admin')

      // Check that role was assigned
      const hasRoleBefore = await userManager.hasRole(user.id, 'admin')
      expect(hasRoleBefore).toBe(true)

      await userManager.removeRole(user.id, 'admin')

      const hasRole = await userManager.hasRole(user.id, 'admin')
      expect(hasRole).toBe(false)
    })
  })

  describe('User Attributes', () => {
    it('should set user attribute', async () => {
      const user = await userManager.createUser(testUserData)
      await userManager.setAttribute(user.id, 'newAttribute', 'newValue')

      const value = await userManager.getAttribute(user.id, 'newAttribute')
      expect(value).toBe('newValue')
    })

    it('should get all user attributes', async () => {
      const user = await userManager.createUser(testUserData)
      await userManager.setAttribute(user.id, 'attr1', 'value1')
      await userManager.setAttribute(user.id, 'attr2', 'value2')

      const attributes = await userManager.getAttributes(user.id)
      expect(attributes.attr1).toBe('value1')
      expect(attributes.attr2).toBe('value2')
      expect(attributes.testAttribute).toBe('testValue') // From initial creation
    })

    it('should remove user attribute', async () => {
      const user = await userManager.createUser(testUserData)
      await userManager.setAttribute(user.id, 'tempAttribute', 'tempValue')

      // Check that attribute was set
      const valueBefore = await userManager.getAttribute(user.id, 'tempAttribute')
      expect(valueBefore).toBe('tempValue')

      await userManager.removeAttribute(user.id, 'tempAttribute')

      const value = await userManager.getAttribute(user.id, 'tempAttribute')
      expect(value).toBeUndefined()
    })
  })

  describe('User Search', () => {
    it('should find users by criteria', async () => {
      await userManager.createUser(testUserData)
      const user2Data = {
        ...testUserData,
        email: 'user2@example.com',
        department: 'Marketing'
      }
      await userManager.createUser(user2Data)

      const engineeringUsers = await userManager.findUsers({ department: 'Engineering' })
      expect(engineeringUsers).toHaveLength(1)
      expect(engineeringUsers[0].email).toBe(testUserData.email)

      const marketingUsers = await userManager.findUsers({ department: 'Marketing' })
      expect(marketingUsers).toHaveLength(1)
      expect(marketingUsers[0].email).toBe(user2Data.email)
    })

    it('should search users by text', async () => {
      await userManager.createUser(testUserData)
      const user2Data = {
        ...testUserData,
        email: 'john.doe@example.com',
        firstName: 'John',
        lastName: 'Doe'
      }
      await userManager.createUser(user2Data)

      const searchResults = await userManager.searchUsers('john')
      expect(searchResults).toHaveLength(1)
      expect(searchResults[0].firstName).toBe('John')
    })

    it('should list users with pagination', async () => {
      // Create multiple users
      for (let i = 0; i < 5; i++) {
        await userManager.createUser({
          ...testUserData,
          email: `user${i}@example.com`
        })
      }

      const result = await userManager.listUsers({ page: 1, limit: 3 })
      expect(result.users).toHaveLength(3)
      expect(result.total).toBe(5)
      expect(result.hasMore).toBe(true)
    })
  })

  describe('Validation', () => {
    it('should validate email availability', async () => {
      await userManager.createUser(testUserData)

      const isAvailable = await userManager.isEmailAvailable('new@example.com')
      expect(isAvailable).toBe(true)

      const isNotAvailable = await userManager.isEmailAvailable(testUserData.email)
      expect(isNotAvailable).toBe(false)
    })

    it('should validate password strength', async () => {
      const strongPassword = 'StrongPassword123!'
      const weakPassword = '123'

      const strongResult = await userManager.validatePassword(strongPassword)
      expect(strongResult.valid).toBe(true)

      const weakResult = await userManager.validatePassword(weakPassword)
      expect(weakResult.valid).toBe(false)
      expect(weakResult.suggestions.length).toBeGreaterThan(0)
    })
  })

  describe('Statistics', () => {
    it('should get user statistics', async () => {
      await userManager.createUser(testUserData)
      await userManager.createUser({
        ...testUserData,
        email: 'user2@example.com',
        department: 'Marketing'
      })

      const stats = await userManager.getUserStats()
      expect(stats.totalUsers).toBe(2)
      expect(stats.activeUsers).toBe(2)
      expect(stats.inactiveUsers).toBe(0)
      expect(stats.usersByDepartment.Engineering).toBe(1)
      expect(stats.usersByDepartment.Marketing).toBe(1)
    })
  })
})