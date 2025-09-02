import { describe, it, expect, mock } from 'bun:test'

mock.module('../../core/Collection', () => ({ default: class {} }))

describe('prepare_index_insert', () => {
  it('flattens insert hooks returned as arrays', async () => {
    const { prepare_index_insert } = await import('../prepare_index_insert')
    const calls: string[] = []
    const collection = {
      inserts: [
        () => (arr: string[]) => arr.push('a'),
        () => [(arr: string[]) => arr.push('b'), (arr: string[]) => arr.push('c')],
      ],
    } as any
    const fn = prepare_index_insert(collection, {})
    fn(calls)
    expect(calls).toEqual(['a', 'b', 'c'])
  })
})
