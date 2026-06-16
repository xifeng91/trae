const env = require('../config/env');
const { ALL_CATEGORY, INVESTMENT_TOPIC } = require('../constants/categories');
const { addMinutes, getDateTimeText, toDate } = require('../utils/dateUtils');
const { fetchAllNews } = require('./newsFetchService');
const { cleanNewsItems } = require('./newsCleanService');
const { findNewsItemById, loadTodayData, saveTodayData, updateNewsItem } = require('./newsStoreService');
const { findCachedSearchItemById, updateCachedSearchItem } = require('./searchCacheService');
const { streamAiInterpretation } = require('./aiNewsService');

let runningPromise = null;
const interpretationPromises = new Map();

const refreshState = {
  status: 'idle',
  taskId: null,
  startedAt: null,
  finishedAt: null,
  lastRunAt: null,
  nextRunAt: null,
  lastError: null,
  message: '尚未执行刷新任务',
};

function buildTaskId() {
  return `refresh-${new Date().toISOString().replace(/[-:.TZ]/g, '').slice(0, 14)}`;
}

function updateNextRunAt(baseTime = new Date()) {
  refreshState.nextRunAt = addMinutes(baseTime, env.readRefreshMaxAgeMinutes).toISOString();
}

function getRefreshStatus() {
  return { ...refreshState };
}

function canRunManualRefresh() {
  if (!refreshState.lastRunAt) return true;

  const elapsed = Date.now() - toDate(refreshState.lastRunAt).getTime();
  const cooldown = env.manualRefreshCooldownMinutes * 60 * 1000;
  return elapsed >= cooldown;
}

function isCacheStale(data) {
  if (!data.updatedAt) return true;

  const elapsed = Date.now() - toDate(data.updatedAt).getTime();
  return elapsed > env.readRefreshMaxAgeMinutes * 60 * 1000;
}

function sanitizeNewsItem(item) {
  const { rawSummary, interpretation, aiStatus, analysisType, signals, ...publicItem } = item;

  return {
    ...publicItem,
    interpretationStatus: item.interpretation ? 'success' : item.interpretationStatus || item.aiStatus || 'pending',
  };
}

function findNewsItemAcrossStores(newsId) {
  const localItem = findNewsItemById(newsId);
  if (localItem) {
    return {
      item: localItem,
      store: 'local',
    };
  }

  const cachedSearchItem = findCachedSearchItemById(newsId);
  if (cachedSearchItem) {
    return {
      item: cachedSearchItem,
      store: 'search',
    };
  }

  return null;
}

function updateNewsItemAcrossStores(newsId, patch = {}, store = 'local') {
  if (store === 'search') return updateCachedSearchItem(newsId, patch);
  return updateNewsItem(newsId, patch);
}

function isReusableInterpretation(item = {}) {
  return Boolean(item.interpretation) && (item.interpretationStatus === 'success' || item.aiStatus === 'success');
}

function buildExistingItemMap(existingItems = []) {
  const itemMap = new Map();

  for (const item of existingItems) {
    if (item.sourceUrl) itemMap.set(`url:${item.sourceUrl}`, item);
    itemMap.set(`title:${item.title}`, item);
  }

  return itemMap;
}

function mergeExistingInterpretations(newsItems, existingItems = []) {
  const existingItemMap = buildExistingItemMap(existingItems);

  return newsItems.map((item) => {
    const existingItem = existingItemMap.get(`url:${item.sourceUrl}`) || existingItemMap.get(`title:${item.title}`);
    if (!isReusableInterpretation(existingItem)) return item;

    return {
      ...item,
      interpretation: existingItem.interpretation,
      interpretationStatus: existingItem.interpretationStatus || existingItem.aiStatus || 'success',
      aiStatus: existingItem.aiStatus || existingItem.interpretationStatus || 'success',
      analysisType: existingItem.analysisType || '',
      signals: Array.isArray(existingItem.signals) ? existingItem.signals : [],
    };
  });
}

async function executeRefresh(options = {}) {
  const taskId = buildTaskId();

  refreshState.status = 'running';
  refreshState.taskId = taskId;
  refreshState.startedAt = new Date().toISOString();
  refreshState.finishedAt = null;
  refreshState.lastError = null;
  refreshState.message = options.reason === 'manual' ? '手动刷新执行中' : '自动刷新执行中';

  console.log('\n' + '='.repeat(56));
  console.log(`[刷新] ${taskId} 开始，原因：${options.reason || 'schedule'}，时间：${getDateTimeText()}`);
  console.log('='.repeat(56));

  try {
    const previousData = loadTodayData();
    const rawItems = await fetchAllNews();
    const cleanItems = cleanNewsItems(rawItems, {
      maxPerCategory: env.maxNewsPerCategory,
      retentionHours: env.newsRetentionHours,
    });

    if (cleanItems.length === 0) {
      refreshState.message = previousData.items.length > 0 ? '本轮未获取到新新闻，继续使用当前缓存' : '本轮未获取到近 24 小时新闻';
      const fallbackData = previousData.items.length > 0 ? previousData : saveTodayData([]);
      refreshState.status = 'idle';
      refreshState.finishedAt = new Date().toISOString();
      refreshState.lastRunAt = fallbackData.updatedAt || refreshState.finishedAt;
      updateNextRunAt(refreshState.lastRunAt);
      console.warn(`[刷新] ${refreshState.message}`);
      return fallbackData;
    }

    const savedData = saveTodayData(mergeExistingInterpretations(cleanItems, previousData.items));

    refreshState.status = 'idle';
    refreshState.lastRunAt = savedData.updatedAt;
    refreshState.finishedAt = new Date().toISOString();
    refreshState.message = `刷新完成，共 ${savedData.items.length} 条新闻`;
    updateNextRunAt(savedData.updatedAt);

    console.log(`[刷新] ${refreshState.message}`);
    return savedData;
  } catch (error) {
    refreshState.status = 'idle';
    refreshState.finishedAt = new Date().toISOString();
    refreshState.lastError = error.message;
    refreshState.message = '刷新失败，继续使用旧缓存';
    console.error(`[刷新] 失败: ${error.stack || error.message}`);
    return loadTodayData();
  } finally {
    runningPromise = null;
  }
}

function triggerRefresh(options = {}) {
  if (runningPromise) {
    return {
      started: false,
      status: getRefreshStatus(),
      message: '刷新任务正在执行',
    };
  }

  if (options.reason === 'manual' && !options.force && !canRunManualRefresh()) {
    return {
      started: false,
      status: getRefreshStatus(),
      message: `刷新过于频繁，请 ${env.manualRefreshCooldownMinutes} 分钟后再试`,
    };
  }

  runningPromise = executeRefresh(options);
  runningPromise.catch(() => {});

  return {
    started: true,
    status: getRefreshStatus(),
    message: '刷新任务已启动',
  };
}

function triggerRefreshIfNeeded(reason = 'read') {
  const data = loadTodayData();
  if (isCacheStale(data)) {
    return triggerRefresh({ reason });
  }

  return {
    started: false,
    status: getRefreshStatus(),
    message: '缓存仍然有效',
  };
}

function getNewsPage(query = {}) {
  const data = loadTodayData();
  const category = query.category || ALL_CATEGORY;
  const page = Math.max(Number(query.page) || 1, 1);
  const pageSize = Math.min(Math.max(Number(query.pageSize) || env.newsPageSize, 1), env.maxNewsPerCategory);
  const filteredItems = data.items.filter((item) => {
    if (category === ALL_CATEGORY) return true;
    if (category === INVESTMENT_TOPIC) return Array.isArray(item.topics) && item.topics.includes(INVESTMENT_TOPIC);

    return item.category === category;
  });
  const startIndex = (page - 1) * pageSize;
  const items = filteredItems.slice(startIndex, startIndex + pageSize).map(sanitizeNewsItem);

  return {
    date: data.date,
    updatedAt: data.updatedAt,
    retentionHours: data.retentionHours,
    windowStartAt: data.windowStartAt,
    windowEndAt: data.windowEndAt,
    isRefreshing: refreshState.status === 'running',
    categories: data.categories,
    counts: data.counts,
    pagination: {
      page,
      pageSize,
      total: filteredItems.length,
    },
    items,
    message: data.items.length === 0 ? '近 24 小时新闻正在准备中' : '',
  };
}

function getNewsDetail(newsId) {
  const found = findNewsItemAcrossStores(newsId);
  if (!found) return null;

  return {
    ...sanitizeNewsItem(found.item),
    origin: found.item.origin || (found.store === 'search' ? 'web' : 'local'),
    originLabel: found.item.originLabel || (found.store === 'search' ? '联网补充' : '本地已收录'),
  };
}

function getCachedInterpretation(newsId, options = {}) {
  const found = findNewsItemAcrossStores(newsId);
  if (!found) return null;
  if (!isReusableInterpretation(found.item) || options.force) return {
    item: found.item,
    store: found.store,
    cached: false,
  };

  return {
    item: found.item,
    store: found.store,
    cached: true,
    result: {
      interpretation: found.item.interpretation,
      interpretationStatus: found.item.interpretationStatus || found.item.aiStatus || 'success',
      aiStatus: found.item.aiStatus || found.item.interpretationStatus || 'success',
      analysisType: found.item.analysisType || '',
      signals: found.item.signals || [],
    },
  };
}

async function streamNewsInterpretation(newsId, handlers = {}, options = {}) {
  const cached = getCachedInterpretation(newsId, options);
  if (!cached) {
    const error = new Error('新闻不存在或已过期');
    error.status = 404;
    throw error;
  }

  if (cached.cached) {
    handlers.onMeta?.({
      status: 'cached',
      analysisType: cached.result.analysisType,
      signals: cached.result.signals,
    });
    handlers.onDelta?.(cached.result.interpretation);
    handlers.onDone?.(cached.result);
    return cached.result;
  }

  if (interpretationPromises.has(newsId)) {
    const error = new Error('这条新闻正在生成解读，请稍后重试');
    error.status = 409;
    throw error;
  }

  updateNewsItemAcrossStores(
    newsId,
    {
      interpretationStatus: 'generating',
      aiStatus: 'generating',
    },
    cached.store,
  );

  handlers.onMeta?.({
    status: 'generating',
  });

  const promise = streamAiInterpretation(cached.item, {
    onDelta: handlers.onDelta,
  });
  interpretationPromises.set(newsId, promise);

  try {
    const result = await promise;
    if (result.interpretationStatus === 'success' || result.aiStatus === 'success') {
      updateNewsItemAcrossStores(newsId, result, cached.store);
    } else {
      updateNewsItemAcrossStores(
        newsId,
        {
          interpretation: '',
          interpretationStatus: 'pending',
          aiStatus: 'pending',
          analysisType: result.analysisType || '',
          signals: result.signals || [],
        },
        cached.store,
      );
    }
    handlers.onDone?.(result);
    return result;
  } finally {
    interpretationPromises.delete(newsId);
  }
}

module.exports = {
  getNewsDetail,
  getNewsPage,
  getRefreshStatus,
  streamNewsInterpretation,
  triggerRefresh,
  triggerRefreshIfNeeded,
};
