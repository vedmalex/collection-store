import { FastifyInstance } from 'fastify';
import { afterAll, beforeAll, expect, test } from 'bun:test';
import { initTestApp } from './utils.js';

let app: FastifyInstance;

beforeAll(async () => {
  console.log('[TEST] Starting beforeAll...')
  // we use different ports to allow parallel testing
  app = await initTestApp(30002);
  console.log('[TEST] beforeAll completed')
});

afterAll(async () => {
  console.log('[TEST] Starting afterAll...')
  // we close only the fastify app - it will close the database connection via onClose hook automatically
  await app.close();
  console.log('[TEST] afterAll completed')
});

test('sign-up new user', async () => {
  console.log('[TEST] Starting sign-up test...')

  try {
    console.log('[TEST] Making HTTP request...')
    const res = await app.inject({
      method: 'post',
      url: '/user/sign-up',
      payload: {
        fullName: 'Test User',
        email: 'test@example.com',
        password: 'password123',
      },
    });
    console.log('[TEST] HTTP request completed, status:', res.statusCode)

    expect(res.statusCode).toBe(200);
    expect(res.json()).toMatchObject({
      fullName: 'Test User',
      token: expect.any(String),
    });
    console.log('[TEST] Test completed successfully')
  } catch (error) {
    console.error('[TEST] Error in test:', error)
    throw error
  }
});
