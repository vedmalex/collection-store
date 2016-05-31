import config from '../config';
import Collection from '../lib/collection';

/*
url_to_titles_mapping
{
  url: articleId,
  title: storedTitle for article
  date: viisted
}
*/
export default new Collection({
  name: 'urlToTitlesMapping',
  id: {
    name: 'url',
    auto: false,
  },
  ttl: config.COLLECTION_TTL,
});
