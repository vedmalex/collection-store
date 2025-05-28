import { Seeder } from '@mikro-orm/seeder'
import type { EntityManager } from '@mikro-orm/core'
import { User } from '../modules/user/user.entity.js'

export class TestSeeder extends Seeder {
  async run(em: EntityManager): Promise<void> {
    console.log('seeder')

    // Create user only
    const author = em.create(User, {
      fullName: 'Foo Bar',
      email: 'foo@bar.com',
      password: 'password123',
      social: { twitter: '@foobar' },
    })
    console.log('author created')
    await em.flush()
    console.log('seeder completed')
  }
}
