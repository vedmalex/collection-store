import config from '../config';
import Collection from '../lib/collection';

/*
already_viewed_titles
{
  title,
  date: visited,
}
*/
export default new Collection({
  name: 'alreadyViewedTitles',
  id: {
    name: 'title',
    auto: false,
  },
  ttl: config.COLLECTION_TTL,
});
