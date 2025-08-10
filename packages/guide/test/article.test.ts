import { afterAll, beforeAll, expect, test, describe } from 'bun:test';
import { initTestApp } from './utils.js';
import { FastifyInstance } from 'fastify';

describe.skip('Guide Articles API', () => {
  let app: FastifyInstance;

  beforeAll(async () => {
    app = await initTestApp(30001);
  });

  afterAll(async () => {
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
});
