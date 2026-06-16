<script setup>
import { ArrowLeft, ExternalLink, ImageIcon, LoaderCircle, RotateCw } from 'lucide-vue-next';
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { fetchNews, fetchNewsDetail } from '../api/newsApi';
import AiMarkdownContent from '../components/AiMarkdownContent.vue';
import AppTopNav from '../components/AppTopNav.vue';
import ImagePreview from '../components/ImagePreview.vue';
import ToastMessage from '../components/ToastMessage.vue';
import { createInterpretationOwnerKey, useInterpretationCache } from '../composables/useInterpretationCache';
import { useTheme } from '../composables/useTheme';
import { formatNewsDateTime, getSourceHost, splitParagraphs } from '../utils/format';
import { DETAIL_NEWS_PAGE_SIZE, findNewsItemById, getNewsDetailContent, normalizeNewsItem, normalizeNewsResponse } from '../utils/newsData';
import { loadNewsCache, saveNewsCache } from '../utils/storage';

const route = useRoute();
const router = useRouter();
const ownerKey = createInterpretationOwnerKey();
const { isDarkMode, toggleTheme } = useTheme();
const news = ref(null);
const isLoading = ref(true);
const errorMessage = ref('');
const toastMessage = ref('');
const isPreviewOpen = ref(false);
const isImageVisible = ref(false);
const shouldFollowInterpretation = ref(false);
const newsRef = computed(() => news.value || {});
const AUTO_SCROLL_THRESHOLD = 180;
let toastTimer = null;

const {
  canRetry,
  entry: interpretationEntry,
  hasInterpretation,
  interpretationText,
  isGenerating,
  isOwner,
  startInterpretation,
} = useInterpretationCache(newsRef, ownerKey);

const newsId = computed(() => String(route.params.id || ''));
const displayDateTime = computed(() => formatNewsDateTime(news.value?.date, news.value?.time, news.value?.publishedAt));
const sourceHost = computed(() => getSourceHost(news.value?.sourceUrl));
const imageUrl = computed(() => String(news.value?.imageUrl || '').trim());
const imageAlt = computed(() => news.value?.imageAlt || news.value?.title || '新闻图片');
const detailParagraphs = computed(() => splitParagraphs(getNewsDetailContent(news.value)));
const interpretationError = computed(() => interpretationEntry.value.error);
const isWaitingForSharedInterpretation = computed(() => isGenerating.value && !isOwner.value);

function findNewsInCache(id) {
  return findNewsItemById(loadNewsCache(), id);
}

function mergeNewsIntoCache(item, fallbackData = null) {
  const cached = loadNewsCache();
  if (!cached?.items?.length) {
    if (fallbackData?.items?.length) saveNewsCache(fallbackData);
    return;
  }

  const exists = cached.items.some((cachedItem) => cachedItem.id === item.id);
  if (exists) return;

  saveNewsCache({
    ...cached,
    items: [item, ...cached.items],
  });
}

async function loadDetailNews() {
  isLoading.value = true;
  errorMessage.value = '';
  news.value = null;

  const cachedNews = findNewsInCache(newsId.value);
  if (cachedNews) {
    news.value = normalizeNewsItem(cachedNews);
    isLoading.value = false;
    return;
  }

  try {
    const detail = await fetchNewsDetail(newsId.value);
    news.value = normalizeNewsItem(detail);
    mergeNewsIntoCache(news.value);
  } catch (error) {
    try {
      const data = await fetchNews({
        category: '全部',
        page: 1,
        pageSize: DETAIL_NEWS_PAGE_SIZE,
      });
      const item = findNewsItemById(data, newsId.value);
      const normalizedData = normalizeNewsResponse(data);

      if (!item) {
        errorMessage.value = error.message || '新闻已过期或不存在';
        return;
      }

      news.value = normalizeNewsItem(item);
      mergeNewsIntoCache(news.value, normalizedData);
    } catch (fallbackError) {
      errorMessage.value = fallbackError.message || error.message || '新闻详情加载失败';
    }
  } finally {
    isLoading.value = false;
  }
}

function loadInterpretation({ force = false } = {}) {
  if (!news.value?.id) return;
  startInterpretation(news.value, ownerKey, { force });
}

function goBack() {
  if (window.history.length > 1) {
    router.back();
    return;
  }

  router.push({ name: 'home' });
}

function handleSearch() {
  router.push({ name: 'search' });
}

function openImagePreview() {
  if (!imageUrl.value) return;
  isPreviewOpen.value = true;
}

function handleImageError() {
  isImageVisible.value = false;
  isPreviewOpen.value = false;
}

function getDistanceToBottom() {
  const pageHeight = Math.max(document.documentElement.scrollHeight, document.body.scrollHeight);
  return pageHeight - (window.scrollY + window.innerHeight);
}

function updateAutoScrollState() {
  shouldFollowInterpretation.value = getDistanceToBottom() <= AUTO_SCROLL_THRESHOLD;
}

function scrollToPageBottom() {
  window.scrollTo({
    top: Math.max(document.documentElement.scrollHeight, document.body.scrollHeight),
    behavior: 'smooth',
  });
}

onMounted(loadDetailNews);

onBeforeUnmount(() => {
  window.clearTimeout(toastTimer);
});

watch(newsId, loadDetailNews);

watch(
  () => news.value?.id,
  (id) => {
    if (id) loadInterpretation();
  },
);

watch(imageUrl, (url) => {
  isImageVisible.value = Boolean(url);
  if (!url) isPreviewOpen.value = false;
});

watch(isGenerating, (generating) => {
  if (generating) updateAutoScrollState();
});

watch(interpretationText, async () => {
  if (!isGenerating.value) return;

  updateAutoScrollState();
  if (!shouldFollowInterpretation.value) return;

  await nextTick();
  scrollToPageBottom();
});
</script>

<template>
  <main class="detail-page">
    <AppTopNav :is-dark-mode="isDarkMode" show-back :show-refresh="false" @back="goBack" @search="handleSearch" @toggle-theme="toggleTheme" />

    <section v-if="isLoading" class="loading-view">
      <LoaderCircle :size="30" />
      <span>正在加载新闻详情</span>
    </section>

    <section v-else-if="!news" class="error-view">
      <h2>{{ errorMessage || '新闻已过期或不存在' }}</h2>
      <p>这条新闻可能已不在近 24 小时列表中。</p>
      <button class="icon-button primary" type="button" @click="router.push({ name: 'home' })">
        <ArrowLeft :size="18" />
        <span>返回首页</span>
      </button>
    </section>

    <article v-else class="detail-article">
      <header class="detail-header">
        <h1>{{ news.title }}</h1>
        <div class="detail-meta">
          <div class="flex-row">
            <span>{{ news.source }}</span>
            <span aria-hidden="true">｜</span>
            <span>{{ displayDateTime }}</span>
          </div>
          <a v-if="news.sourceUrl" class="source-link" :href="news.sourceUrl" target="_blank" rel="noreferrer">
            <span>{{ sourceHost || news.source }}</span>
            <ExternalLink :size="15" />
          </a>
        </div>
      </header>

      <button v-if="isImageVisible" class="detail-image-button" type="button" :aria-label="`预览图片：${imageAlt}`" @click="openImagePreview">
        <img :src="imageUrl" :alt="imageAlt" loading="lazy" decoding="async" referrerpolicy="no-referrer" @error="handleImageError" />
        <span class="detail-image-hint" aria-hidden="true">
          <ImageIcon :size="15" />
          <span>预览图片</span>
        </span>
      </button>

      <section class="detail-section">
        <h2>内容</h2>
        <div class="detail-content">
          <p v-for="paragraph in detailParagraphs" :key="paragraph">{{ paragraph }}</p>
        </div>
      </section>

      <section class="detail-section">
        <h2>AI 解读</h2>
        <p v-if="isGenerating && !hasInterpretation" class="detail-status">
          <LoaderCircle class="spinning" :size="15" />
          <span>{{ isWaitingForSharedInterpretation ? 'AI 解读正在生成中' : '正在生成AI解读...' }}</span>
        </p>
        <Transition name="ai-content-fade">
          <AiMarkdownContent v-if="hasInterpretation" :content="interpretationText" />
        </Transition>
        <p v-if="isGenerating && hasInterpretation" class="detail-status text-[var(--accent-strong)]">
          <LoaderCircle class="spinning" :size="15" />
          <span>AI解读生成中</span>
        </p>
        <p v-if="!isGenerating && !hasInterpretation && !interpretationError" class="detail-status">AI解读待生成</p>
        <p v-if="interpretationError" class="detail-error">{{ interpretationError }}</p>
        <button v-if="canRetry" class="retry-button" type="button" @click="loadInterpretation({ force: true })">
          <RotateCw :size="14" />
          <span>重新生成</span>
        </button>
      </section>
    </article>

    <ImagePreview v-model="isPreviewOpen" :src="imageUrl" :alt="imageAlt" />
    <ToastMessage :message="toastMessage" />
  </main>
</template>
