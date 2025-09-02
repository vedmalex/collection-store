import { describe, it, expect, mock } from 'bun:test'

mock.module('../../core/Collection', () => ({ default: class {} }))
mock.module('b-pl-tree', () => ({}))

describe('validate_indexed_value_for_insert', () => {
  it('validates arrays of values for uniqueness and required', async () => {
    const { validate_indexed_value_for_insert } = await import('../validate_indexed_value_for_insert')
    const collection = {
      indexes: {
        tag: {
          findFirst: (v: any) => (v === 'dup' ? 0 : undefined),
        },
      },
    } as any

    const [ok1] = validate_indexed_value_for_insert(collection, ['a', 'b'], 'tag', false, false, true)
    expect(ok1).toBe(true)

    const [ok2, msg2] = validate_indexed_value_for_insert(collection, ['dup'], 'tag', false, false, true)
    expect(ok2).toBe(false)
    expect(msg2).toContain('already contains value dup')

    const [ok3, msg3] = validate_indexed_value_for_insert(collection, [null], 'tag', false, true, false)
    expect(ok3).toBe(false)
    expect(msg3).toContain('is required')
  })
})
