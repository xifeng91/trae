const STORAGE_KEY = 'daily_news_briefing';
const THEME_STORAGE_KEY = 'daily_news_theme';

export function saveNewsCache(data) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  } catch (error) {
    // LocalStorage 可能因隐私模式或容量限制不可用，忽略即可。
  }
}

export function loadNewsCache() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch (error) {
    return null;
  }
}

export function saveThemePreference(theme) {
  try {
    localStorage.setItem(THEME_STORAGE_KEY, theme);
  } catch (error) {
    // LocalStorage 不可用时只影响主题持久化，不阻塞页面使用。
  }
}

export function loadThemePreference() {
  try {
    return localStorage.getItem(THEME_STORAGE_KEY);
  } catch (error) {
    return null;
  }
}
