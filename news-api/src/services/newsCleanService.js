const env = require('../config/env');
const { CATEGORY_VALUES, PRIORITY_ORDER } = require('../constants/categories');
const { getDateKey, getTimeText, toDate } = require('../utils/dateUtils');
const { buildStableId, limitText, normalizeTitle, stripHtml } = require('../utils/textUtils');

const PRIORITY_KEYWORDS = {
  P0: [
    '习近平',
    '总书记',
    '国务院',
    '全国人大',
    '政治局',
    '突发',
    '紧急',
    '地震',
    '战争',
    '停火',
    '央行',
    '降准',
    '降息',
    '加息',
    '峰会',
    '重大',
    '历史性',
    '里程碑',
  ],
  P1: [
    '政策',
    '改革',
    '发布',
    '出台',
    '规划',
    '贸易',
    '出口',
    '投资',
    '市场',
    '股市',
    'AI',
    '人工智能',
    '芯片',
    '量子',
    '航天',
    '医保',
    '教育',
    '住房',
    '养老',
  ],
};

function calcPriority(item) {
  const text = `${item.title}${item.rawSummary || ''}`;

  if (PRIORITY_KEYWORDS.P0.some((keyword) => text.includes(keyword))) return 'P0';
  if (PRIORITY_KEYWORDS.P1.some((keyword) => text.includes(keyword))) return 'P1';

  return item.defaultPriority || 'P2';
}

function isSimilarTitle(titleA, titleB) {
  const normalizedA = normalizeTitle(titleA);
  const normalizedB = normalizeTitle(titleB);

  if (!normalizedA || !normalizedB) return false;
  if (normalizedA === normalizedB) return true;

  const shorter = normalizedA.length <= normalizedB.length ? normalizedA : normalizedB;
  const longer = normalizedA.length > normalizedB.length ? normalizedA : normalizedB;
  if (shorter.length < 10) return false;

  let matchCount = 0;
  for (const char of shorter) {
    if (longer.includes(char)) matchCount += 1;
  }

  return matchCount / shorter.length > 0.72;
}

function sortByPriorityAndTime(current, next) {
  const priorityDiff = (PRIORITY_ORDER[current.priority] ?? 2) - (PRIORITY_ORDER[next.priority] ?? 2);
  if (priorityDiff !== 0) return priorityDiff;
  return toDate(next.publishedAt).getTime() - toDate(current.publishedAt).getTime();
}

function buildDisplayTime(publishedAt) {
  return getTimeText(publishedAt);
}

function normalizeItem(item, todayKey) {
  const priority = calcPriority(item);
  const cleanTitle = limitText(item.title, 80);
  const sourceUrl = item.sourceUrl || '';
  const idHash = buildStableId([todayKey, item.category, item.source, sourceUrl, cleanTitle]);

  return {
    id: `${todayKey.replace(/-/g, '')}-${item.category}-${idHash}`,
    title: cleanTitle,
    category: item.category,
    summary: limitText(item.rawSummary || cleanTitle, 80),
    interpretation: '',
    source: item.source,
    sourceUrl,
    publishedAt: toDate(item.publishedAt).toISOString(),
    priority,
    aiStatus: 'pending',
    date: todayKey,
    time: buildDisplayTime(item.publishedAt),
    rawSummary: limitText(stripHtml(item.rawSummary || cleanTitle), 220),
  };
}

function dedupeItems(items) {
  const uniqueItems = [];
  const seenUrls = new Set();

  for (const item of items) {
    const sourceUrl = item.sourceUrl || '';
    if (sourceUrl && seenUrls.has(sourceUrl)) continue;

    const duplicate = uniqueItems.some((existingItem) => isSimilarTitle(existingItem.title, item.title));
    if (duplicate) continue;

    uniqueItems.push(item);
    if (sourceUrl) seenUrls.add(sourceUrl);
  }

  return uniqueItems;
}

function cleanNewsItems(rawItems, options = {}) {
  const todayKey = options.todayKey || getDateKey();
  const maxPerCategory = options.maxPerCategory || env.maxNewsPerCategory;

  const todayItems = rawItems.filter((item) => {
    if (!CATEGORY_VALUES.includes(item.category)) return false;
    return getDateKey(item.publishedAt) === todayKey;
  });

  const uniqueItems = dedupeItems(todayItems);
  const normalizedItems = uniqueItems.map((item) => normalizeItem(item, todayKey)).sort(sortByPriorityAndTime);

  const selectedItems = CATEGORY_VALUES.flatMap((category) =>
    normalizedItems.filter((item) => item.category === category).slice(0, maxPerCategory),
  ).sort(sortByPriorityAndTime);

  console.log(`[清洗] 当天 ${todayItems.length} 条，去重后 ${uniqueItems.length} 条，保留 ${selectedItems.length} 条`);
  return selectedItems;
}

function buildCounts(items) {
  const counts = {
    total: items.length,
  };

  for (const category of CATEGORY_VALUES) {
    counts[category] = items.filter((item) => item.category === category).length;
  }

  return counts;
}

module.exports = {
  buildCounts,
  cleanNewsItems,
};
