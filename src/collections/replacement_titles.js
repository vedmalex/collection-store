import config from '../config';
import Collection from '../lib/collection';

/*
titles_replacements
  title: string
  replacment:
  date:
*/
// reverse mapping to check if the original title is replaced
export default new Collection({
  name: 'replacment_titles',
  id: {
    name: 'replacement',
    auto: false,
  },
  ttl: config.COLLECTION_TTL,
});
