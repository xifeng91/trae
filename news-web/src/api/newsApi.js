import http, { buildApiUrl } from './http';

export function fetchNews(params = {}) {
  return http.get('/news', { params });
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
