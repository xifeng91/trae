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
    default: () => ({}),
  },
  options: {
    type: Array,
    default: () => CATEGORY_OPTIONS,
  },
  showCounts: {
    type: Boolean,
    default: true,
  },
  ariaLabel: {
    type: String,
    default: '新闻分类',
  },
  variant: {
    type: String,
    default: 'tabs',
    validator: (value) => ['tabs', 'grid'].includes(value),
  },
});

const emit = defineEmits(['update:modelValue']);

const categoriesWithCounts = computed(() =>
  props.options.map((category) => ({
    ...category,
    count: category.value === '全部' ? props.counts.total : props.counts[category.value] || 0,
  })),
);
</script>

<template>
  <nav :class="[variant === 'grid' ? 'category-grid' : 'category-tabs', { 'category-tabs-without-counts': !showCounts }]" :aria-label="ariaLabel">
    <button
      v-for="category in categoriesWithCounts"
      :key="category.value"
      class="category-tab"
      :class="{ active: modelValue === category.value }"
      type="button"
      @click="emit('update:modelValue', category.value)"
    >
      <span>{{ category.label }}</span>
      <span v-if="showCounts" class="category-count">{{ category.count }}</span>
    </button>
  </nav>
</template>
