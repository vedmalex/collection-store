import config from '../config';
import Collection from '../lib/collection';

/*
titles_replacements
  title: string
  replacment:
  date:
*/
export default new Collection({
  name: 'titlesReplacments',
  id: {
    name: 'title',
    auto: false,
  },
  ttl: config.COLLECTION_TTL,
});
