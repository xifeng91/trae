<script setup>
import { computed } from 'vue';
import { CATEGORY_OPTIONS } from '../utils/categories';

const props = defineProps({
  modelValue: {
    type: String,
    required: true,
  },
  counts: {
    type: Object,
    required: true,
  },
  variant: {
    type: String,
    default: 'tabs',
    validator: (value) => ['tabs', 'grid'].includes(value),
  },
});

const emit = defineEmits(['update:modelValue']);

const categoriesWithCounts = computed(() =>
  CATEGORY_OPTIONS.map((category) => ({
    ...category,
    count: category.value === '全部' ? props.counts.total : props.counts[category.value] || 0,
  })),
);
</script>

<template>
  <nav :class="variant === 'grid' ? 'category-grid' : 'category-tabs'" aria-label="新闻分类">
    <button
      v-for="category in categoriesWithCounts"
      :key="category.value"
      class="category-tab"
      :class="{ active: modelValue === category.value }"
      type="button"
      @click="emit('update:modelValue', category.value)"
    >
      <span>{{ category.label }}</span>
      <span class="category-count">{{ category.count }}</span>
    </button>
  </nav>
</template>
