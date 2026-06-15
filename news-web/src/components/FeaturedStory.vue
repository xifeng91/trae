<script setup>
import { ArrowUpRight, Flame } from 'lucide-vue-next';

defineProps({
  news: {
    type: Object,
    default: null,
  },
});
</script>

<template>
  <section v-if="news" class="featured-story">
    <div class="featured-label">
      <Flame :size="16" />
      <span>今日头条</span>
    </div>
    <h2>{{ news.title }}</h2>
    <p>{{ news.shortSummary || news.summary }}</p>
    <a v-if="news.sourceUrl" :href="news.sourceUrl" target="_blank" rel="noreferrer">
      <span>{{ news.source }}</span>
      <ArrowUpRight :size="16" />
    </a>
  </section>
</template>
