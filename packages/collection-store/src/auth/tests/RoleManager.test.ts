// RoleManager Tests for Collection Store Auth System
// Testing role management functionality

import { describe, test, expect, beforeEach } from 'bun:test'
import { CSDatabase } from '../../'
import { RoleManager } from '../core/RoleManager'
import { TEST_AUTH_CONFIG } from '../config/defaults'
import { Role, CreateRoleData, AuthContext } from '../interfaces/types'
import { SYSTEM_ROLES } from '../rbac/types'

describe('RoleManager', () => {
  let database: CSDatabase
  let roleManager: RoleManager
  let testContext: AuthContext

  beforeEach(async () => {
    // Create in-memory database for testing
    database = new CSDatabase(':memory:')
    await database.connect()

    roleManager = new RoleManager(database)

    testContext = {
      ip: '127.0.0.1',
      userAgent: 'test-agent',
      timestamp: Date.now(),
      requestId: 'test-request',
      customAttributes: { userId: 'test-user' }
    }
  })

  describe('System Roles', () => {
    test('should initialize system roles', async () => {
      await roleManager.initializeSystemRoles()

      const superAdmin = await roleManager.getSystemRole(SYSTEM_ROLES.SUPER_ADMIN)
      expect(superAdmin).toBeTruthy()
      expect(superAdmin?.name).toBe('Super Administrator')
      expect(superAdmin?.isSystemRole).toBe(true)

      const admin = await roleManager.getSystemRole(SYSTEM_ROLES.ADMIN)
      expect(admin).toBeTruthy()
      expect(admin?.name).toBe('Administrator')

      const user = await roleManager.getSystemRole(SYSTEM_ROLES.USER)
      expect(user).toBeTruthy()
      expect(user?.autoAssign).toBe(true)
    })

    test('should identify system roles correctly', () => {
      expect(roleManager.isSystemRole(SYSTEM_ROLES.SUPER_ADMIN)).toBe(true)
      expect(roleManager.isSystemRole(SYSTEM_ROLES.ADMIN)).toBe(true)
      expect(roleManager.isSystemRole('custom-role')).toBe(false)
    })
  })

  describe('Role CRUD Operations', () => {
    test('should create a new role', async () => {
      const roleData: CreateRoleData = {
        name: 'Test Role',
        description: 'A test role for testing',
        permissions: [
          { resource: 'test', action: 'read' }
        ]
      }

      const role = await roleManager.createRole(roleData, testContext)

      expect(role.id).toBeTruthy()
      expect(role.name).toBe('Test Role')
      expect(role.description).toBe('A test role for testing')
      expect(role.permissions).toHaveLength(1)
      expect(role.isSystemRole).toBe(false)
      expect(role.createdBy).toBe('test-user')
    })

    test('should not create role with duplicate name', async () => {
      const roleData: CreateRoleData = {
        name: 'Duplicate Role',
        description: 'First role'
      }

      await roleManager.createRole(roleData, testContext)

      // Try to create another role with same name
      const duplicateData: CreateRoleData = {
        name: 'Duplicate Role',
        description: 'Second role'
      }

      await expect(roleManager.createRole(duplicateData, testContext))
        .rejects.toThrow('already exists')
    })

    test('should get role by ID', async () => {
      const roleData: CreateRoleData = {
        name: 'Get Test Role',
        description: 'Role for get testing'
      }

      const createdRole = await roleManager.createRole(roleData, testContext)
      const retrievedRole = await roleManager.getRoleById(createdRole.id)

      expect(retrievedRole).toBeTruthy()
      expect(retrievedRole?.id).toBe(createdRole.id)
      expect(retrievedRole?.name).toBe('Get Test Role')
    })

    test('should get role by name', async () => {
      const roleData: CreateRoleData = {
        name: 'Name Test Role',
        description: 'Role for name testing'
      }

      await roleManager.createRole(roleData, testContext)
      const retrievedRole = await roleManager.getRoleByName('Name Test Role')

      expect(retrievedRole).toBeTruthy()
      expect(retrievedRole?.name).toBe('Name Test Role')
    })

    test('should update role', async () => {
      const roleData: CreateRoleData = {
        name: 'Update Test Role',
        description: 'Original description'
      }

      const createdRole = await roleManager.createRole(roleData, testContext)

      const updatedRole = await roleManager.updateRole(createdRole.id, {
        description: 'Updated description',
        permissions: [{ resource: 'updated', action: 'write' }]
      }, testContext)

      expect(updatedRole.description).toBe('Updated description')
      expect(updatedRole.permissions).toHaveLength(1)
      expect(updatedRole.permissions[0].action).toBe('write')
    })

    test('should not update system role', async () => {
      await roleManager.initializeSystemRoles()

      await expect(roleManager.updateRole(SYSTEM_ROLES.SUPER_ADMIN, {
        description: 'Modified system role'
      }, testContext)).rejects.toThrow('Cannot modify system roles')
    })

    test('should delete role', async () => {
      const roleData: CreateRoleData = {
        name: 'Delete Test Role',
        description: 'Role to be deleted'
      }

      const createdRole = await roleManager.createRole(roleData, testContext)
      const deleted = await roleManager.deleteRole(createdRole.id, testContext)

      expect(deleted).toBe(true)

      const retrievedRole = await roleManager.getRoleById(createdRole.id)
      expect(retrievedRole).toBeNull()
    })

    test('should not delete system role', async () => {
      await roleManager.initializeSystemRoles()

      await expect(roleManager.deleteRole(SYSTEM_ROLES.SUPER_ADMIN, testContext))
        .rejects.toThrow('Cannot delete system roles')
    })

    test('should list roles with pagination', async () => {
      // Create test roles
      for (let i = 1; i <= 5; i++) {
        await roleManager.createRole({
          name: `Test Role ${i}`,
          description: `Description ${i}`
        }, testContext)
      }

      const result = await roleManager.listRoles({
        page: 1,
        limit: 3,
        includeSystemRoles: false
      })

      expect(result.roles).toHaveLength(3)
      expect(result.total).toBe(5)
      expect(result.page).toBe(1)
      expect(result.limit).toBe(3)
      expect(result.hasMore).toBe(true)
    })

    test('should search roles by name', async () => {
      await roleManager.createRole({
        name: 'Search Test Role',
        description: 'Searchable role'
      }, testContext)

      await roleManager.createRole({
        name: 'Another Role',
        description: 'Different role'
      }, testContext)

      const result = await roleManager.listRoles({
        search: 'Search',
        includeSystemRoles: false
      })

      expect(result.roles).toHaveLength(1)
      expect(result.roles[0].name).toBe('Search Test Role')
    })
  })

  describe('Validation', () => {
    test('should validate role data correctly', async () => {
      const validData: CreateRoleData = {
        name: 'Valid Role',
        description: 'Valid description',
        permissions: [{ resource: 'test', action: 'read' }]
      }

      const validation = await roleManager.validateRoleData(validData)
      expect(validation.valid).toBe(true)
      expect(validation.errors).toHaveLength(0)
    })

    test('should reject invalid role data', async () => {
      const invalidData: CreateRoleData = {
        name: '', // Empty name
        description: 'A'.repeat(600) // Too long description
      }

      const validation = await roleManager.validateRoleData(invalidData)
      expect(validation.valid).toBe(false)
      expect(validation.errors.length).toBeGreaterThan(0)
    })

    test('should validate permission correctly', async () => {
      const validPermission = { resource: 'test', action: 'read' }
      const validation = await roleManager.validatePermission(validPermission)

      expect(validation.valid).toBe(true)
      expect(validation.errors).toHaveLength(0)
    })

    test('should reject invalid permission', async () => {
      const invalidPermission = { resource: '', action: '' }
      const validation = await roleManager.validatePermission(invalidPermission)

      expect(validation.valid).toBe(false)
      expect(validation.errors.length).toBeGreaterThan(0)
    })

    test('should validate role name uniqueness', async () => {
      await roleManager.createRole({
        name: 'Unique Test Role',
        description: 'Test'
      }, testContext)

      const isUnique1 = await roleManager.validateRoleName('Unique Test Role')
      expect(isUnique1).toBe(false) // Name already exists

      const isUnique2 = await roleManager.validateRoleName('New Unique Role')
      expect(isUnique2).toBe(true) // Name doesn't exist
    })
  })

  describe('Cache Management', () => {
    test('should clear role cache', async () => {
      const role = await roleManager.createRole({
        name: 'Cache Test Role',
        description: 'Test'
      }, testContext)

      await roleManager.clearRoleCache(role.id)
      await roleManager.clearRoleCache() // Clear all

      // Should not throw
      expect(true).toBe(true)
    })

    test('should clear permission cache', async () => {
      await roleManager.clearPermissionCache('user123')
      await roleManager.clearPermissionCache() // Clear all

      // Should not throw
      expect(true).toBe(true)
    })

    test('should refresh hierarchy cache', async () => {
      await roleManager.refreshHierarchyCache()

      // Should not throw
      expect(true).toBe(true)
    })
  })
})