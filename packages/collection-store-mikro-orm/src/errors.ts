/**
 * Collection Store specific error types for MikroORM compatibility
 */

export class CollectionStoreError extends Error {
  public readonly code?: string

  constructor(message: string, code?: string) {
    super(message)
    this.name = 'CollectionStoreError'
    this.code = code
  }
}

export class CollectionStoreValidationError extends CollectionStoreError {
  public readonly violations: any[]

  constructor(message: string, violations: any[]) {
    super(message, 'VALIDATION_ERROR')
    this.name = 'CollectionStoreValidationError'
    this.violations = violations
  }
}

export class CollectionStoreNotFoundError extends CollectionStoreError {
  constructor(entityName: string, where: any) {
    super(`${entityName} not found for criteria ${JSON.stringify(where)}`, 'NOT_FOUND')
    this.name = 'CollectionStoreNotFoundError'
  }
}

export class CollectionStoreConnectionError extends CollectionStoreError {
  constructor(message: string) {
    super(message, 'CONNECTION_ERROR')
    this.name = 'CollectionStoreConnectionError'
  }
}

export class CollectionStoreTransactionError extends CollectionStoreError {
  constructor(message: string) {
    super(message, 'TRANSACTION_ERROR')
    this.name = 'CollectionStoreTransactionError'
  }
}

export class CollectionStoreSavepointError extends CollectionStoreError {
  public readonly savepointId?: string

  constructor(message: string, savepointId?: string) {
    super(message, 'SAVEPOINT_ERROR')
    this.name = 'CollectionStoreSavepointError'
    this.savepointId = savepointId
  }
}