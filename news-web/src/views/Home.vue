<script setup>
import { ArrowUp, LoaderCircle, RefreshCw } from 'lucide-vue-next';
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue';
import { useRouter } from 'vue-router';
import AppTopNav from '../components/AppTopNav.vue';
import NewsList from '../components/NewsList.vue';
import ToastMessage from '../components/ToastMessage.vue';
import { useNews } from '../composables/useNews';
import { useTheme } from '../composables/useTheme';

const AUTO_LOAD_BOTTOM_OFFSET = 280;
const BACK_TO_TOP_THRESHOLD_SCREENS = 2;

const {
  activeCategory,
  errorMessage,
  filteredNews,
  hasNextPage,
  isLoading,
  isLoadingMore,
  isRefreshing,
  newsData,
  stats,
  loadMore,
  loadNews,
  startPolling,
  triggerRefresh,
} = useNews();

const { isDarkMode, toggleTheme } = useTheme();
const router = useRouter();
const toastMessage = ref('');
const isCategoryPanelOpen = ref(false);
const showBackToTop = ref(false);
let toastTimer = null;
let isPageActive = false;
let scrollFrame = 0;

const hasNews = computed(() => {
  const items = newsData.value?.items || newsData.value?.news || [];
  const total = newsData.value?.counts?.total ?? items.length;
  return total > 0;
});
const loadMoreText = computed(() => {
  if (isLoadingMore.value) return '正在加载更多新闻';
  return '加载更多新闻';
});

function showToast(message) {
  toastMessage.value = message;
  window.clearTimeout(toastTimer);
  toastTimer = window.setTimeout(() => {
    toastMessage.value = '';
  }, 2600);
}

async function handleRefresh() {
  const success = await triggerRefresh();
  showToast(success ? '刷新任务已启动，数据已同步检查' : '刷新失败，请稍后重试');
}

async function handleLoadMore() {
  if (!hasNextPage.value) return;

  const success = await loadMore();
  if (!success) showToast(errorMessage.value || '加载更多失败');
}

function handleSearch() {
  router.push({ name: 'search' });
}

function scrollToTop() {
  window.scrollTo({
    top: 0,
    behavior: 'smooth',
  });
}

function getScrollDistanceToBottom() {
  const pageHeight = Math.max(document.documentElement.scrollHeight, document.body.scrollHeight);
  return pageHeight - (window.scrollY + window.innerHeight);
}

async function maybeAutoLoadMore() {
  if (!isPageActive) return;
  if (isLoading.value || isLoadingMore.value || !hasNextPage.value) return;
  if (getScrollDistanceToBottom() > AUTO_LOAD_BOTTOM_OFFSET) return;

  const success = await loadMore();
  if (success && isPageActive) window.requestAnimationFrame(() => maybeAutoLoadMore());
}

function updateScrollState() {
  showBackToTop.value = window.scrollY > window.innerHeight * BACK_TO_TOP_THRESHOLD_SCREENS;
  void maybeAutoLoadMore();
}

function handleWindowScroll() {
  if (scrollFrame) return;

  scrollFrame = window.requestAnimationFrame(() => {
    scrollFrame = 0;
    updateScrollState();
  });
}

function handleWindowResize() {
  updateScrollState();
}

onMounted(async () => {
  isPageActive = true;
  window.addEventListener('scroll', handleWindowScroll, { passive: true });
  window.addEventListener('resize', handleWindowResize);

  try {
    await loadNews();
    startPolling(() => showToast('简报已自动更新'));
  } catch (error) {
    showToast('暂时没有可用新闻数据');
  } finally {
    window.requestAnimationFrame(updateScrollState);
  }
});

onBeforeUnmount(() => {
  isPageActive = false;
  window.removeEventListener('scroll', handleWindowScroll);
  window.removeEventListener('resize', handleWindowResize);
  window.clearTimeout(toastTimer);

  if (scrollFrame) {
    window.cancelAnimationFrame(scrollFrame);
    scrollFrame = 0;
  }
});

</script>

<template>
  <main class="home-page">
    <section v-if="isLoading" class="loading-view">
      <LoaderCircle :size="30" />
      <span>正在整理今日简报</span>
    </section>

    <section v-else-if="!hasNews" class="error-view">
      <h2>新闻数据暂不可用</h2>
      <p>{{ errorMessage || '请稍后再试，或检查后端服务是否正在运行。' }}</p>
      <button class="icon-button primary" type="button" @click="handleRefresh">
        <RefreshCw :size="18" />
        <span>重新刷新</span>
      </button>
    </section>

    <template v-else>
      <section class="content-shell">
        <AppTopNav
          v-model:active-category="activeCategory"
          v-model:is-category-panel-open="isCategoryPanelOpen"
          :counts="stats"
          :is-dark-mode="isDarkMode"
          :is-refreshing="isRefreshing"
          show-categories
          @refresh="handleRefresh"
          @search="handleSearch"
          @toggle-theme="toggleTheme"
        />
        <NewsList :items="filteredNews" />
        <div v-if="filteredNews.length > 0" class="load-more-row" aria-live="polite">
          <button v-if="hasNextPage || isLoadingMore" class="load-more-button" type="button" :disabled="isLoadingMore" @click="handleLoadMore">
            <LoaderCircle v-if="isLoadingMore" class="spinning" :size="16" />
            <span>{{ loadMoreText }}</span>
          </button>
          <p v-else class="min-h-11 py-3 text-center text-xs font-semibold text-[#A4A9BC]">
            - 已加载近 24 小时全部新闻 -
          </p>
        </div>
      </section>
    </template>

    <div
      class="fixed bottom-[max(18px,env(safe-area-inset-bottom))] right-[max(16px,env(safe-area-inset-right))] z-[35] flex flex-col items-center gap-2 max-[420px]:bottom-[max(14px,env(safe-area-inset-bottom))] max-[420px]:right-3"
      aria-label="页面操作"
    >
      <button
        class="glass-icon-button"
        type="button"
        aria-label="回到顶部"
        title="回到顶部"
        :aria-hidden="!showBackToTop"
        :tabindex="showBackToTop ? 0 : -1"
        :class="showBackToTop ? 'pointer-events-auto opacity-100' : 'pointer-events-none opacity-0'"
        @click="scrollToTop"
      >
        <ArrowUp :size="19" />
        <span class="sr-only">回到顶部</span>
      </button>
    </div>

    <ToastMessage :message="toastMessage" />
  </main>
</template>
