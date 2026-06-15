<script setup>
import { Activity, BadgeAlert, CircleDot, Layers, Newspaper } from 'lucide-vue-next';

defineProps({
  stats: {
    type: Object,
    required: true,
  },
});

const summaryItems = [
  { label: '总量', key: 'total', icon: Newspaper },
  { label: '要闻', key: 'P0', icon: BadgeAlert },
  { label: '关注', key: 'P1', icon: Activity },
  { label: '补充', key: 'P2', icon: Layers },
];

const categoryItems = [
  { label: '国内', key: '国内' },
  { label: '国际', key: '国际' },
  { label: '财经', key: '财经' },
  { label: '科技', key: '科技' },
];
</script>

<template>
  <aside class="stats-panel">
    <div class="panel-heading">
      <CircleDot :size="16" />
      <span>简报概览</span>
    </div>

    <div class="stats-grid">
      <article v-for="item in summaryItems" :key="item.key" class="stat-card">
        <component :is="item.icon" :size="18" />
        <span>{{ item.label }}</span>
        <strong>{{ stats[item.key] || 0 }}</strong>
      </article>
    </div>

    <div class="category-meter">
      <div v-for="item in categoryItems" :key="item.key" class="meter-row">
        <span>{{ item.label }}</span>
        <div class="meter-track">
          <i :style="{ width: `${Math.min(100, ((stats[item.key] || 0) / Math.max(stats.total || 1, 1)) * 100)}%` }"></i>
        </div>
        <strong>{{ stats[item.key] || 0 }}</strong>
      </div>
    </div>
  </aside>
</template>
