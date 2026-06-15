<script setup>
import { Moon, RefreshCw, Sun } from 'lucide-vue-next';

defineProps({
  data: {
    type: Object,
    default: null,
  },
  isRefreshing: {
    type: Boolean,
    default: false,
  },
  cacheSource: {
    type: String,
    default: '',
  },
  isDarkMode: {
    type: Boolean,
    default: false,
  },
});

const emit = defineEmits(['refresh', 'toggle-theme']);
</script>

<template>
  <header class="app-header">
    <a class="brand-link" href="/#/" aria-label="返回今日简报首页">
      <img class="brand-logo" src="/logo.png" alt="" width="36" height="36" />
      <span>今日简报</span>
    </a>

    <div class="header-actions">
      <button
        class="icon-button nav-action"
        type="button"
        :disabled="isRefreshing"
        :aria-label="isRefreshing ? '正在刷新新闻' : '刷新新闻'"
        :title="isRefreshing ? '正在刷新' : '刷新'"
        @click="emit('refresh')"
      >
        <RefreshCw :size="18" :class="{ spinning: isRefreshing }" />
        <span class="sr-only">{{ isRefreshing ? '刷新中' : '刷新' }}</span>
      </button>
      <button
        class="icon-button nav-action"
        type="button"
        :aria-label="isDarkMode ? '切换为亮色主题' : '切换为暗色主题'"
        :title="isDarkMode ? '亮色主题' : '暗色主题'"
        @click="emit('toggle-theme')"
      >
        <Sun v-if="isDarkMode" :size="20" />
        <Moon v-else :size="20" />
        <span class="sr-only">{{ isDarkMode ? '亮色主题' : '暗色主题' }}</span>
      </button>
    </div>
  </header>
</template>
