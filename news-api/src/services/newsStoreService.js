const fs = require('fs');
const path = require('path');
const env = require('../config/env');
const { CATEGORY_VALUES } = require('../constants/categories');
const { getDateKey } = require('../utils/dateUtils');
const { buildCounts } = require('./newsCleanService');

const STORE_FILE = path.join(env.storageDir, 'todayNews.json');

function ensureStorageDir() {
  if (!fs.existsSync(env.storageDir)) {
    fs.mkdirSync(env.storageDir, { recursive: true });
  }
}

function buildEmptyData(date = getDateKey()) {
  return {
    date,
    updatedAt: null,
    categories: CATEGORY_VALUES,
    counts: {
      total: 0,
      国内: 0,
      国际: 0,
      财经: 0,
      科技: 0,
    },
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

  writeStoreFile(buildEmptyData(todayKey));
  console.log(`[存储] 已清空 ${data.date} 的旧缓存`);
  return true;
}

function loadTodayData(todayKey = getDateKey()) {
  const data = readStoreFile();
  if (!data || data.date !== todayKey) return buildEmptyData(todayKey);

  return {
    ...buildEmptyData(todayKey),
    ...data,
    categories: CATEGORY_VALUES,
    counts: data.counts || buildCounts(data.items || []),
    items: Array.isArray(data.items) ? data.items : [],
  };
}

function saveTodayData(items, options = {}) {
  const todayKey = options.todayKey || getDateKey();
  const data = {
    date: todayKey,
    updatedAt: new Date().toISOString(),
    categories: CATEGORY_VALUES,
    counts: buildCounts(items),
    items,
  };

  writeStoreFile(data);
  console.log(`[存储] 已保存 ${items.length} 条当天新闻`);
  return data;
}

module.exports = {
  buildEmptyData,
  clearOutdatedData,
  loadTodayData,
  saveTodayData,
};
