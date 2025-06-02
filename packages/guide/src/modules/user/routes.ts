import { FastifyInstance } from 'fastify'
import { z } from 'zod'
import { wrap } from 'collection-store-mikro-orm'
import { initORM } from '../../db.js'
import { User } from './user.entity.js'
import { getUserFromToken } from '../common/utils.js'

const socialSchema = z.object({
  twitter: z.string().optional(),
  facebook: z.string().optional(),
  linkedin: z.string().optional(),
})

const userSchema = z.object({
  email: z.string(),
  fullName: z.string(),
  password: z.string(),
  bio: z.string().optional(),
  social: socialSchema.optional(),
})

export async function registerUserRoutes(app: FastifyInstance) {
  const db = await initORM()

  // register new user
  app.post('/sign-up', async (request, reply) => {
    try {
      const dto = userSchema.parse(request.body)

      if (await db.user.exists(dto.email)) {
        return reply.status(400).send({
          error: 'This email is already registered, maybe you want to sign in?',
        })
      }

      const em = db.em.fork()
      const userRepo = em.getRepository(User)
      // thanks to zod, our `dto` is fully typed and passes the `em.create()` checks
      const user = userRepo.create(dto)
      await em.flush() // no need for explcit `em.persist()` when we use `em.create()`

      // after flush, we have the `user.id` set
      user.token = app.jwt.sign({ id: user.id })

      return user
    } catch (error) {
      return reply.status(500).send({
        error: error instanceof Error ? error.message : 'Internal server error',
      })
    }
  })

  // login existing user
  app.post('/sign-in', async (request, reply) => {
    try {
      const { email, password } = request.body as {
        email: string
        password: string
      }
      const user = await db.user.login(email, password)
      user.token = app.jwt.sign({ id: user.id })

      return user
    } catch (error) {
      return reply.status(401).send({
        error: error instanceof Error ? error.message : 'Authentication failed',
      })
    }
  })

  app.get('/profile', async (request, reply) => {
    try {
      const user = getUserFromToken(request)
      return user
    } catch (error) {
      return reply.status(401).send({
        error: error instanceof Error ? error.message : 'Authentication required',
      })
    }
  })

  app.patch('/profile', async (request, reply) => {
    try {
      const user_auth = getUserFromToken(request)
      const em = db.em.fork()
      const userRepo = em.getRepository(User)
      const user = await userRepo.findOneOrFail(user_auth.id)
      console.log(user)
      console.log(request.body)
      const wrapped = wrap(user)
      console.log(wrapped)
      wrapped.assign(request.body as User)
      await em.flush()
      return user_auth
    } catch (error) {
      return reply.status(500).send({
        error: error instanceof Error ? error.message : 'Profile update failed',
      })
    }
  })
}
