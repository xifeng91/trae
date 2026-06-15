const Parser = require('rss-parser');
const env = require('../config/env');
const newsSources = require('../config/newsSources');
const { stripHtml } = require('../utils/textUtils');

const parser = new Parser({
  timeout: 20000,
  headers: {
    'User-Agent': 'Mozilla/5.0 (compatible; DailyNewsBriefing/1.0)',
    Accept: 'application/rss+xml, application/xml, text/xml, */*',
  },
});

function resolvePublishedAt(item) {
  return item.isoDate || item.pubDate || item.date || new Date().toISOString();
}

function resolveSummary(item) {
  return stripHtml(item.contentSnippet || item.summary || item.content || item.description || item.title || '');
}

function resolveSourceUrl(item) {
  return String(item.link || item.guid || '').trim();
}

async function fetchSource(source) {
  try {
    const feed = await parser.parseURL(source.url);
    const items = (feed.items || []).slice(0, env.maxItemsPerFeed).map((item) => ({
      title: stripHtml(item.title || ''),
      rawSummary: resolveSummary(item),
      source: source.name,
      sourceUrl: resolveSourceUrl(item),
      category: source.category,
      defaultPriority: source.defaultPriority || 'P2',
      publishedAt: resolvePublishedAt(item),
    }));

    const validItems = items.filter((item) => item.title && item.sourceUrl);
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
