const fs = require('fs');
const path = require('path');
const env = require('../config/env');
const { CATEGORY_VALUES } = require('../constants/categories');
const { getDateKey, subtractHours, toDate } = require('../utils/dateUtils');
const { buildCounts } = require('./newsCleanService');
const { limitText } = require('../utils/textUtils');

const STORE_FILE = path.join(env.storageDir, 'todayNews.json');

function ensureStorageDir() {
  if (!fs.existsSync(env.storageDir)) {
    fs.mkdirSync(env.storageDir, { recursive: true });
  }
}

function buildEmptyData(options = {}) {
  const now = toDate(options.now || new Date());
  const retentionHours = options.retentionHours || env.newsRetentionHours;

  return {
    date: getDateKey(now),
    updatedAt: null,
    retentionHours,
    windowStartAt: subtractHours(now, retentionHours).toISOString(),
    windowEndAt: now.toISOString(),
    categories: CATEGORY_VALUES,
    counts: buildCounts([]),
    items: [],
  };
}

function readStoreFile() {
  ensureStorageDir();
  if (!fs.existsSync(STORE_FILE)) return null;

  try {
    const rawText = fs.readFileSync(STORE_FILE, 'utf-8');
    return JSON.parse(rawText);
  } catch (error) {
    console.warn(`[存储] 读取缓存失败: ${error.message}`);
    return null;
  }
}

function writeStoreFile(data) {
  ensureStorageDir();
  const tempFile = `${STORE_FILE}.tmp`;
  fs.writeFileSync(tempFile, JSON.stringify(data, null, 2), 'utf-8');
  fs.renameSync(tempFile, STORE_FILE);
}

function clearOutdatedData(todayKey = getDateKey()) {
  const data = readStoreFile();
  if (!data || data.date === todayKey) return false;

  writeStoreFile(buildEmptyData());
  console.log(`[存储] 已清空 ${data.date} 的旧缓存`);
  return true;
}

function normalizeStoredItem(item = {}) {
  const storedStatus = item.interpretationStatus || item.aiStatus || 'pending';
  const isSuccessfulInterpretation = storedStatus === 'success' && item.interpretation;
  const interpretation = isSuccessfulInterpretation ? String(item.interpretation || '').trim() : '';
  const interpretationStatus = interpretation ? 'success' : 'pending';
  const publishedAt = new Date(item.publishedAt);

  if (Number.isNaN(publishedAt.getTime())) return null;

  return {
    id: item.id,
    title: item.title,
    category: item.category,
    topics: Array.isArray(item.topics) ? item.topics : [],
    overview: limitText(item.overview || item.summary || item.shortSummary || item.rawSummary || item.title, 300),
    interpretation,
    interpretationStatus,
    analysisType: item.analysisType || '',
    signals: Array.isArray(item.signals) ? item.signals : [],
    source: item.source,
    sourceUrl: item.sourceUrl || '',
    imageUrl: item.imageUrl || '',
    imageAlt: item.imageAlt || item.title || '',
    publishedAt: publishedAt.toISOString(),
    priority: item.priority || 'P2',
    aiStatus: interpretationStatus,
    date: item.date || getDateKey(item.publishedAt),
    time: item.time || '',
    rawSummary: limitText(item.rawSummary || item.overview || item.summary || item.title, 600),
  };
}

function isInsideRetentionWindow(item, options = {}) {
  if (!item) return false;

  const now = toDate(options.now || new Date());
  const retentionHours = options.retentionHours || env.newsRetentionHours;
  const windowStart = subtractHours(now, retentionHours);
  const publishedAt = new Date(item.publishedAt);
  if (Number.isNaN(publishedAt.getTime())) return false;

  return publishedAt >= windowStart && publishedAt <= now;
}

function pruneItems(items = [], options = {}) {
  return items
    .map(normalizeStoredItem)
    .filter((item) => item?.id && CATEGORY_VALUES.includes(item.category) && isInsideRetentionWindow(item, options));
}

function buildData(items, options = {}) {
  const now = toDate(options.now || new Date());
  const retentionHours = options.retentionHours || env.newsRetentionHours;
  const normalizedItems = pruneItems(items, { now, retentionHours });

  return {
    ...buildEmptyData({ now, retentionHours }),
    updatedAt: options.updatedAt || null,
    counts: buildCounts(normalizedItems),
    items: normalizedItems,
  };
}

function loadTodayData() {
  const data = readStoreFile();
  if (!data) return buildEmptyData();

  const now = new Date();
  const items = pruneItems(Array.isArray(data.items) ? data.items : [], { now });
  const normalizedData = {
    ...buildEmptyData({ now }),
    ...data,
    date: getDateKey(now),
    retentionHours: env.newsRetentionHours,
    windowStartAt: subtractHours(now, env.newsRetentionHours).toISOString(),
    windowEndAt: now.toISOString(),
    categories: CATEGORY_VALUES,
    counts: data.counts || buildCounts(items),
    items,
  };

  normalizedData.counts = buildCounts(items);

  if (items.length !== (Array.isArray(data.items) ? data.items.length : 0) || data.retentionHours !== env.newsRetentionHours) {
    writeStoreFile(normalizedData);
  }

  return normalizedData;
}

function saveTodayData(items, options = {}) {
  const now = toDate(options.now || new Date());
  const data = buildData(items, {
    now,
    retentionHours: env.newsRetentionHours,
    updatedAt: new Date().toISOString(),
  });

  writeStoreFile(data);
  console.log(`[存储] 已保存 ${data.items.length} 条过去 ${env.newsRetentionHours} 小时新闻`);
  return data;
}

function findNewsItemById(newsId) {
  const data = loadTodayData();
  return data.items.find((item) => item.id === newsId) || null;
}

function updateNewsItem(newsId, patch = {}) {
  const data = loadTodayData();
  const itemIndex = data.items.findIndex((item) => item.id === newsId);

  if (itemIndex === -1) return null;

  const nextItems = data.items.map((item, index) =>
    index === itemIndex
      ? normalizeStoredItem({
          ...item,
          ...patch,
        })
      : item,
  );

  saveTodayData(nextItems);
  return nextItems[itemIndex];
}

module.exports = {
  buildEmptyData,
  clearOutdatedData,
  findNewsItemById,
  loadTodayData,
  saveTodayData,
  updateNewsItem,
};
