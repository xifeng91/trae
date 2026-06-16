<script setup>
import { ExternalLink, Globe2, Monitor } from 'lucide-vue-next';
import { computed } from 'vue';
import { useRouter } from 'vue-router';
import { CATEGORY_META } from '../utils/categories';
import { formatNewsDateTime } from '../utils/format';

const props = defineProps({
  result: {
    type: Object,
    required: true,
  },
});

const router = useRouter();
const categoryColor = computed(() => CATEGORY_META[props.result.category]?.color || '#64748b');
const displayDateTime = computed(() => formatNewsDateTime(props.result.date, props.result.time, props.result.publishedAt));
const titleSegments = computed(() => getSegments(props.result.highlights?.title, props.result.title));
const snippetSegments = computed(() => getSegments(props.result.highlights?.snippet, props.result.searchSnippet || props.result.overview));
const originLabel = computed(() => {
  const label = props.result.originLabel || '';
  const origin = props.result.origin || '';
  if (label.includes('联网') || origin === 'web' || origin === 'online') return '联网补充';
  return '本地收录';
});
const isOnlineOrigin = computed(() => originLabel.value === '联网补充');

function getSegments(segments, fallbackText = '') {
  if (Array.isArray(segments) && segments.length) return segments;
  return fallbackText ? [{ text: fallbackText, matched: false }] : [];
}

function openResult() {
  if (!props.result.id) return;
  router.push({ name: 'news-detail', params: { id: props.result.id } });
}

function handleCardKeydown(event) {
  if (event.target !== event.currentTarget) return;
  if (event.key !== 'Enter' && event.key !== ' ') return;

  event.preventDefault();
  openResult();
}
</script>

<template>
  <article
    class="flex min-w-0 cursor-pointer flex-col gap-2 overflow-hidden rounded-lg bg-[var(--surface)] p-3 text-[var(--text-primary)] shadow-[0_10px_28px_rgba(15,23,42,0.08)] transition hover:bg-[#f7fbff] focus-visible:bg-[#f7fbff] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)] dark:shadow-[0_14px_34px_rgba(0,0,0,0.26)] dark:hover:bg-[#162033] dark:focus-visible:bg-[#162033] md:p-4"
    role="link"
    tabindex="0"
    :aria-label="`查看新闻详情：${result.title}`"
    @click="openResult"
    @keydown="handleCardKeydown"
  >
    <div class="flex min-w-0 items-center gap-2.5">
      <span
        class="inline-flex h-6 shrink-0 items-center justify-center rounded-md px-2 text-[11px] font-semibold leading-none text-white"
        :style="{ backgroundColor: categoryColor }"
      >
        {{ result.category }}
      </span>
      <h2 class="min-w-0 flex-1 text-[13px] font-semibold leading-6 md:text-sm">
        <span class="block min-w-0 truncate">
          <template v-for="(segment, index) in titleSegments" :key="`${index}-${segment.text}`">
            <mark v-if="segment.matched" class="rounded bg-[#fff2a8] px-0.5 text-inherit dark:bg-[#6b5a12]">{{ segment.text }}</mark>
            <span v-else>{{ segment.text }}</span>
          </template>
        </span>
      </h2>
    </div>

    <p class="line-clamp-3 min-w-0 overflow-hidden text-[11px] leading-[1.72] text-[#747a96] dark:text-[var(--text-secondary)] md:text-xs">
      <template v-for="(segment, index) in snippetSegments" :key="`${index}-${segment.text}`">
        <mark v-if="segment.matched" class="rounded bg-[#fff2a8] px-0.5 text-inherit dark:bg-[#6b5a12]">{{ segment.text }}</mark>
        <span v-else>{{ segment.text }}</span>
      </template>
    </p>

    <div class="flex min-w-0 flex-wrap items-center justify-between gap-x-3 gap-y-1 text-[11px]">
      <p class="m-0 flex min-w-0 flex-1 items-center gap-1.5 text-[#4c4f5d] dark:text-[var(--text-secondary)]">
        <a
          v-if="result.sourceUrl"
          class="inline-flex min-w-0 items-center gap-1 font-medium underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]"
          :href="result.sourceUrl"
          target="_blank"
          rel="noopener noreferrer"
          @click.stop
        >
          <span class="truncate">{{ result.source }}</span>
          <ExternalLink :size="12" aria-hidden="true" />
        </a>
        <span v-else class="min-w-0 truncate font-medium">{{ result.source }}</span>
        <span class="shrink-0 text-[#b8c0d2] dark:text-[var(--line)]" aria-hidden="true">·</span>
        <span class="shrink-0 font-normal">{{ displayDateTime }}</span>
      </p>

      <p
        class="m-0 inline-flex shrink-0 items-center gap-1 font-medium"
        :class="isOnlineOrigin ? 'text-[var(--accent-strong)]' : 'text-[#f5a623]'"
      >
        <Globe2 v-if="isOnlineOrigin" :size="13" aria-hidden="true" />
        <Monitor v-else :size="13" aria-hidden="true" />
        <span>{{ originLabel }}</span>
      </p>
    </div>
  </article>
</template>
