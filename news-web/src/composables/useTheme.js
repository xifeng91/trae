import { ref, watch } from 'vue';
import { loadThemePreference, saveThemePreference } from '../utils/storage';

function resolveInitialTheme() {
  const savedTheme = loadThemePreference();
  if (savedTheme === 'dark' || savedTheme === 'light') return savedTheme === 'dark';

  return false;
}

const isDarkMode = ref(resolveInitialTheme());

function toggleTheme() {
  isDarkMode.value = !isDarkMode.value;
}

function applyTheme(value) {
  if (typeof document === 'undefined') return;

  document.documentElement.classList.toggle('dark', value);
  saveThemePreference(value ? 'dark' : 'light');
}

watch(isDarkMode, applyTheme, { immediate: true });

export function useTheme() {
  return {
    isDarkMode,
    toggleTheme,
  };
}
