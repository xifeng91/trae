<script setup>
import { ChevronDown, ExternalLink, LoaderCircle, RotateCw } from 'lucide-vue-next';
import { computed, ref, watch } from 'vue';
import { createInterpretationOwnerKey, useInterpretationCache } from '../composables/useInterpretationCache';
import { CATEGORY_META } from '../utils/categories';
import { formatNewsDateTime, getSourceHost } from '../utils/format';
import AiMarkdownContent from './AiMarkdownContent.vue';

const props = defineProps({
  news: {
    type: Object,
    required: true,
  },
});

const isExpanded = ref(false);
const ownerKey = createInterpretationOwnerKey();
const newsRef = computed(() => props.news);

const categoryColor = computed(() => CATEGORY_META[props.news.category]?.color || '#64748b');
const displayDateTime = computed(() => formatNewsDateTime(props.news.date, props.news.time, props.news.publishedAt));
const overviewText = computed(() => props.news.overview || props.news.summary || props.news.shortSummary || '暂无内容总览');
const sourceHost = computed(() => getSourceHost(props.news.sourceUrl));
const imageUrl = computed(() => String(props.news.imageUrl || '').trim());
const imageAlt = computed(() => props.news.imageAlt || props.news.title || '新闻图片');
const isImageVisible = ref(Boolean(imageUrl.value));
const {
  canRetry,
  entry: interpretationEntry,
  hasInterpretation,
  interpretationText,
  isGenerating,
  isOwner,
  startInterpretation,
} = useInterpretationCache(newsRef, ownerKey);
const interpretationError = computed(() => interpretationEntry.value.error);
const isWaitingForSharedInterpretation = computed(() => isGenerating.value && !isOwner.value);

function loadInterpretation({ force = false } = {}) {
  startInterpretation(props.news, ownerKey, { force });
}

function toggleExpanded() {
  isExpanded.value = !isExpanded.value;
}

function handleImageError() {
  isImageVisible.value = false;
}

watch(isExpanded, (expanded) => {
  if (expanded) loadInterpretation();
});

watch(imageUrl, (url) => {
  isImageVisible.value = Boolean(url);
});

watch(
  () => props.news.id,
  () => {
    if (isExpanded.value) loadInterpretation();
  },
);
</script>

<template>
  <article
    class="overflow-hidden rounded-lg transition-[background-color,box-shadow] duration-200"
    :class="
      isExpanded
        ? 'bg-[#f3f7ff] shadow-[0_18px_42px_rgba(0,102,204,0.18)] dark:bg-[#162033] dark:shadow-[0_20px_48px_rgba(0,102,204,0.22)]'
        : 'bg-[var(--surface)] shadow-[0_10px_28px_rgba(15,23,42,0.08)] dark:shadow-[0_14px_34px_rgba(0,0,0,0.26)]'
    "
  >
    <button
      class="grid w-full gap-2.5 bg-transparent p-3 text-left text-inherit transition-colors duration-200 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-[var(--accent)] md:px-4 md:py-3.5"
      :class="isImageVisible ? 'grid-cols-[minmax(0,1fr)_auto] md:grid-cols-[7rem_minmax(0,1fr)_auto]' : 'grid-cols-[minmax(0,1fr)_auto]'"
      type="button"
      @click="toggleExpanded"
    >
      <span
        v-if="isImageVisible"
        class="col-span-full block aspect-[16/9] overflow-hidden rounded-md bg-[var(--surface-muted)] md:col-span-1 md:row-span-2 md:h-24 md:aspect-auto"
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
      </span>

      <span class="flex min-w-0 items-center gap-2.5" :class="isImageVisible ? 'md:col-start-2' : ''">
        <span
          class="inline-flex h-6 shrink-0 items-center justify-center rounded-md px-2 text-[11px] font-semibold leading-none text-white"
          :style="{ backgroundColor: categoryColor }"
        >
          {{ news.category }}
        </span>
        <span class="truncate text-[13px] font-medium leading-6 text-[#0b0b0e] dark:text-[var(--text-primary)]">
          {{ news.title }}
        </span>
      </span>

      <ChevronDown
        class="mt-[3px] shrink-0 text-[var(--text-muted)] transition duration-200"
        :class="[isExpanded ? 'rotate-180' : '', isImageVisible ? 'md:col-start-3' : '']"
        :size="18"
      />

      <span class="grid min-w-0 gap-1.5" :class="isImageVisible ? 'col-span-full md:col-start-2 md:col-end-4' : 'col-span-full'">
        <span
          class="overflow-hidden text-[11px] leading-[1.72] text-[#747a96] dark:text-[var(--text-secondary)]"
          :class="{ 'line-clamp-3': !isExpanded }"
        >
          {{ overviewText }}
        </span>
        <span class="flex flex-wrap items-center gap-2 text-[11px] font-medium text-[var(--text-muted)]">
          <span>{{ news.source }}</span>
          <span class="text-[var(--line)]" aria-hidden="true">•</span>
          <span>{{ displayDateTime }}</span>
        </span>
      </span>
    </button>

    <Transition name="news-card-detail">
      <div v-if="isExpanded" class="grid gap-4 border-t border-[var(--line)] px-4 py-4 md:pb-4 md:pt-3.5">
        <section class="detail-block">
          <span class="detail-label">AI 解读</span>
          <p v-if="isGenerating && !hasInterpretation" class="inline-flex items-center gap-2">
            <LoaderCircle class="spinning" :size="14" />
            <span>{{ isWaitingForSharedInterpretation ? 'AI 解读正在生成中' : '正在生成关键词解析...' }}</span>
          </p>
          <Transition name="ai-content-fade">
            <AiMarkdownContent v-if="hasInterpretation" :content="interpretationText" />
          </Transition>
          <p v-if="isGenerating && hasInterpretation" class="inline-flex items-center gap-2 text-[var(--accent-strong)]">
            <LoaderCircle class="spinning" :size="14" />
            <span>继续生成中</span>
          </p>
          <p v-if="!isGenerating && !hasInterpretation && !interpretationError">展开后将生成 AI 解读。</p>
          <p v-if="interpretationError" class="text-[#b42318] dark:text-[#ffb4a8]">{{ interpretationError }}</p>
          <button v-if="canRetry" class="retry-button" type="button" @click.stop="loadInterpretation({ force: true })">
            <RotateCw :size="14" />
            <span>重新生成</span>
          </button>
        </section>

        <a v-if="news.sourceUrl" class="source-link" :href="news.sourceUrl" target="_blank" rel="noreferrer">
          <span>{{ sourceHost || news.source }}</span>
          <ExternalLink :size="15" />
        </a>
      </div>
    </Transition>
  </article>
</template>
