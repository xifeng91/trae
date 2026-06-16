<script setup>
import { LoaderCircle } from 'lucide-vue-next';
import { computed, onMounted, ref, watch } from 'vue';
import { useRouter } from 'vue-router';
import { fetchSearchHistory } from '../api/newsApi';
import AppTopNav from '../components/AppTopNav.vue';
import NewsCard from '../components/NewsCard.vue';
import { useTheme } from '../composables/useTheme';

const HISTORY_FILTERS = [
  { label: '今日', value: 'today' },
  { label: '昨日', value: 'yesterday' },
  { label: '更早', value: 'earlier' },
];

const router = useRouter();
const { isDarkMode, toggleTheme } = useTheme();
const activeBucket = ref('today');
const historyData = ref(null);
const isLoading = ref(false);
const errorMessage = ref('');

const historyItems = computed(() => historyData.value?.items || []);
const emptyText = computed(() => {
  if (errorMessage.value) return errorMessage.value;
  if (activeBucket.value === 'today') return '今日暂无搜索历史';
  if (activeBucket.value === 'yesterday') return '昨日暂无搜索历史';
  return '7 天内暂无更早搜索历史';
});

async function loadHistory() {
  isLoading.value = true;
  errorMessage.value = '';

  try {
    historyData.value = await fetchSearchHistory({
      bucket: activeBucket.value,
    });
  } catch (error) {
    historyData.value = null;
    errorMessage.value = error.message || '搜索历史加载失败';
  } finally {
    isLoading.value = false;
  }
}

function goBack() {
  if (window.history.length > 1) {
    router.back();
    return;
  }

  router.push({ name: 'search' });
}

function handleSearch() {
  router.push({ name: 'search' });
}

watch(activeBucket, loadHistory);

onMounted(loadHistory);
</script>

<template>
  <main class="home-page">
    <AppTopNav :is-dark-mode="isDarkMode" show-back :show-refresh="false" @back="goBack" @search="handleSearch" @toggle-theme="toggleTheme" />

    <section class="grid gap-3 px-3 py-3 md:px-0 md:py-4">
      <div class="history-filter-bar" aria-label="搜索历史筛选">
        <button
          v-for="filter in HISTORY_FILTERS"
          :key="filter.value"
          class="history-filter-button"
          :class="{ active: activeBucket === filter.value }"
          type="button"
          :aria-pressed="activeBucket === filter.value"
          @click="activeBucket = filter.value"
        >
          {{ filter.label }}
        </button>
      </div>

      <section v-if="isLoading" class="loading-view !min-h-[240px]">
        <LoaderCircle class="spinning" :size="28" />
        <span>正在加载历史</span>
      </section>

      <section v-else-if="historyItems.length > 0" class="news-list !px-0" aria-label="搜索历史列表">
        <NewsCard v-for="item in historyItems" :key="item.id" :news="item" />
      </section>

      <section v-else class="grid min-h-[240px] place-items-center px-4 text-center">
        <p class="m-0 text-xs font-semibold text-[#A4A9BC]">{{ emptyText }}</p>
      </section>
    </section>
  </main>
</template>
