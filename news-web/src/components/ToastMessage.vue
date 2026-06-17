<script setup>
defineProps({
  message: {
    type: String,
    default: '',
  },
});
</script>

<template>
  <Transition name="toast">
    <div v-if="message" class="toast-message brand-status-text">{{ message }}</div>
  </Transition>
</template>
