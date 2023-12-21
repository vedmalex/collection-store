import type { EntityManager } from 'collection-store-mikro-orm'
import { Seeder } from '@mikro-orm/seeder'
import { User } from '../modules/user/user.entity.js'

export class TestSeeder extends Seeder {
  async run(em: EntityManager): Promise<void> {
    console.log('seeder')
    const author = em.create(User, {
      fullName: 'Foo Bar',
      email: 'foo@bar.com',
      password: 'password123',
      social: { twitter: '@foobar' },
      articles: [
        {
          title: 'title 1/3',
          description: 'desc 1/3',
          text: 'text text text 1/3',
          tags: [
            { id: 1, name: 'foo1' },
            { id: 2, name: 'foo2' },
          ],
        },
        {
          title: 'title 2/3',
          description: 'desc 2/3',
          text: 'text text text 2/3',
          tags: [{ id: 2, name: 'foo2' }],
        },
        {
          title: 'title 3/3',
          description: 'desc 3/3',
          text: 'text text text 3/3',
          tags: [
            { id: 2, name: 'foo2' },
            { id: 3, name: 'foo3' },
          ],
        },
      ],
    })
    console.log('author')
    await em.flush()

    em.assign(author.articles[0], {
      comments: [
        { author, text: `random comment ${Math.random()}` },
        { author, text: `random comment ${Math.random()}` },
      ],
    })
    console.log('articles 1')
    await em.flush()

    em.assign(author.articles[1], {
      comments: [{ author, text: `random comment ${Math.random()}` }],
    })
    console.log('articles 2 ')
    await em.flush()

    em.assign(author.articles[2], {
      comments: [
        { author, text: `random comment ${Math.random()}` },
        { author, text: `random comment ${Math.random()}` },
        { author, text: `random comment ${Math.random()}` },
      ],
    })
    console.log('articles 3')
    await em.flush()
  }
}
