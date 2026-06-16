const path = require('path');
const dotenv = require('dotenv');

dotenv.config({
  path: path.join(__dirname, '..', '..', '..', '.env'),
});

dotenv.config({
  path: path.join(__dirname, '..', '..', '.env'),
  override: true,
});

function readNumber(name, fallback) {
  const value = Number(process.env[name]);
  return Number.isFinite(value) && value > 0 ? value : fallback;
}

function readOptionalNumber(name) {
  const value = Number(process.env[name]);
  return Number.isFinite(value) && value > 0 ? value : null;
}

function readBoolean(name, fallback) {
  const value = process.env[name];
  if (value === undefined) return fallback;
  return value === 'true' || value === '1';
}

const env = {
  port: readNumber('PORT', 3000),
  deepseekApiKey: process.env.DEEPSEEK_API_KEY || '',
  deepseekApiUrl: process.env.DEEPSEEK_API_URL || 'https://api.deepseek.com/v1/chat/completions',
  aiModel: process.env.AI_MODEL || 'deepseek-v4-flash',
  aiConcurrency: readNumber('AI_CONCURRENCY', 3),
  aiInterpretationMaxTokens: readOptionalNumber('AI_INTERPRETATION_MAX_TOKENS'),
  maxItemsPerFeed: readNumber('MAX_ITEMS_PER_FEED', 30),
  maxNewsPerCategory: readNumber('MAX_NEWS_PER_CATEGORY', 24),
  newsFetchTimeoutMs: readNumber('NEWS_FETCH_TIMEOUT_MS', 20000),
  newsRetentionHours: readNumber('NEWS_RETENTION_HOURS', 24),
  newsPageSize: readNumber('NEWS_PAGE_SIZE', 8),
  searchHistoryRetentionDays: readNumber('SEARCH_HISTORY_RETENTION_DAYS', 7),
  searchResultLimit: readNumber('SEARCH_RESULT_LIMIT', 20),
  onlineSearchCacheMinutes: readNumber('ONLINE_SEARCH_CACHE_MINUTES', 10),
  cronSchedule: process.env.CRON_SCHEDULE || '0 0 */2 * * *',
  initialRefreshOnStart: readBoolean('INITIAL_REFRESH_ON_START', true),
  readRefreshMaxAgeMinutes: readNumber('READ_REFRESH_MAX_AGE_MINUTES', 120),
  manualRefreshCooldownMinutes: readNumber('MANUAL_REFRESH_COOLDOWN_MINUTES', 5),
  appTimeZone: process.env.APP_TIME_ZONE || 'Asia/Shanghai',
  storageDir: process.env.STORAGE_DIR || path.join(__dirname, '..', '..', 'storage'),
};

module.exports = env;
