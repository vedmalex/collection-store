import { wrap } from '@mikro-orm/core'
import { FastifyInstance } from 'fastify'
import { z } from 'zod'
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
  app.post('/sign-up', async (request) => {
    const dto = userSchema.parse(request.body)

    if (await db.user.exists(dto.email)) {
      throw new Error(
        'This email is already registered, maybe you want to sign in?',
      )
    }

    const em = db.em.fork()
    const userRepo = em.getRepository(User)
    // thanks to zod, our `dto` is fully typed and passes the `em.create()` checks
    const user = userRepo.create(dto)
    debugger
    await em.flush() // no need for explcit `em.persist()` when we use `em.create()`

    // after flush, we have the `user.id` set
    user.token = app.jwt.sign({ id: user.id })

    return user
  })

  // login existing user
  app.post('/sign-in', async (request) => {
    const { email, password } = request.body as {
      email: string
      password: string
    }
    const user = await db.user.login(email, password)
    user.token = app.jwt.sign({ id: user.id })

    return user
  })

  app.get('/profile', async (request) => {
    const user = getUserFromToken(request)
    return user
  })

  app.patch('/profile', async (request) => {
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
  })
}
