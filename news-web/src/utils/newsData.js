import { CATEGORY_OPTIONS } from './categories';
import { getRenderableImageUrl } from './images';

export const DEFAULT_NEWS_PAGE_SIZE = 8;
export const DETAIL_NEWS_PAGE_SIZE = 24;

function getNewsTimestamp(item) {
  if (item?.publishedAt) {
    const publishedTimestamp = new Date(item.publishedAt).getTime();
    if (!Number.isNaN(publishedTimestamp)) return publishedTimestamp;
  }

  const dateText = item?.date || '';
  const timeText = item?.time || '';
  const normalizedTime = /^\d{1,2}:\d{2}$/.test(timeText) ? timeText : '00:00';
  const date = dateText ? new Date(`${dateText}T${normalizedTime}:00`) : new Date(timeText);
  const timestamp = date.getTime();

  return Number.isNaN(timestamp) ? 0 : timestamp;
}

export function sortNewsByDateTime(newsItems = []) {
  return newsItems
    .map((item, index) => ({
      item,
      index,
      timestamp: getNewsTimestamp(item),
    }))
    .sort((current, next) => next.timestamp - current.timestamp || current.index - next.index)
    .map(({ item }) => item);
}

export function normalizeNewsItem(item = {}) {
  return {
    ...item,
    overview: item.overview || item.summary || item.shortSummary || item.rawSummary || item.title || '',
    imageUrl: getRenderableImageUrl(item.imageUrl),
    imageAlt: item.imageAlt || item.title || '',
    topics: Array.isArray(item.topics) ? item.topics : [],
    interpretation: item.interpretation || '',
    interpretationStatus: item.interpretationStatus || item.aiStatus || 'pending',
    signals: Array.isArray(item.signals) ? item.signals : [],
  };
}

export function normalizeNewsResponse(data) {
  const items = data?.items || data?.news || [];

  return {
    date: data?.date || '',
    updatedAt: data?.updatedAt || null,
    retentionHours: data?.retentionHours || 24,
    windowStartAt: data?.windowStartAt || '',
    windowEndAt: data?.windowEndAt || '',
    isRefreshing: Boolean(data?.isRefreshing),
    categories: data?.categories || CATEGORY_OPTIONS.filter((item) => item.value !== '全部').map((item) => item.value),
    counts: data?.counts || null,
    pagination: data?.pagination || {
      page: 1,
      pageSize: DEFAULT_NEWS_PAGE_SIZE,
      total: items.length,
    },
    items: items.map(normalizeNewsItem),
    message: data?.message || '',
  };
}

export function findNewsItemById(data, newsId) {
  const normalizedId = String(newsId || '');
  if (!normalizedId) return null;

  return normalizeNewsResponse(data).items.find((item) => item.id === normalizedId) || null;
}

export function getNewsDetailContent(news = {}) {
  return news.rawSummary || news.content || news.overview || news.summary || news.shortSummary || news.title || '';
}
