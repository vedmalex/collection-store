import { describe, it, expect, mock } from 'bun:test'

// Mock transformers pipeline
let running = 0
let maxRunning = 0
const extractor = async () => {
  running += 1
  if (running > maxRunning) maxRunning = running
  await new Promise((r) => setTimeout(r, 10))
  running -= 1
  return { data: new Float32Array(384) }
}
const pipeline = mock(() => extractor)
mock.module('@xenova/transformers', () => ({ pipeline }))

describe('EmbeddingService', () => {
  it('encodes text using cached model with concurrency limit', async () => {
    const { encode } = await import('../EmbeddingService')
    const [a, b] = await Promise.all([encode('a'), encode('b')])
    expect(a).toHaveLength(384)
    expect(b).toHaveLength(384)
    expect(pipeline).toHaveBeenCalledTimes(1)
    expect(maxRunning).toBe(1)
  })
})
