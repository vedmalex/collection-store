import { pipeline, type Pipeline } from '@xenova/transformers'

let modelPromise: Promise<Pipeline> | null = null
const MAX_CONCURRENT = 1
let active = 0
const waiting: Array<() => void> = []

async function acquire() {
  if (active >= MAX_CONCURRENT) {
    await new Promise<void>(resolve => waiting.push(resolve))
  }
  active += 1
}

function release() {
  active -= 1
  const next = waiting.shift()
  if (next) next()
}

export async function encode(text: string): Promise<number[]> {
  modelPromise ||= pipeline('feature-extraction', 'Xenova/all-MiniLM-L12-v2')
  const extractor = await modelPromise
  await acquire()
  try {
    const output = await extractor(text, { pooling: 'mean', normalize: true })
    return Array.from(output.data)
  } finally {
    release()
  }
}
