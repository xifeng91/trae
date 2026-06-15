<script setup>
import NewsCard from './NewsCard.vue';

defineProps({
  items: {
    type: Array,
    required: true,
  },
});
</script>

<template>
  <section class="news-list" aria-label="新闻列表">
    <NewsCard v-for="news in items" :key="news.id || news.title" :news="news" />
    <div v-if="items.length === 0" class="empty-state">当前分类暂无新闻</div>
  </section>
</template>
