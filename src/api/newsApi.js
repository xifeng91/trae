import http from './http';

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
