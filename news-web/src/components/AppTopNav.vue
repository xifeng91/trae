<script setup>
import { ArrowLeft, ListFilter, Moon, RefreshCw, Search, Sun, X } from 'lucide-vue-next';
import { onBeforeUnmount, watch } from 'vue';
import CategoryTabs from './CategoryTabs.vue';

const props = defineProps({
  activeCategory: {
    type: String,
    default: '',
  },
  counts: {
    type: Object,
    default: () => ({}),
  },
  isCategoryPanelOpen: {
    type: Boolean,
    default: false,
  },
  isDarkMode: {
    type: Boolean,
    default: false,
  },
  isRefreshing: {
    type: Boolean,
    default: false,
  },
  showBack: {
    type: Boolean,
    default: false,
  },
  showCategories: {
    type: Boolean,
    default: false,
  },
  showRefresh: {
    type: Boolean,
    default: true,
  },
});

const emit = defineEmits(['update:activeCategory', 'update:isCategoryPanelOpen', 'back', 'refresh', 'search', 'toggle-theme']);

function closeCategoryPanel() {
  emit('update:isCategoryPanelOpen', false);
}

function openCategoryPanel() {
  emit('update:isCategoryPanelOpen', true);
}

function selectCategory(category) {
  emit('update:activeCategory', category);
  closeCategoryPanel();
}

function handleKeydown(event) {
  if (event.key === 'Escape') closeCategoryPanel();
}

function lockBodyScroll(locked) {
  document.body.classList.toggle('overflow-hidden', locked);
}

watch(
  () => props.isCategoryPanelOpen,
  (visible) => {
    if (visible) {
      window.addEventListener('keydown', handleKeydown);
    } else {
      window.removeEventListener('keydown', handleKeydown);
    }

    lockBodyScroll(visible);
  },
);

onBeforeUnmount(() => {
  window.removeEventListener('keydown', handleKeydown);
  lockBodyScroll(false);
});
</script>

<template>
  <header class="app-top-nav">
    <div class="app-top-bar glass-panel" :class="{ 'app-top-bar-secondary': showBack }">
      <template v-if="showBack">
        <div class="app-nav-side app-nav-side-left">
          <button class="nav-icon-button nav-back-button" type="button" aria-label="返回" title="返回" @click="emit('back')">
            <ArrowLeft :size="23" />
          </button>
        </div>

        <h1 class="app-brand app-brand-centered">西风简报</h1>

        <div class="app-nav-side app-nav-side-right" aria-label="页面操作">
          <button class="nav-icon-button" type="button" aria-label="搜索新闻" title="搜索" @click="emit('search')">
            <Search :size="19" />
          </button>
          <button
            class="nav-icon-button"
            type="button"
            :aria-label="isDarkMode ? '切换为亮色主题' : '切换为暗色主题'"
            :title="isDarkMode ? '亮色主题' : '暗色主题'"
            @click="emit('toggle-theme')"
          >
            <Sun v-if="isDarkMode" :size="19" />
            <Moon v-else :size="19" />
          </button>
        </div>
      </template>

      <template v-else>
        <h1 class="app-brand">西风简报</h1>

        <CategoryTabs
          v-if="showCategories"
          class="desktop-category-tabs"
          :model-value="activeCategory"
          :counts="counts"
          @update:model-value="selectCategory"
        />

        <div class="app-nav-actions" aria-label="页面操作">
          <button
            class="nav-icon-button"
            type="button"
            :aria-label="isDarkMode ? '切换为亮色主题' : '切换为暗色主题'"
            :title="isDarkMode ? '亮色主题' : '暗色主题'"
            @click="emit('toggle-theme')"
          >
            <Sun v-if="isDarkMode" :size="19" />
            <Moon v-else :size="19" />
          </button>
          <button
            v-if="showRefresh"
            class="nav-icon-button"
            type="button"
            :disabled="isRefreshing"
            :aria-label="isRefreshing ? '正在刷新新闻' : '刷新新闻'"
            :title="isRefreshing ? '正在刷新' : '刷新'"
            @click="emit('refresh')"
          >
            <RefreshCw :size="19" :class="{ spinning: isRefreshing }" />
          </button>
          <button class="nav-icon-button" type="button" aria-label="搜索新闻" title="搜索" @click="emit('search')">
            <Search :size="19" />
          </button>
          <button
            v-if="showCategories"
            class="nav-icon-button mobile-category-trigger"
            type="button"
            aria-label="选择新闻分类"
            title="分类"
            @click="openCategoryPanel"
          >
            <ListFilter :size="19" />
          </button>
        </div>
      </template>
    </div>

    <Teleport to="body">
      <Transition name="category-sheet-fade">
        <div v-if="showCategories && isCategoryPanelOpen" class="category-sheet-backdrop" role="presentation" @click.self="closeCategoryPanel">
          <Transition name="category-sheet-slide" appear>
            <section class="category-sheet glass-panel" role="dialog" aria-modal="true" aria-labelledby="category-sheet-title">
              <header class="category-sheet-header">
                <h2 id="category-sheet-title">选择分类</h2>
                <button class="nav-icon-button" type="button" aria-label="关闭分类选择" @click="closeCategoryPanel">
                  <X :size="19" />
                </button>
              </header>
              <CategoryTabs variant="grid" :model-value="activeCategory" :counts="counts" @update:model-value="selectCategory" />
            </section>
          </Transition>
        </div>
      </Transition>
    </Teleport>
  </header>
</template>
