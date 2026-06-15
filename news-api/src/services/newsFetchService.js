const Parser = require('rss-parser');
const env = require('../config/env');
const newsSources = require('../config/newsSources');
const { decodeEntities, stripHtml } = require('../utils/textUtils');

const BLOCKED_IMAGE_PATTERNS = [
  /favicon/i,
  /logo/i,
  /reader/i,
  /rss/i,
  /social-share/i,
  /spacer/i,
  /transparent/i,
  /blank/i,
  /1x1/i,
  /xml\.gif/i,
];

const parser = new Parser({
  timeout: 20000,
  headers: {
    'User-Agent': 'Mozilla/5.0 (compatible; DailyNewsBriefing/1.0)',
    Accept: 'application/rss+xml, application/xml, text/xml, */*',
  },
  customFields: {
    item: [
      ['content:encoded', 'contentEncoded'],
      ['media:content', 'mediaContent', { keepArray: true }],
      ['media:thumbnail', 'mediaThumbnail', { keepArray: true }],
      ['itunes:image', 'itunesImage'],
      ['image', 'image'],
    ],
  },
});

function parseDateValue(value) {
  if (!value) return null;

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;

  return date.toISOString();
}

function resolvePublishedAt(item, source, fetchedAt) {
  const publishedAt = parseDateValue(item.isoDate || item.pubDate || item.date || item.published || item.updated);
  if (publishedAt) return publishedAt;

  return source.useFetchTimeAsPublishedAt ? fetchedAt.toISOString() : '';
}

function resolveSummary(item) {
  return stripHtml(
    item.contentSnippet ||
      item.contentEncodedSnippet ||
      item.summary ||
      item.contentEncoded ||
      item['content:encoded'] ||
      item.content ||
      item.description ||
      item.title ||
      '',
  );
}

function resolveSourceUrl(item) {
  return String(item.link || item.guid || '').trim();
}

function readUrlFromField(value) {
  if (!value) return '';
  if (typeof value === 'string') return value;
  if (Array.isArray(value)) {
    for (const entry of value) {
      const url = readUrlFromField(entry);
      if (url) return url;
    }
    return '';
  }

  return value.url || value.href || value.$?.url || value.$?.href || value.attribs?.url || value.attribs?.src || '';
}

function normalizeImageUrl(value, baseUrl = '') {
  const rawUrl = decodeEntities(String(value || '')).trim();
  if (!rawUrl) return '';

  try {
    const resolvedUrl = new URL(rawUrl, baseUrl || undefined);
    if (!['http:', 'https:'].includes(resolvedUrl.protocol)) return '';

    const href = resolvedUrl.href;
    if (BLOCKED_IMAGE_PATTERNS.some((pattern) => pattern.test(href))) return '';

    return href;
  } catch (error) {
    return '';
  }
}

function extractImageSourcesFromHtml(html = '') {
  const decodedHtml = decodeEntities(html);
  const imageSources = [];
  const imagePattern = /<img\b[^>]*\bsrc=["']?([^"'\s>]+)["']?/gi;
  let match = imagePattern.exec(decodedHtml);

  while (match) {
    imageSources.push(match[1]);
    match = imagePattern.exec(decodedHtml);
  }

  return imageSources;
}

function resolveImageUrl(item, baseUrl) {
  const rawContent = [
    item.image,
    item.enclosure,
    item.mediaContent,
    item.mediaThumbnail,
    item.itunesImage,
    item.contentEncoded,
    item['content:encoded'],
    item.content,
    item.description,
  ];
  const candidates = [
    readUrlFromField(item.image),
    readUrlFromField(item.enclosure),
    readUrlFromField(item.mediaContent),
    readUrlFromField(item.mediaThumbnail),
    readUrlFromField(item.itunesImage),
  ];

  for (const content of rawContent) {
    if (typeof content !== 'string') continue;
    candidates.push(...extractImageSourcesFromHtml(content));
  }

  for (const candidate of candidates) {
    const imageUrl = normalizeImageUrl(candidate, baseUrl);
    if (imageUrl) return imageUrl;
  }

  return '';
}

async function fetchSource(source) {
  try {
    const fetchedAt = new Date();
    const feed = await parser.parseURL(source.url);
    const items = (feed.items || []).slice(0, env.maxItemsPerFeed).map((item) => {
      const title = stripHtml(item.title || '');
      const sourceUrl = resolveSourceUrl(item);

      return {
        title,
        rawSummary: resolveSummary(item),
        source: source.name,
        sourceUrl,
        category: source.category,
        defaultPriority: source.defaultPriority || 'P2',
        publishedAt: resolvePublishedAt(item, source, fetchedAt),
        imageUrl: resolveImageUrl(item, sourceUrl || source.url),
        imageAlt: title,
      };
    });

    const validItems = items.filter((item) => item.title && item.sourceUrl && item.publishedAt);
    console.log(`[抓取] ${source.name}: ${validItems.length} 条`);
    return validItems;
  } catch (error) {
    console.warn(`[抓取] ${source.name} 失败: ${error.message}`);
    return [];
  }
}

async function fetchAllNews() {
  console.log(`[抓取] 开始抓取 ${newsSources.length} 个新闻源`);
  const settledResults = await Promise.allSettled(newsSources.map((source) => fetchSource(source)));

  const items = settledResults.flatMap((result) => {
    if (result.status !== 'fulfilled') return [];
    return result.value;
  });

  console.log(`[抓取] 完成，共 ${items.length} 条候选新闻`);
  return items;
}

module.exports = {
  fetchAllNews,
  fetchSource,
};
