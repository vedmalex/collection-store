import config from '../config';
import Collection from '../lib/collection';

/*
reported_url_num
{
  url: articleId,
  date: reported Date,
}
*/
export default new Collection({
  name: 'articlesReported',
  id: {
    name: 'url',
    auto: false,
  },
  ttl: config.COLLECTION_TTL,
});
