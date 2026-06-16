<script setup>
import { ExternalLink, ImageIcon } from 'lucide-vue-next';
import { computed, ref, watch } from 'vue';
import { useRouter } from 'vue-router';
import { CATEGORY_META } from '../utils/categories';
import { formatNewsDateTime } from '../utils/format';
import ImagePreview from './ImagePreview.vue';
import { getRenderableImageUrl } from '../utils/images';

const props = defineProps({
  news: {
    type: Object,
    required: true,
  },
});

const router = useRouter();
const isPreviewOpen = ref(false);
const categoryColor = computed(() => CATEGORY_META[props.news.category]?.color || '#64748b');
const displayDateTime = computed(() => formatNewsDateTime(props.news.date, props.news.time, props.news.publishedAt));
const overviewText = computed(() => props.news.overview || props.news.summary || props.news.shortSummary || '暂无内容总览');
const imageUrl = computed(() => getRenderableImageUrl(props.news.imageUrl));
const imageAlt = computed(() => props.news.imageAlt || props.news.title || '新闻图片');
const isImageVisible = ref(Boolean(imageUrl.value));

function goToDetail() {
  if (!props.news.id) return;
  router.push({ name: 'news-detail', params: { id: props.news.id } });
}

function handleCardKeydown(event) {
  if (event.target !== event.currentTarget) return;
  if (event.key !== 'Enter' && event.key !== ' ') return;

  event.preventDefault();
  goToDetail();
}

function openImagePreview() {
  if (!imageUrl.value) return;
  isPreviewOpen.value = true;
}

function handleImageError() {
  isImageVisible.value = false;
  isPreviewOpen.value = false;
}

watch(imageUrl, (url) => {
  isImageVisible.value = Boolean(url);
  if (!url) isPreviewOpen.value = false;
});
</script>

<template>
  <article
    class="news-card"
    role="link"
    tabindex="0"
    :aria-label="`查看新闻详情：${news.title}`"
    @click="goToDetail"
    @keydown="handleCardKeydown"
  >
    <div class="min-w-0 flex-1">
      <div class="flex min-w-0 items-center gap-2.5">
        <span
          class="inline-flex h-6 shrink-0 items-center justify-center rounded-md px-2 text-[11px] font-semibold leading-none text-white"
          :style="{ backgroundColor: categoryColor }"
        >
          {{ news.category }}
        </span>
        <h2 class="min-w-0 flex-1 truncate text-[13px] font-semibold leading-6 text-[#0b0b0e] dark:text-[var(--text-primary)]">
          {{ news.title }}
        </h2>
      </div>

      <p class="mt-1.5 line-clamp-3 text-[11px] leading-[1.72] text-[#747a96] dark:text-[var(--text-secondary)]">
        {{ overviewText }}
      </p>

      <p class="mt-2 flex min-w-0 items-center gap-1.5 text-[11px] text-[#4c4f5d] dark:text-[var(--text-secondary)]">
        <a
          v-if="news.sourceUrl"
          class="inline-flex min-w-0 items-center gap-1 font-medium underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]"
          :href="news.sourceUrl"
          target="_blank"
          rel="noopener noreferrer"
          @click.stop
        >
          <span class="truncate">{{ news.source }}</span>
          <ExternalLink :size="12" aria-hidden="true" />
        </a>
        <span v-else class="min-w-0 truncate font-medium">{{ news.source }}</span>
        <span class="shrink-0 text-[#b8c0d2] dark:text-[var(--line)]" aria-hidden="true">·</span>
        <span class="shrink-0 font-normal">{{ displayDateTime }}</span>
      </p>
    </div>

    <button
      v-if="isImageVisible"
      class="news-card-image-button"
      type="button"
      :aria-label="`预览图片：${imageAlt}`"
      @click.stop="openImagePreview"
    >
      <img
        class="h-full w-full object-cover"
        :src="imageUrl"
        :alt="imageAlt"
        loading="lazy"
        decoding="async"
        referrerpolicy="no-referrer"
        @error="handleImageError"
      />
      <span class="news-card-image-icon" aria-hidden="true">
        <ImageIcon :size="14" />
      </span>
    </button>

    <ImagePreview v-model="isPreviewOpen" :src="imageUrl" :alt="imageAlt" />
  </article>
</template>
