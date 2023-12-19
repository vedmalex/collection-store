import { FindOptions, EntityRepository, LoadStrategy } from '@mikro-orm/core'
import { Article } from './article.entity.js'
import { ArticleListing } from './article-listing.entity.js'

// extending the EntityRepository exported from driver package, so we can access things like the QB factory
export class ArticleRepository extends EntityRepository<Article> {
  listArticlesQuery() {
    // sub-query for total number of comments
    return this.findAll({
      populate: ['tags', 'comments', 'author'],
      strategy: LoadStrategy.JOINED,
    }).then((res) => {
      return res.map((item) => {
        return {
          slug: item.slug,
          title: item.title,
          description: item.description,
          tags: item.tags.map((tag) => tag.name),
          author: item.author.id,
          authorName: item.author.getEntity().fullName,
          totalComments: item.comments.length,
        }
      })
    })
  }

  async listArticles(options: FindOptions<ArticleListing>) {
    const rep = this.em.fork().getRepository('ArticleListing')
    const [items, total] = await rep.findAndCount(ArticleListing, {})
    return { items, total }
  }
}
