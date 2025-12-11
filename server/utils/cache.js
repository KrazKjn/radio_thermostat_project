const NodeCache = require('node-cache');

// Initialize a new cache instance with a default TTL of 5 minutes,
// and check for expired keys every 2 minutes.
const cache = new NodeCache({ stdTTL: 300, checkperiod: 120 });

// Define TTL constants for different data types in seconds
const TTL = {
  DEVICE_INFO: 86400, // 24 hours
  CURRENT_STATE: 120, // 2 minutes
  ANALYTICS_SHORT: 600, // 10 minutes
  ANALYTICS_LONG: 3600, // 1 hour
};

/**
 * Retrieves a value from the cache.
 * @param {string} key The cache key.
 * @returns {any | undefined} The cached value, or undefined if not found.
 */
const get = (key) => {
  return cache.get(key);
};

/**
 * Stores a value in the cache with a specific TTL.
 * @param {string} key The cache key.
 * @param {any} value The value to store.
 * @param {number} ttl The Time To Live in seconds.
 */
const set = (key, value, ttl) => {
  cache.set(key, value, ttl);
};

/**
 * Deletes a key from the cache.
 * @param {string} key The cache key to delete.
 */
const del = (key) => {
  cache.del(key);
};

/**
 * Flushes the entire cache.
 */
const flush = () => {
  cache.flushAll();
};

module.exports = {
  get,
  set,
  del,
  flush,
  TTL,
};
