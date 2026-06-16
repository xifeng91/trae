<script setup>
import { ArrowLeft, Clock3, Globe2, LoaderCircle, Monitor, Moon, Search, Sun, X } from 'lucide-vue-next';
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { fetchLocalSearch, fetchOnlineSearch } from '../api/newsApi';
import SearchResultCard from '../components/SearchResultCard.vue';
import ToastMessage from '../components/ToastMessage.vue';
import { useTheme } from '../composables/useTheme';

const SEARCH_DEBOUNCE_MS = 220;
const SEARCH_PAGE_SIZE = 24;
const ONLINE_SEARCH_LIMIT = 20;

const route = useRoute();
const router = useRouter();
const { isDarkMode, toggleTheme } = useTheme();
const searchInput = ref(null);
const searchText = ref(getRouteSearchText());
const activeMode = ref(getRouteMode());
const resultData = ref(null);
const isSearching = ref(false);
const hasSearched = ref(false);
const errorMessage = ref('');
const toastMessage = ref('');
let searchTimer = null;
let toastTimer = null;

const normalizedSearchText = computed(() => searchText.value.trim());
const results = computed(() => resultData.value?.items || []);
const resultTotal = computed(() => resultData.value?.pagination?.total || 0);
const isOnlineMode = computed(() => activeMode.value === 'online');
const nextModeLabel = computed(() => (isOnlineMode.value ? '本地搜索' : '联网搜索'));
const searchPlaceholder = computed(() => (isOnlineMode.value ? '联网搜索新闻关键词' : '搜索标题和内容'));
const statusText = computed(() => {
  if (isSearching.value) return '正在搜索';
  if (errorMessage.value) return errorMessage.value;
  if (hasSearched.value && results.value.length > 0) return `找到 ${resultTotal.value || results.value.length} 条相关新闻`;
  return '';
});
const emptyText = computed(() => {
  if (hasSearched.value && results.value.length === 0) return '没有匹配内容';
  return isOnlineMode.value ? '搜索联网新闻' : '搜索今日简报';
});

function getRouteSearchText() {
  return typeof route.query.q === 'string' ? route.query.q : '';
}

function getRouteMode() {
  return route.query.mode === 'online' ? 'online' : 'local';
}

function replaceRouteQuery() {
  const nextQuery = {};
  if (normalizedSearchText.value) nextQuery.q = normalizedSearchText.value;
  if (activeMode.value !== 'local') nextQuery.mode = activeMode.value;

  const currentText = getRouteSearchText();
  const currentMode = getRouteMode();
  if (currentText === (nextQuery.q || '') && currentMode === (nextQuery.mode || 'local')) return;

  router.replace({
    name: 'search',
    query: nextQuery,
  }).catch(() => {});
}

function resetResults() {
  resultData.value = null;
  hasSearched.value = false;
  errorMessage.value = '';
}

async function runSearch() {
  window.clearTimeout(searchTimer);
  replaceRouteQuery();

  if (!normalizedSearchText.value) {
    resetResults();
    return;
  }

  isSearching.value = true;
  hasSearched.value = true;
  errorMessage.value = '';

  try {
    resultData.value = isOnlineMode.value
      ? await fetchOnlineSearch({
          q: normalizedSearchText.value,
          limit: ONLINE_SEARCH_LIMIT,
        })
      : await fetchLocalSearch({
          q: normalizedSearchText.value,
          page: 1,
          pageSize: SEARCH_PAGE_SIZE,
        });
  } catch (error) {
    resultData.value = null;
    errorMessage.value = error.message || '搜索失败，请稍后重试';
  } finally {
    isSearching.value = false;
  }
}

function scheduleSearch() {
  window.clearTimeout(searchTimer);
  searchTimer = window.setTimeout(() => {
    runSearch();
  }, SEARCH_DEBOUNCE_MS);
}

function clearSearch() {
  searchText.value = '';
  resetResults();
  replaceRouteQuery();
  searchInput.value?.focus();
}

function toggleSearchMode() {
  const nextMode = isOnlineMode.value ? 'local' : 'online';
  activeMode.value = nextMode;
  toastMessage.value = `已切换至${nextMode === 'online' ? '联网' : '本地'}搜索`;
  window.clearTimeout(toastTimer);
  toastTimer = window.setTimeout(() => {
    toastMessage.value = '';
  }, 2200);
}

function openHistory() {
  router.push({ name: 'search-history' });
}

function goBack() {
  if (window.history.length > 1) {
    router.back();
    return;
  }

  router.push({ name: 'home' });
}

watch(searchText, () => {
  scheduleSearch();
});

watch(activeMode, () => {
  resetResults();
  runSearch();
});

onMounted(() => {
  searchInput.value?.focus();
  if (normalizedSearchText.value) runSearch();
});

onBeforeUnmount(() => {
  window.clearTimeout(searchTimer);
  window.clearTimeout(toastTimer);
});
</script>

<template>
  <main class="home-page">
    <header class="app-top-nav">
      <form class="app-top-bar glass-panel" role="search" @submit.prevent="runSearch">
        <button class="nav-icon-button" type="button" aria-label="返回" title="返回" @click="goBack">
          <ArrowLeft :size="22" />
        </button>

        <div class="relative flex h-10 min-w-0 flex-1 items-center gap-2 rounded-full bg-[#eaedef] pl-3 pr-1 text-[var(--text-primary)] dark:bg-[#242424]">
          <Search class="shrink-0 text-[var(--text-muted)]" :size="17" aria-hidden="true" />
          <label class="sr-only" for="search-keyword">搜索关键词</label>
          <input
            id="search-keyword"
            ref="searchInput"
            v-model.trim="searchText"
            class="h-full min-w-0 flex-1 bg-transparent text-[13px] font-semibold outline-none placeholder:text-[var(--text-muted)]"
            type="text"
            inputmode="search"
            autocomplete="off"
            :placeholder="searchPlaceholder"
          />
          <button
            v-if="searchText"
            class="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-[var(--text-muted)] transition hover:bg-[var(--surface-muted)] hover:text-[var(--text-primary)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]"
            type="button"
            aria-label="清空搜索"
            @click="clearSearch"
          >
            <X :size="16" />
          </button>
          <button
            class="ml-1 inline-flex h-8 w-[62px] shrink-0 items-center justify-center gap-1 rounded-full bg-[#fefeff] p-1 transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--surface)] dark:bg-[#1e1e1e]"
            type="button"
            :aria-label="`切换为${nextModeLabel}`"
            :aria-pressed="isOnlineMode"
            @click="toggleSearchMode"
          >
            <span
              class="inline-flex h-6 w-6 items-center justify-center transition"
              :class="isOnlineMode ? 'opacity-30' : 'opacity-100'"
              aria-hidden="true"
            >
              <Monitor class="text-[#f5a623]" :size="18" />
            </span>
            <span
              class="inline-flex h-6 w-6 items-center justify-center transition"
              :class="isOnlineMode ? 'opacity-100' : 'opacity-30'"
              aria-hidden="true"
            >
              <Globe2 class="text-[var(--accent)]" :size="18" />
            </span>
          </button>
        </div>

        <div class="app-nav-actions !ml-0" aria-label="搜索页操作">
          <button
            class="nav-icon-button"
            type="button"
            :aria-label="isDarkMode ? '切换为亮色主题' : '切换为暗色主题'"
            :title="isDarkMode ? '亮色主题' : '暗色主题'"
            @click="toggleTheme"
          >
            <span class="sr-only">{{ isDarkMode ? '亮色主题' : '暗色主题' }}</span>
            <Sun v-if="isDarkMode" :size="19" />
            <Moon v-else :size="19" />
          </button>
          <button class="nav-icon-button" type="button" aria-label="查看搜索历史" title="搜索历史" @click="openHistory">
            <Clock3 :size="19" aria-hidden="true" />
          </button>
        </div>
      </form>
    </header>

    <section class="grid gap-3 px-3 py-3 md:px-0 md:py-4">
      <p v-if="statusText" class="min-h-6 px-1 text-xs font-semibold text-[var(--text-muted)]" aria-live="polite">
        {{ statusText }}
      </p>

      <section v-if="isSearching" class="flex min-h-[180px] items-center justify-center gap-2 text-xs font-semibold text-[var(--text-muted)]">
        <LoaderCircle class="spinning shrink-0" :size="16" />
        <span>正在搜索</span>
      </section>

      <section v-else-if="results.length > 0" class="grid gap-2.5" aria-label="搜索结果">
        <SearchResultCard v-for="result in results" :key="result.id || result.sourceUrl || result.title" :result="result" />
      </section>

      <section v-else class="grid min-h-[240px] place-items-center px-4 text-center">
        <p class="m-0 text-xs font-semibold text-[#A4A9BC]">{{ emptyText }}</p>
      </section>
    </section>

    <ToastMessage :message="toastMessage" />
  </main>
</template>
