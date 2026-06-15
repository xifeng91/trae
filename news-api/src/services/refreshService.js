const env = require('../config/env');
const { ALL_CATEGORY } = require('../constants/categories');
const { addMinutes, getDateKey, getDateTimeText, toDate } = require('../utils/dateUtils');
const { fetchAllNews } = require('./newsFetchService');
const { cleanNewsItems } = require('./newsCleanService');
const { enrichNewsItems } = require('./aiNewsService');
const { clearOutdatedData, loadTodayData, saveTodayData } = require('./newsStoreService');

let runningPromise = null;

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
  const { rawSummary, ...publicItem } = item;
  return publicItem;
}

async function executeRefresh(options = {}) {
  const todayKey = getDateKey();
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
    clearOutdatedData(todayKey);
    const previousData = loadTodayData(todayKey);
    const rawItems = await fetchAllNews();
    const cleanItems = cleanNewsItems(rawItems, {
      todayKey,
      maxPerCategory: env.maxNewsPerCategory,
    });

    if (cleanItems.length === 0) {
      refreshState.message = previousData.items.length > 0 ? '本轮未获取到新新闻，继续使用当前缓存' : '本轮未获取到当天新闻';
      const fallbackData = previousData.items.length > 0 ? previousData : saveTodayData([], { todayKey });
      refreshState.status = 'idle';
      refreshState.finishedAt = new Date().toISOString();
      refreshState.lastRunAt = fallbackData.updatedAt || refreshState.finishedAt;
      updateNextRunAt(refreshState.lastRunAt);
      console.warn(`[刷新] ${refreshState.message}`);
      return fallbackData;
    }

    const enrichedItems = await enrichNewsItems(cleanItems, {
      existingItems: previousData.items,
    });
    const savedData = saveTodayData(enrichedItems, { todayKey });

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
    return loadTodayData(todayKey);
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
  const filteredItems =
    category === ALL_CATEGORY ? data.items : data.items.filter((item) => item.category === category);
  const startIndex = (page - 1) * pageSize;
  const items = filteredItems.slice(startIndex, startIndex + pageSize).map(sanitizeNewsItem);

  return {
    date: data.date,
    updatedAt: data.updatedAt,
    isRefreshing: refreshState.status === 'running',
    categories: data.categories,
    counts: data.counts,
    pagination: {
      page,
      pageSize,
      total: filteredItems.length,
    },
    items,
    message: data.items.length === 0 ? '当天新闻正在准备中' : '',
  };
}

module.exports = {
  getNewsPage,
  getRefreshStatus,
  triggerRefresh,
  triggerRefreshIfNeeded,
};
