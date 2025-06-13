import { fastify } from 'fastify'
import fastifyJWT from '@fastify/jwt'
import { NotFoundError, RequestContext } from 'collection-store-mikro-orm'
import { initORM } from './db.js'
import { registerUserRoutes } from './modules/user/routes.js'
import { registerArticleRoutes } from './modules/article/routes.js'
import { AuthError } from './modules/common/utils.js'
import { TestSeeder } from './seeders/TestSeeder.js'
import { User } from './modules/user/user.entity.js'

export async function bootstrap(port = 3001, seed = false) {
  const db = await initORM()

  if (seed) {
    await db.orm.schema.refreshDatabase()
    await db.orm.seeder.seed(TestSeeder)
  } else {
    await db.orm.schema.ensureDatabase()
  }
  const app = fastify()

  // register JWT plugin
  app.register(fastifyJWT, {
    secret: process.env.JWT_SECRET ?? '12345678', // fallback for testing
  })

  // register request context hook
  app.addHook('onRequest', (request, reply, done) => {
    RequestContext.create(db.em, done)
  })

  // register auth hook after the ORM one to use the context
  app.addHook('onRequest', async (request) => {
    try {
      const ret = await request.jwtVerify<{ id: number }>()
      request.user = await db.em.findOneOrFail(User, ret.id)
    } catch (e) {
      app.log.error(e)
      // ignore token errors, we validate the request.user exists only where needed
    }
  })

  // register global error handler to process 404 errors from `findOneOrFail` calls
  app.setErrorHandler((error, request, reply) => {
    // Check if response has already been sent
    if (reply.sent || reply.raw.headersSent) {
      app.log.error('Response already sent, cannot handle error:', error)
      return
    }

    try {
      if (error instanceof AuthError) {
        return reply.status(401).send({ error: error.message })
      }

      if (error instanceof NotFoundError) {
        return reply.status(404).send({ error: error.message })
      }

      app.log.error(error)
      return reply.status(500).send({ error: error.message })
    } catch (handlerError) {
      app.log.error('Error in error handler:', handlerError)
      // Don't try to send response if we're already in an error state
    }
  })

  // shut down the connection when closing the app
  app.addHook('onClose', async () => {
    await db.orm.close()
  })

  app.register(registerUserRoutes, { prefix: 'user' })
  app.register(registerArticleRoutes, { prefix: 'article' })

  const url = await app.listen({ port })

  return { app, url }
}
