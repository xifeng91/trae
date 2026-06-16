<script setup>
import { X } from 'lucide-vue-next';
import { onBeforeUnmount, watch } from 'vue';

const props = defineProps({
  alt: {
    type: String,
    default: '新闻图片',
  },
  src: {
    type: String,
    default: '',
  },
  modelValue: {
    type: Boolean,
    default: false,
  },
});

const emit = defineEmits(['update:modelValue']);

function closePreview() {
  emit('update:modelValue', false);
}

function handleKeydown(event) {
  if (event.key === 'Escape') closePreview();
}

function lockBodyScroll(locked) {
  document.body.classList.toggle('overflow-hidden', locked);
}

watch(
  () => props.modelValue,
  (visible) => {
    if (visible) {
      window.addEventListener('keydown', handleKeydown);
    } else {
      window.removeEventListener('keydown', handleKeydown);
    }

    lockBodyScroll(visible);
  },
  { immediate: true },
);

onBeforeUnmount(() => {
  window.removeEventListener('keydown', handleKeydown);
  lockBodyScroll(false);
});
</script>

<template>
  <Teleport to="body">
    <Transition name="image-preview-fade">
      <div v-if="modelValue && src" class="image-preview" role="dialog" aria-modal="true" :aria-label="alt || '新闻图片预览'" @click.self="closePreview">
        <button class="image-preview-close" type="button" aria-label="关闭图片预览" @click="closePreview">
          <X :size="22" />
        </button>
        <figure class="image-preview-frame">
          <img class="image-preview-img" :src="src" :alt="alt" decoding="async" referrerpolicy="no-referrer" />
          <figcaption v-if="alt" class="image-preview-caption">{{ alt }}</figcaption>
        </figure>
      </div>
    </Transition>
  </Teleport>
</template>
