import axios from 'axios';

const http = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL || '/api',
  timeout: 8000,
});

export function buildApiUrl(path) {
  const baseURL = import.meta.env.VITE_API_BASE_URL || '/api';
  const normalizedBase = baseURL.endsWith('/') ? baseURL.slice(0, -1) : baseURL;
  const normalizedPath = path.startsWith('/') ? path : `/${path}`;

  if (/^https?:\/\//i.test(normalizedBase)) {
    return `${normalizedBase}${normalizedPath}`;
  }

  return `${normalizedBase}${normalizedPath}`;
}

http.interceptors.response.use(
  (response) => response.data,
  (error) => {
    const normalizedError = {
      message: error.response?.data?.message || error.message || '请求失败',
      status: error.response?.status || 0,
      raw: error,
    };
    return Promise.reject(normalizedError);
  },
);

export default http;
