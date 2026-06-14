import { computed, onBeforeUnmount, ref } from 'vue';
import { fetchNews, refreshNews } from '../api/newsApi';
import { CATEGORY_OPTIONS } from '../utils/categories';
import { loadNewsCache, saveNewsCache } from '../utils/storage';

const POLL_INTERVAL = 60 * 1000;

function getNewsTimestamp(item) {
  const dateText = item?.date || '';
  const timeText = item?.time || '';
  const normalizedTime = /^\d{1,2}:\d{2}$/.test(timeText) ? timeText : '00:00';
  const date = dateText ? new Date(`${dateText}T${normalizedTime}:00`) : new Date(timeText);
  const timestamp = date.getTime();

  return Number.isNaN(timestamp) ? 0 : timestamp;
}

function sortNewsByDateTime(newsItems) {
  return newsItems
    .map((item, index) => ({
      item,
      index,
      timestamp: getNewsTimestamp(item),
    }))
    .sort((current, next) => next.timestamp - current.timestamp || current.index - next.index)
    .map(({ item }) => item);
}

function buildStats(newsItems) {
  const stats = {
    total: newsItems.length,
    P0: newsItems.filter((item) => item.priority === 'P0').length,
    P1: newsItems.filter((item) => item.priority === 'P1').length,
    P2: newsItems.filter((item) => item.priority === 'P2').length,
  };

  CATEGORY_OPTIONS.filter((item) => item.value !== '全部').forEach((category) => {
    stats[category.value] = newsItems.filter((item) => item.category === category.value).length;
  });

  return stats;
}

export function useNews() {
  const newsData = ref(null);
  const activeCategory = ref('全部');
  const isLoading = ref(false);
  const isRefreshing = ref(false);
  const errorMessage = ref('');
  const cacheSource = ref('');
  const pollTimer = ref(null);

  const newsItems = computed(() => newsData.value?.news || []);

  const filteredNews = computed(() => {
    const items =
      activeCategory.value === '全部'
        ? newsItems.value
        : newsItems.value.filter((item) => item.category === activeCategory.value);

    return sortNewsByDateTime(items);
  });

  const stats = computed(() => buildStats(newsItems.value));

  const featuredNews = computed(() => newsItems.value.find((item) => item.priority === 'P0') || newsItems.value[0] || null);

  function setNewsData(data, source = '') {
    newsData.value = data;
    cacheSource.value = source;
    if (data?.news?.length) saveNewsCache(data);
  }

  async function loadNews({ silent = false } = {}) {
    if (!silent) isLoading.value = true;
    errorMessage.value = '';

    try {
      const data = await fetchNews();
      if (data?.news?.length) {
        setNewsData(data);
        return data;
      }
      throw new Error('新闻数据为空');
    } catch (error) {
      const cached = loadNewsCache();
      if (cached?.news?.length) {
        setNewsData(cached, '缓存数据');
        return cached;
      }

      errorMessage.value = error.message || '新闻加载失败';
      throw error;
    } finally {
      if (!silent) isLoading.value = false;
    }
  }

  async function triggerRefresh() {
    isRefreshing.value = true;
    errorMessage.value = '';

    try {
      await refreshNews();
      await new Promise((resolve) => setTimeout(resolve, 1200));
      await loadNews({ silent: true });
      return true;
    } catch (error) {
      errorMessage.value = error.message || '刷新失败';
      return false;
    } finally {
      isRefreshing.value = false;
    }
  }

  async function checkUpdates() {
    try {
      const latest = await fetchNews();
      if (!latest?.news?.length) return false;

      if (!newsData.value || latest.updatedAt !== newsData.value.updatedAt) {
        setNewsData(latest);
        return true;
      }

      return false;
    } catch (error) {
      return false;
    }
  }

  function startPolling(onUpdated) {
    stopPolling();
    pollTimer.value = window.setInterval(async () => {
      const updated = await checkUpdates();
      if (updated) onUpdated?.();
    }, POLL_INTERVAL);

    document.addEventListener('visibilitychange', handleVisibilityChange);
  }

  async function handleVisibilityChange() {
    if (document.hidden) return;
    await checkUpdates();
  }

  function stopPolling() {
    if (pollTimer.value) {
      window.clearInterval(pollTimer.value);
      pollTimer.value = null;
    }
    document.removeEventListener('visibilitychange', handleVisibilityChange);
  }

  onBeforeUnmount(stopPolling);

  return {
    activeCategory,
    cacheSource,
    errorMessage,
    featuredNews,
    filteredNews,
    isLoading,
    isRefreshing,
    newsData,
    stats,
    loadNews,
    startPolling,
    triggerRefresh,
  };
}
