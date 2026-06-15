const env = require('../config/env');
const { CATEGORY_VALUES, INVESTMENT_TOPIC, PRIORITY_ORDER, TOPIC_VALUES } = require('../constants/categories');
const { getDateKey, getTimeText, subtractHours, toDate } = require('../utils/dateUtils');
const { buildStableId, limitText, normalizeText, normalizeTitle, stripHtml } = require('../utils/textUtils');

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

const INVESTMENT_KEYWORDS = [
  'A股',
  '港股',
  '美股',
  '股市',
  '沪指',
  '恒指',
  '纳指',
  '标普',
  '黄金',
  '金价',
  '原油',
  '油价',
  '美债',
  '汇率',
  '基金',
  '债券',
  'ETF',
  '期货',
  '央行',
  '美联储',
  '降息',
  '加息',
  'CPI',
  '非农',
  '通胀',
  '财报',
  'IPO',
  '并购',
];

const INVESTMENT_CONTEXT_KEYWORDS = ['汇率', '兑', '走强', '走弱', '升值', '贬值', '指数', '离岸', '在岸'];
const INVESTMENT_CURRENCY_KEYWORDS = ['美元', '人民币'];

const CATEGORY_KEYWORD_RULES = [
  {
    category: '社会',
    keywords: [
      '民生',
      '教育',
      '学校',
      '高校',
      '中考',
      '高考',
      '医疗',
      '医院',
      '医生',
      '医保',
      '交通',
      '地铁',
      '高铁',
      '铁路',
      '航班',
      '充电宝',
      '食品安全',
      '市场监管',
      '消费维权',
      '维权',
      '事故',
      '火灾',
      '灾害',
      '台风',
      '暴雨',
      '住房',
      '养老',
      '就业',
      '社保',
      '公共安全',
      '警方',
      '法院',
      '检察',
      '未成年人',
    ],
  },
  {
    category: '商业',
    keywords: [
      '公司',
      '品牌',
      '消费',
      '零售',
      '餐饮',
      '电商',
      '外卖',
      '商业',
      '供应链',
      '融资',
      '上市',
      'IPO',
      '并购',
      '收购',
      '财报',
      '营收',
      '利润',
      '裁员',
      '门店',
      '车企',
      '新能源车',
      '物流',
      '酒店',
      '旅游',
      '港交所',
      '聆讯',
    ],
  },
];

function includesAnyKeyword(text, keywords = []) {
  const normalizedText = String(text || '').toUpperCase();
  return keywords.some((keyword) => normalizedText.includes(String(keyword).toUpperCase()));
}

function buildClassifyText(item = {}) {
  return `${item.title || ''} ${item.rawSummary || ''}`;
}

function resolveCategory(item) {
  const titleText = item.title || '';
  const rule = CATEGORY_KEYWORD_RULES.find((entry) => includesAnyKeyword(titleText, entry.keywords));

  return rule?.category || item.category;
}

function resolveTopics(item) {
  const classifyText = buildClassifyText(item);
  const titleText = item.title || '';
  const topics = new Set(Array.isArray(item.topics) ? item.topics.filter((topic) => TOPIC_VALUES.includes(topic)) : []);
  const hasInvestmentKeyword = includesAnyKeyword(classifyText, INVESTMENT_KEYWORDS);
  const hasInvestmentCurrencyContext =
    includesAnyKeyword(titleText, INVESTMENT_CURRENCY_KEYWORDS) ||
    (includesAnyKeyword(classifyText, INVESTMENT_CURRENCY_KEYWORDS) && includesAnyKeyword(classifyText, INVESTMENT_CONTEXT_KEYWORDS));

  if (hasInvestmentKeyword || hasInvestmentCurrencyContext) {
    topics.add(INVESTMENT_TOPIC);
  }

  return [...topics];
}

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

function buildOverview(item, cleanTitle) {
  const rawText = normalizeText(item.rawSummary || '');
  if (!rawText) return cleanTitle;
  if (rawText.includes(cleanTitle) || cleanTitle.includes(rawText)) return limitText(rawText || cleanTitle, 300);

  return limitText(`${cleanTitle}。${rawText}`, 300);
}

function parsePublishedAt(value) {
  const publishedAt = new Date(value);
  if (Number.isNaN(publishedAt.getTime())) return null;

  return publishedAt;
}

function normalizeItem(item) {
  const priority = calcPriority(item);
  const cleanTitle = limitText(item.title, 80);
  const sourceUrl = item.sourceUrl || '';
  const publishedAt = parsePublishedAt(item.publishedAt).toISOString();
  const dateKey = getDateKey(publishedAt);
  const category = resolveCategory(item);
  const topics = resolveTopics(item);
  const idHash = buildStableId([category, item.source, sourceUrl, cleanTitle]);
  const overview = buildOverview(item, cleanTitle);

  return {
    id: `${dateKey.replace(/-/g, '')}-${category}-${idHash}`,
    title: cleanTitle,
    category,
    topics,
    overview,
    interpretation: '',
    interpretationStatus: 'pending',
    analysisType: '',
    signals: [],
    source: item.source,
    sourceUrl,
    imageUrl: item.imageUrl || '',
    imageAlt: item.imageAlt || cleanTitle,
    publishedAt,
    priority,
    aiStatus: 'pending',
    date: dateKey,
    time: buildDisplayTime(item.publishedAt),
    rawSummary: limitText(stripHtml(item.rawSummary || cleanTitle), 600),
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
  const maxPerCategory = options.maxPerCategory || env.maxNewsPerCategory;
  const retentionHours = options.retentionHours || env.newsRetentionHours;
  const windowEnd = toDate(options.now || new Date());
  const windowStart = subtractHours(windowEnd, retentionHours);

  const windowItems = rawItems.filter((item) => {
    if (!CATEGORY_VALUES.includes(item.category)) return false;
    const publishedAt = parsePublishedAt(item.publishedAt);
    if (!publishedAt) return false;

    return publishedAt >= windowStart && publishedAt <= windowEnd;
  });

  const uniqueItems = dedupeItems(windowItems);
  const normalizedItems = uniqueItems.map((item) => normalizeItem(item)).sort(sortByPriorityAndTime);

  const selectedItems = CATEGORY_VALUES.flatMap((category) =>
    normalizedItems.filter((item) => item.category === category).slice(0, maxPerCategory),
  ).sort(sortByPriorityAndTime);

  console.log(`[清洗] 过去 ${retentionHours} 小时 ${windowItems.length} 条，去重后 ${uniqueItems.length} 条，保留 ${selectedItems.length} 条`);
  return selectedItems;
}

function buildCounts(items) {
  const counts = {
    total: items.length,
  };

  for (const category of CATEGORY_VALUES) {
    counts[category] = items.filter((item) => item.category === category).length;
  }

  for (const topic of TOPIC_VALUES) {
    counts[topic] = items.filter((item) => Array.isArray(item.topics) && item.topics.includes(topic)).length;
  }

  return counts;
}

module.exports = {
  buildCounts,
  cleanNewsItems,
};
