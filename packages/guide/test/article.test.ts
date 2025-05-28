import { afterAll, beforeAll, expect, test } from 'vitest';
import { initTestApp } from './utils.js';
import { FastifyInstance } from 'fastify';

let app: FastifyInstance;

beforeAll(async () => {
  // we use different ports to allow parallel testing
  app = await initTestApp(30001);
});

afterAll(async () => {
  // we close only the fastify app - it will close the database connection via onClose hook automatically
  await app.close();
});

test('list articles should return empty list initially', async () => {
  const res = await app.inject({
    method: 'get',
    url: '/article',
  });
  expect(res.statusCode).toBe(200);
  expect(res.json()).toMatchObject({
    items: [],
    total: 0,
  });
});
