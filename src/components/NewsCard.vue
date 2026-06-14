<script setup>
import { ChevronDown, ExternalLink } from 'lucide-vue-next';
import { computed, ref } from 'vue';
import { CATEGORY_META } from '../utils/categories';
import { formatNewsDateTime, getSourceHost, splitParagraphs } from '../utils/format';

const props = defineProps({
  news: {
    type: Object,
    required: true,
  },
});

const isExpanded = ref(false);

const categoryColor = computed(() => CATEGORY_META[props.news.category]?.color || '#64748b');
const displayDateTime = computed(() => formatNewsDateTime(props.news.date, props.news.time));
const paragraphs = computed(() => splitParagraphs(props.news.interpretation));
const sourceHost = computed(() => getSourceHost(props.news.sourceUrl));
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
      class="grid w-full grid-cols-[minmax(0,1fr)_auto] gap-2.5 bg-transparent p-3 text-left text-inherit transition-colors duration-200 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-[var(--accent)] md:px-4 md:py-3.5"
      type="button"
      @click="isExpanded = !isExpanded"
    >
      <span class="flex min-w-0 items-center gap-2.5">
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
        :class="{ 'rotate-180': isExpanded }"
        :size="18"
      />

      <span class="col-span-full grid min-w-0 gap-1.5">
        <span class="line-clamp-3 overflow-hidden text-[11px] leading-[1.72] text-[#747a96] dark:text-[var(--text-secondary)]">
          {{ news.shortSummary || news.summary }}
        </span>
        <span class="flex flex-wrap items-center gap-2 text-[11px] font-medium text-[#747a96] dark:text-[var(--text-secondary)]">
          <span>{{ news.source }}</span>
          <span class="text-[var(--line)]" aria-hidden="true">•</span>
          <span>{{ displayDateTime }}</span>
        </span>
      </span>
    </button>

    <div
      class="grid max-h-0 gap-4 overflow-hidden px-4 transition-[max-height,padding] duration-300"
      :class="isExpanded ? 'max-h-[2400px] border-t border-[var(--line)] py-4 md:pb-4 md:pt-3.5' : ''"
    >
      <section class="detail-block">
        <span class="detail-label">一句话概括</span>
        <p>{{ news.shortSummary || news.summary || '暂无摘要' }}</p>
      </section>

      <section class="detail-block">
        <span class="detail-label">AI 解读</span>
        <p v-for="paragraph in paragraphs" :key="paragraph">{{ paragraph }}</p>
        <p v-if="paragraphs.length === 0">暂无解读内容。</p>
      </section>

      <a v-if="news.sourceUrl" class="source-link" :href="news.sourceUrl" target="_blank" rel="noreferrer">
        <span>{{ sourceHost || news.source }}</span>
        <ExternalLink :size="15" />
      </a>
    </div>
  </article>
</template>
