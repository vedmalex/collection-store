import { describe, it, expect, mock } from 'bun:test'

mock.module('../../core/Collection', () => ({ default: class {} }))
mock.module('b-pl-tree', () => ({}))

describe('validate_indexed_value_for_update', () => {
  it('checks uniqueness across arrays when updating', async () => {
    const { validate_indexed_value_for_update } = await import('../validate_indexed_value_for_update')

    const collection1 = {
      indexes: { tag: { findFirst: (v: any) => (v === 'dup' ? 0 : undefined) } },
      list: { get: async () => ({ id: 'other' }) },
      id: 'id',
    } as any

    const [ok1, msg1] = await validate_indexed_value_for_update(collection1, ['dup'], 'tag', false, false, true, 'current')
    expect(ok1).toBe(false)
    expect(msg1).toContain('already contains value dup')

    const collection2 = {
      indexes: { tag: { findFirst: () => 0 } },
      list: { get: async () => ({ id: 'current' }) },
      id: 'id',
    } as any

    const [ok2] = await validate_indexed_value_for_update(collection2, ['dup'], 'tag', false, false, true, 'current')
    expect(ok2).toBe(true)
  })
})
