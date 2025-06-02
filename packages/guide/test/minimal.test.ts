import { test, expect } from 'bun:test'
import { fastify } from 'fastify'

test('minimal HTTP test', async () => {
  console.log('[MINIMAL] Starting minimal test...')

  const app = fastify()

  app.post('/test', async (request, reply) => {
    console.log('[MINIMAL] Handler called')
    return { message: 'success' }
  })

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
})