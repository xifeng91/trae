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
    <div v-if="items.length === 0" class="flex min-h-100 flex-col items-center justify-center py-3 text-center text-xs font-semibold text-[#A4A9BC]">
      当前分类暂无最新新闻内容
    </div>
  </section>
</template>
