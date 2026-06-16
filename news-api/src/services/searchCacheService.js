const fs = require('fs');
const path = require('path');
const env = require('../config/env');
const { getDateKey, subtractHours, toDate } = require('../utils/dateUtils');
const { limitText } = require('../utils/textUtils');

const STORE_FILE = path.join(env.storageDir, 'searchHistory.json');
const DAY_HOURS = 24;
const HISTORY_QUERY_MIN_LENGTH = 2;
const RECENT_QUERY_REPLACE_MS = 3 * 60 * 1000;

function ensureStorageDir() {
  if (!fs.existsSync(env.storageDir)) {
    fs.mkdirSync(env.storageDir, { recursive: true });
  }
}

function buildEmptyStore() {
  return {
    updatedAt: null,
    retentionDays: env.searchHistoryRetentionDays,
    searches: [],
    items: {},
  };
}

function readStoreFile() {
  ensureStorageDir();
  if (!fs.existsSync(STORE_FILE)) return buildEmptyStore();

  try {
    const rawText = fs.readFileSync(STORE_FILE, 'utf-8');
    return {
      ...buildEmptyStore(),
      ...JSON.parse(rawText),
    };
  } catch (error) {
    console.warn(`[搜索缓存] 读取缓存失败: ${error.message}`);
    return buildEmptyStore();
  }
}

function writeStoreFile(data) {
  ensureStorageDir();
  const tempFile = `${STORE_FILE}.tmp`;
  fs.writeFileSync(tempFile, JSON.stringify(data, null, 2), 'utf-8');
  fs.renameSync(tempFile, STORE_FILE);
}

function getCutoffTime(options = {}) {
  const now = toDate(options.now || new Date());
  return subtractHours(now, env.searchHistoryRetentionDays * DAY_HOURS).getTime();
}

function isInsideRetentionWindow(value, options = {}) {
  const timestamp = toDate(value).getTime();
  return Number.isFinite(timestamp) && timestamp >= getCutoffTime(options);
}

function normalizeCachedItem(item = {}) {
  const publishedAt = toDate(item.publishedAt || new Date()).toISOString();
  const searchCachedAt = toDate(item.searchCachedAt || item.cachedAt || new Date()).toISOString();
  const title = limitText(item.title || '', 120);
  if (!item.id || !title || !item.sourceUrl || !item.source) return null;

  const interpretationStatus = item.interpretation
    ? 'success'
    : item.interpretationStatus || item.aiStatus || 'pending';

  return {
    id: String(item.id),
    title,
    category: item.category || '综合',
    topics: Array.isArray(item.topics) ? item.topics : [],
    overview: limitText(item.overview || item.summary || item.shortSummary || item.rawSummary || title, 300),
    interpretation: item.interpretation || '',
    interpretationStatus,
    analysisType: item.analysisType || '',
    signals: Array.isArray(item.signals) ? item.signals : [],
    source: item.source,
    sourceUrl: item.sourceUrl,
    imageUrl: item.imageUrl || '',
    imageAlt: item.imageAlt || title,
    publishedAt,
    priority: item.priority || 'P2',
    aiStatus: interpretationStatus,
    date: item.date || getDateKey(publishedAt),
    time: item.time || '',
    rawSummary: limitText(item.rawSummary || item.overview || title, 600),
    origin: item.origin || 'web',
    originLabel: item.originLabel || (item.origin === 'local' ? '本地已收录' : '联网补充'),
    searchCachedAt,
  };
}

function normalizeSearchRecord(record = {}) {
  const searchedAt = toDate(record.searchedAt || new Date()).toISOString();
  const itemIds = Array.isArray(record.itemIds) ? record.itemIds.map(String).filter(Boolean) : [];
  if (!record.id || !record.query || !itemIds.length) return null;

  return {
    id: String(record.id),
    query: String(record.query).trim(),
    mode: record.mode || 'online',
    searchedAt,
    itemIds: [...new Set(itemIds)],
  };
}

function pruneStore(store, options = {}) {
  const searches = (Array.isArray(store.searches) ? store.searches : [])
    .map(normalizeSearchRecord)
    .filter((record) => record && isInsideRetentionWindow(record.searchedAt, options))
    .sort((current, next) => toDate(next.searchedAt).getTime() - toDate(current.searchedAt).getTime());

  const activeItemIds = new Set(searches.flatMap((record) => record.itemIds));
  const items = Object.entries(store.items || {}).reduce((result, [itemId, item]) => {
    if (!activeItemIds.has(String(itemId))) return result;

    const normalizedItem = normalizeCachedItem(item);
    if (normalizedItem) result[normalizedItem.id] = normalizedItem;
    return result;
  }, {});

  const normalizedSearches = searches
    .map((record) => ({
      ...record,
      itemIds: record.itemIds.filter((itemId) => items[itemId]),
    }))
    .filter((record) => record.itemIds.length > 0);

  return {
    updatedAt: store.updatedAt || null,
    retentionDays: env.searchHistoryRetentionDays,
    searches: normalizedSearches,
    items,
  };
}

function loadSearchStore() {
  const originalStore = readStoreFile();
  const store = pruneStore(originalStore);
  const originalSearchCount = Array.isArray(originalStore.searches) ? originalStore.searches.length : 0;
  const originalItemCount = Object.keys(originalStore.items || {}).length;

  if (store.searches.length !== originalSearchCount || Object.keys(store.items).length !== originalItemCount) {
    writeStoreFile({
      ...store,
      updatedAt: new Date().toISOString(),
    });
  }

  return store;
}

function buildSearchId(query) {
  const safeQuery = String(query || '')
    .trim()
    .replace(/\s+/g, '-')
    .replace(/[^\u4e00-\u9fa5a-zA-Z0-9_-]/g, '')
    .slice(0, 32);
  const timeKey = new Date().toISOString().replace(/[-:.TZ]/g, '').slice(0, 14);
  return `search-${timeKey}-${safeQuery || 'query'}`;
}

function normalizeHistoryQuery(query = '') {
  return String(query || '').trim().replace(/\s+/g, ' ');
}

function shouldSaveHistoryQuery(query = '') {
  return normalizeHistoryQuery(query).replace(/\s+/g, '').length >= HISTORY_QUERY_MIN_LENGTH;
}

function shouldReplaceRecentSearch(record = {}, nextRecord = {}) {
  if (!record || !nextRecord) return false;
  if (record.mode !== nextRecord.mode) return false;

  const previousQuery = normalizeHistoryQuery(record.query).toLowerCase();
  const nextQuery = normalizeHistoryQuery(nextRecord.query).toLowerCase();
  if (!previousQuery || !nextQuery) return false;
  if (previousQuery !== nextQuery && !nextQuery.startsWith(previousQuery)) return false;

  const previousTime = toDate(record.searchedAt).getTime();
  const nextTime = toDate(nextRecord.searchedAt).getTime();
  return Math.abs(nextTime - previousTime) <= RECENT_QUERY_REPLACE_MS;
}

function saveSearchResults(query, items = [], options = {}) {
  const store = pruneStore(readStoreFile());
  const searchedAt = new Date().toISOString();
  const normalizedItems = items.map((item) => normalizeCachedItem({ ...item, searchCachedAt: searchedAt })).filter(Boolean);
  const itemIds = normalizedItems.map((item) => item.id);
  const normalizedQuery = normalizeHistoryQuery(query);

  if (!shouldSaveHistoryQuery(normalizedQuery) || itemIds.length === 0) return store;

  const nextItems = {
    ...store.items,
  };

  for (const item of normalizedItems) {
    nextItems[item.id] = {
      ...(nextItems[item.id] || {}),
      ...item,
      interpretation: nextItems[item.id]?.interpretation || item.interpretation || '',
      interpretationStatus: nextItems[item.id]?.interpretationStatus || item.interpretationStatus || item.aiStatus || 'pending',
      aiStatus: nextItems[item.id]?.aiStatus || item.aiStatus || item.interpretationStatus || 'pending',
      analysisType: nextItems[item.id]?.analysisType || item.analysisType || '',
      signals: Array.isArray(nextItems[item.id]?.signals) && nextItems[item.id].signals.length ? nextItems[item.id].signals : item.signals,
    };
  }

  const searchRecord = normalizeSearchRecord({
    id: options.searchId || buildSearchId(normalizedQuery),
    query: normalizedQuery,
    mode: options.mode || 'online',
    searchedAt,
    itemIds,
  });

  const nextStore = pruneStore({
    updatedAt: searchedAt,
    retentionDays: env.searchHistoryRetentionDays,
    searches: searchRecord
      ? [searchRecord, ...store.searches.filter((record) => !shouldReplaceRecentSearch(record, searchRecord))]
      : store.searches,
    items: nextItems,
  });

  writeStoreFile(nextStore);
  return nextStore;
}

function findCachedSearchItemById(newsId) {
  const store = loadSearchStore();
  return store.items[String(newsId || '')] || null;
}

function updateCachedSearchItem(newsId, patch = {}) {
  const store = loadSearchStore();
  const item = store.items[String(newsId || '')];
  if (!item) return null;

  const normalizedItem = normalizeCachedItem({
    ...item,
    ...patch,
  });
  if (!normalizedItem) return null;

  const nextStore = {
    ...store,
    updatedAt: new Date().toISOString(),
    items: {
      ...store.items,
      [normalizedItem.id]: normalizedItem,
    },
  };

  writeStoreFile(nextStore);
  return normalizedItem;
}

function getHistoryBucket(searchedAt) {
  const todayKey = getDateKey();
  const yesterdayKey = getDateKey(subtractHours(new Date(), DAY_HOURS));
  const dateKey = getDateKey(searchedAt);

  if (dateKey === todayKey) return 'today';
  if (dateKey === yesterdayKey) return 'yesterday';
  return 'earlier';
}

function getSearchHistory(query = {}) {
  const bucket = query.bucket || 'today';
  const allowedBuckets = ['today', 'yesterday', 'earlier'];
  const selectedBucket = allowedBuckets.includes(bucket) ? bucket : 'today';
  const store = loadSearchStore();
  const seenItemIds = new Set();
  const items = [];

  for (const record of store.searches) {
    if (getHistoryBucket(record.searchedAt) !== selectedBucket) continue;

    for (const itemId of record.itemIds) {
      if (seenItemIds.has(itemId)) continue;
      const item = store.items[itemId];
      if (!item) continue;

      seenItemIds.add(itemId);
      items.push({
        ...item,
        searchQuery: record.query,
        searchedAt: record.searchedAt,
      });
    }
  }

  return {
    bucket: selectedBucket,
    retentionDays: env.searchHistoryRetentionDays,
    updatedAt: store.updatedAt,
    total: items.length,
    items,
  };
}

module.exports = {
  findCachedSearchItemById,
  getSearchHistory,
  loadSearchStore,
  saveSearchResults,
  updateCachedSearchItem,
};
