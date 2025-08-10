import { test, expect } from 'bun:test'
import { fastify } from 'fastify'

test.skip('minimal HTTP test', async () => {
  console.log('[MINIMAL] Starting minimal test...')

  const app = fastify()

  app.post('/test', async (request, reply) => {
    console.log('[MINIMAL] Handler called')
    // Explicitly send response and return to avoid double-send
    return reply.send({ message: 'success' })
  })

  // Ensure app and routes are ready
  await app.ready()

  console.log('[MINIMAL] Making HTTP request...')
  const res = await app.inject({
    method: 'post',
    url: '/test',
    payload: { test: 'data' },
  })

  console.log('[MINIMAL] Response received:', res.statusCode)
  expect(res.statusCode).toBe(200)
  expect(res.json()).toMatchObject({ message: 'success' })

  console.log('[MINIMAL] Test completed')
  await app.close()
})