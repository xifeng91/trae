<script setup>
import { LoaderCircle, Moon, RefreshCw, Sun } from 'lucide-vue-next';
import { computed, onMounted, ref, watch } from 'vue';
import CategoryTabs from '../components/CategoryTabs.vue';
import NewsList from '../components/NewsList.vue';
import ToastMessage from '../components/ToastMessage.vue';
import { useNews } from '../composables/useNews';
import { loadThemePreference, saveThemePreference } from '../utils/storage';

const {
  activeCategory,
  errorMessage,
  filteredNews,
  isLoading,
  isRefreshing,
  newsData,
  stats,
  loadNews,
  startPolling,
  triggerRefresh,
} = useNews();

const toastMessage = ref('');
const isDarkMode = ref(resolveInitialTheme());
let toastTimer = null;

const hasNews = computed(() => Boolean(newsData.value?.news?.length));

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

function toggleTheme() {
  isDarkMode.value = !isDarkMode.value;
}

function resolveInitialTheme() {
  const savedTheme = loadThemePreference();
  if (savedTheme === 'dark' || savedTheme === 'light') return savedTheme === 'dark';

  return Boolean(window.matchMedia?.('(prefers-color-scheme: dark)').matches);
}

onMounted(async () => {
  try {
    await loadNews();
    startPolling(() => showToast('简报已自动更新'));
  } catch (error) {
    showToast('暂时没有可用新闻数据');
  }
});

watch(
  isDarkMode,
  (value) => {
    document.documentElement.classList.toggle('dark', value);
    saveThemePreference(value ? 'dark' : 'light');
  },
  { immediate: true },
);
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
        <header class="home-hero" aria-labelledby="home-title">
          <h1 id="home-title">西风简报</h1>
        </header>
        <CategoryTabs v-model="activeCategory" :counts="stats" />
        <NewsList :items="filteredNews" />
      </section>
    </template>

    <div
      class="fixed bottom-[max(18px,env(safe-area-inset-bottom))] right-[max(16px,env(safe-area-inset-right))] z-[35] inline-grid gap-1 rounded-full bg-white/72 p-1 shadow-[0_14px_36px_rgba(15,23,42,0.18)] backdrop-blur-[8px] dark:bg-[#1e1e1e]/68 dark:shadow-[0_18px_42px_rgba(0,0,0,0.34)] max-[420px]:bottom-[max(14px,env(safe-area-inset-bottom))] max-[420px]:right-3"
      aria-label="页面操作"
    >
      <button
        class="inline-flex min-h-11 min-w-11 items-center justify-center rounded-full bg-transparent p-0 text-[var(--accent)] transition duration-200 hover:bg-[var(--accent-soft)] hover:text-[var(--accent-strong)] focus-visible:bg-[var(--accent-soft)] focus-visible:text-[var(--accent-strong)] focus-visible:outline-none active:translate-y-px"
        type="button"
        :disabled="isRefreshing"
        :aria-label="isRefreshing ? '正在刷新新闻' : '刷新新闻'"
        :title="isRefreshing ? '正在刷新' : '刷新'"
        @click="handleRefresh"
      >
        <RefreshCw :size="18" :class="{ spinning: isRefreshing }" />
        <span class="sr-only">{{ isRefreshing ? '刷新中' : '刷新' }}</span>
      </button>
      <button
        class="inline-flex min-h-11 min-w-11 items-center justify-center rounded-full bg-transparent p-0 text-[var(--accent)] transition duration-200 hover:bg-[var(--accent-soft)] hover:text-[var(--accent-strong)] focus-visible:bg-[var(--accent-soft)] focus-visible:text-[var(--accent-strong)] focus-visible:outline-none active:translate-y-px"
        type="button"
        :aria-label="isDarkMode ? '切换为亮色主题' : '切换为暗色主题'"
        :title="isDarkMode ? '亮色主题' : '暗色主题'"
        @click="toggleTheme"
      >
        <Sun v-if="isDarkMode" :size="19" />
        <Moon v-else :size="19" />
        <span class="sr-only">{{ isDarkMode ? '亮色主题' : '暗色主题' }}</span>
      </button>
    </div>

    <ToastMessage :message="toastMessage" />
  </main>
</template>
