import { FastifyInstance } from 'fastify';
import { afterAll, beforeAll, expect, test } from 'vitest';
import { initTestApp } from './utils.js';

let app: FastifyInstance;

beforeAll(async () => {
  // we use different ports to allow parallel testing
  app = await initTestApp(30002);
});

afterAll(async () => {
  // we close only the fastify app - it will close the database connection via onClose hook automatically
  await app.close();
});

test('sign-up new user', async () => {
  const res = await app.inject({
    method: 'post',
    url: '/user/sign-up',
    payload: {
      fullName: 'Test User',
      email: 'test@example.com',
      password: 'password123',
    },
  });

  expect(res.statusCode).toBe(200);
  expect(res.json()).toMatchObject({
    fullName: 'Test User',
    token: expect.any(String),
  });
});
