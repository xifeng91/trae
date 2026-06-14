import http from './http';

export function fetchNews() {
  return http.get('/news');
}

export function refreshNews() {
  return http.post('/refresh');
}

export function fetchStatus() {
  return http.get('/status');
}
