const cache = new Map();

function getCache(key) {
  const entry = cache.get(key);
  if (!entry) return null;

  if (Date.now() > entry.expires) {
    cache.delete(key);
    return null;
  }
  return entry.data;
}

function setCache(key, data, ttl = 10 * 60 * 1000) { // 10 min
  cache.set(key, {
    data,
    expires: Date.now() + ttl
  });
}

module.exports = { getCache, setCache };
