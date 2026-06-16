import http, { buildApiUrl } from './http';

const ONLINE_SEARCH_TIMEOUT_MS = Number(import.meta.env.VITE_ONLINE_SEARCH_TIMEOUT_MS) || 30000;

export function fetchNews(params = {}) {
  return http.get('/news', { params });
}

export function fetchNewsDetail(newsId) {
  return http.get(`/news/${encodeURIComponent(newsId)}`);
}

export function fetchLocalSearch(params = {}) {
  return http.get('/search/local', { params });
}

export function fetchOnlineSearch(params = {}) {
  return http.get('/search/online', {
    params,
    timeout: ONLINE_SEARCH_TIMEOUT_MS,
  });
}

export function fetchSearchHistory(params = {}) {
  return http.get('/search/history', { params });
}

export function refreshNews() {
  return http.post('/refresh');
}

export function fetchRefreshStatus() {
  return http.get('/refresh/status');
}

export function fetchHealth() {
  return http.get('/health');
}

export function getInterpretationStreamUrl(newsId, options = {}) {
  const forceQuery = options.force ? '?force=1' : '';
  return buildApiUrl(`/news/${encodeURIComponent(newsId)}/interpretation/stream${forceQuery}`);
}
