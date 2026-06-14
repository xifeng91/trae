<script setup>
import { ChevronDown, ExternalLink } from 'lucide-vue-next';
import { computed, ref } from 'vue';
import { CATEGORY_META } from '../utils/categories';
import { getSourceHost, splitParagraphs } from '../utils/format';

const props = defineProps({
  news: {
    type: Object,
    required: true,
  },
});

const isExpanded = ref(false);

const categoryColor = computed(() => CATEGORY_META[props.news.category]?.color || '#64748b');
const paragraphs = computed(() => splitParagraphs(props.news.interpretation));
const sourceHost = computed(() => getSourceHost(props.news.sourceUrl));
</script>

<template>
  <article class="news-card" :class="{ expanded: isExpanded }">
    <button class="news-card-main" type="button" @click="isExpanded = !isExpanded">
      <span class="category-badge" :style="{ backgroundColor: categoryColor }">{{ news.category }}</span>
      <span class="news-body">
        <span class="news-title">{{ news.title }}</span>
        <span class="news-summary">{{ news.shortSummary || news.summary }}</span>
        <span class="news-meta">
          <span>{{ news.source }}</span>
          <span>{{ news.time }}</span>
        </span>
      </span>
      <ChevronDown class="expand-icon" :size="18" />
    </button>

    <div class="news-detail">
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
