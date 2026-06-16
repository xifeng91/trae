import { computed, onBeforeUnmount, ref, watch } from 'vue';
import { fetchNews, refreshNews } from '../api/newsApi';
import { CATEGORY_OPTIONS } from '../utils/categories';
import { DEFAULT_NEWS_PAGE_SIZE, normalizeNewsResponse, sortNewsByDateTime } from '../utils/newsData';
import { loadNewsCache, saveNewsCache } from '../utils/storage';

const POLL_INTERVAL = 60 * 1000;
const PAGE_SIZE = DEFAULT_NEWS_PAGE_SIZE;

function buildStats(newsItems) {
  const stats = {
    total: newsItems.length,
    P0: newsItems.filter((item) => item.priority === 'P0').length,
    P1: newsItems.filter((item) => item.priority === 'P1').length,
    P2: newsItems.filter((item) => item.priority === 'P2').length,
  };

  CATEGORY_OPTIONS.filter((item) => item.value !== '全部').forEach((category) => {
    stats[category.value] = newsItems.filter((item) => item.category === category.value || item.topics?.includes(category.value)).length;
  });

  return stats;
}

export function useNews() {
  const newsData = ref(null);
  const activeCategory = ref('全部');
  const isLoading = ref(false);
  const isLoadingMore = ref(false);
  const isRefreshing = ref(false);
  const errorMessage = ref('');
  const cacheSource = ref('');
  const pollTimer = ref(null);
  const currentPage = ref(1);
  const pagination = ref({
    page: 1,
    pageSize: PAGE_SIZE,
    total: 0,
  });

  const newsItems = computed(() => newsData.value?.items || []);
  const filteredNews = computed(() => sortNewsByDateTime(newsItems.value));
  const stats = computed(() => newsData.value?.counts || buildStats(newsItems.value));
  const featuredNews = computed(() => newsItems.value.find((item) => item.priority === 'P0') || newsItems.value[0] || null);
  const hasNextPage = computed(() => {
    const total = pagination.value.total || 0;
    return currentPage.value * pagination.value.pageSize < total;
  });

  function setNewsData(data, source = '', { append = false } = {}) {
    const normalizedData = normalizeNewsResponse(data);

    if (append && newsData.value?.items?.length) {
      normalizedData.items = [...newsData.value.items, ...normalizedData.items];
    }

    newsData.value = normalizedData;
    pagination.value = normalizedData.pagination;
    currentPage.value = normalizedData.pagination.page || 1;
    cacheSource.value = source;

    if (normalizedData.items.length) saveNewsCache(normalizedData);
  }

  async function loadNews({ silent = false, page = 1, append = false } = {}) {
    if (!silent) isLoading.value = true;
    errorMessage.value = '';

    try {
      const data = await fetchNews({
        category: activeCategory.value,
        page,
        pageSize: PAGE_SIZE,
      });
      const normalizedData = normalizeNewsResponse(data);

      setNewsData(normalizedData, '', { append });

      const total = normalizedData.counts?.total ?? normalizedData.pagination.total;
      if (!normalizedData.items.length && (normalizedData.isRefreshing || total === 0)) {
        errorMessage.value = normalizedData.message || '新闻正在生成，请稍后刷新';
      }

      return normalizedData;
    } catch (error) {
      if (append) {
        errorMessage.value = error.message || '加载更多失败';
        throw error;
      }

      const cached = normalizeNewsResponse(loadNewsCache());
      if (cached.items.length) {
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
      await loadNews({ silent: true, page: 1 });
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
      const latest = await fetchNews({
        category: activeCategory.value,
        page: 1,
        pageSize: PAGE_SIZE,
      });
      const normalizedLatest = normalizeNewsResponse(latest);
      if (!normalizedLatest.items.length) return false;

      if (!newsData.value || normalizedLatest.updatedAt !== newsData.value.updatedAt) {
        setNewsData(normalizedLatest);
        return true;
      }

      return false;
    } catch (error) {
      return false;
    }
  }

  async function loadMore() {
    if (!hasNextPage.value || isLoadingMore.value) return false;

    isLoadingMore.value = true;

    try {
      await loadNews({
        silent: true,
        page: currentPage.value + 1,
        append: true,
      });
      return true;
    } catch (error) {
      errorMessage.value = error.message || '加载更多失败';
      return false;
    } finally {
      isLoadingMore.value = false;
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

  watch(activeCategory, () => {
    currentPage.value = 1;
    loadNews({ page: 1 }).catch(() => {});
  });

  return {
    activeCategory,
    cacheSource,
    errorMessage,
    featuredNews,
    filteredNews,
    hasNextPage,
    isLoading,
    isLoadingMore,
    isRefreshing,
    newsData,
    pagination,
    stats,
    loadMore,
    loadNews,
    startPolling,
    triggerRefresh,
  };
}
