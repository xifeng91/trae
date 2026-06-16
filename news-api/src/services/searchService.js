const env = require('../config/env');
const { ALL_CATEGORY, INVESTMENT_TOPIC } = require('../constants/categories');
const { cleanNewsItems } = require('./newsCleanService');
const { fetchAllNews } = require('./newsFetchService');
const { loadTodayData } = require('./newsStoreService');
const { saveSearchResults } = require('./searchCacheService');
const { buildStableId, limitText, normalizeText, normalizeTitle } = require('../utils/textUtils');

const DEFAULT_SEARCH_PAGE_SIZE = 8;
const MAX_SEARCH_PAGE_SIZE = 24;
const QUERY_MAX_LENGTH = 80;
const SNIPPET_MAX_LENGTH = 150;
const STRONG_RELEVANCE_SCORE = 10;
let onlineCandidateCache = {
  fetchedAt: 0,
  items: [],
};

function normalizeSearchQuery(query = '') {
  return normalizeText(query).slice(0, QUERY_MAX_LENGTH);
}

function normalizeComparableText(text = '') {
  return normalizeText(text).toLowerCase();
}

function normalizeUrlKey(url = '') {
  if (!url) return '';

  try {
    const parsedUrl = new URL(url);
    const removableParams = ['utm_source', 'utm_medium', 'utm_campaign', 'utm_term', 'utm_content', 'spm', 'from', 'source'];

    for (const param of removableParams) {
      parsedUrl.searchParams.delete(param);
    }

    parsedUrl.hash = '';
    return parsedUrl.href.replace(/\/$/, '').toLowerCase();
  } catch (error) {
    return String(url || '').trim().replace(/\/$/, '').toLowerCase();
  }
}

function getSearchTerms(query) {
  const normalizedQuery = normalizeSearchQuery(query);
  if (!normalizedQuery) return [];

  const terms = normalizedQuery.split(/\s+/).filter(Boolean);
  const uniqueTerms = [normalizedQuery, ...terms].reduce((result, term) => {
    const normalizedTerm = term.toLowerCase();
    if (normalizedTerm && !result.includes(normalizedTerm)) result.push(normalizedTerm);
    return result;
  }, []);

  return uniqueTerms.sort((current, next) => next.length - current.length);
}

function mergeRanges(ranges = []) {
  if (!ranges.length) return [];

  return ranges
    .slice()
    .sort((current, next) => current.start - next.start || current.end - next.end)
    .reduce((result, range) => {
      const previous = result[result.length - 1];
      if (!previous || range.start > previous.end) {
        result.push({ ...range });
        return result;
      }

      previous.end = Math.max(previous.end, range.end);
      return result;
    }, []);
}

function findTermRanges(text = '', terms = []) {
  const sourceText = String(text || '');
  const lowerText = sourceText.toLowerCase();
  const ranges = [];

  for (const term of terms) {
    const normalizedTerm = String(term || '').toLowerCase();
    if (!normalizedTerm) continue;

    let startIndex = 0;
    while (startIndex < lowerText.length) {
      const matchIndex = lowerText.indexOf(normalizedTerm, startIndex);
      if (matchIndex === -1) break;

      ranges.push({
        start: matchIndex,
        end: matchIndex + normalizedTerm.length,
      });
      startIndex = matchIndex + Math.max(normalizedTerm.length, 1);
    }
  }

  return mergeRanges(ranges);
}

function findSequentialRanges(text = '', query = '') {
  if (!/[\u4e00-\u9fa5]/.test(query)) return [];

  const sourceText = normalizeText(text);
  const searchText = sourceText.toLowerCase();
  const characters = normalizeComparableText(query).replace(/\s+/g, '').split('');
  if (characters.length < 2) return [];

  const ranges = [];
  let cursor = 0;

  for (const character of characters) {
    const matchIndex = searchText.indexOf(character, cursor);
    if (matchIndex === -1) return [];

    ranges.push({
      start: matchIndex,
      end: matchIndex + character.length,
    });
    cursor = matchIndex + character.length;
  }

  return mergeRanges(ranges);
}

function buildHighlightSegments(text = '', ranges = []) {
  const sourceText = String(text || '');
  if (!sourceText) return [];
  if (!ranges.length) return [{ text: sourceText, matched: false }];

  const segments = [];
  let cursor = 0;

  for (const range of ranges) {
    if (range.start > cursor) {
      segments.push({
        text: sourceText.slice(cursor, range.start),
        matched: false,
      });
    }

    segments.push({
      text: sourceText.slice(range.start, range.end),
      matched: true,
    });
    cursor = range.end;
  }

  if (cursor < sourceText.length) {
    segments.push({
      text: sourceText.slice(cursor),
      matched: false,
    });
  }

  return segments.filter((segment) => segment.text);
}

function buildSnippet(text = '', ranges = []) {
  const sourceText = normalizeText(text);
  if (!sourceText) {
    return {
      text: '',
      ranges: [],
      segments: [],
    };
  }

  if (!ranges.length) {
    const snippetText = limitText(sourceText, SNIPPET_MAX_LENGTH);
    return {
      text: snippetText,
      ranges: [],
      segments: buildHighlightSegments(snippetText),
    };
  }

  const firstRange = ranges[0];
  const leadingLength = Math.max(0, Math.floor((SNIPPET_MAX_LENGTH - (firstRange.end - firstRange.start)) / 2));
  const start = Math.max(0, firstRange.start - leadingLength);
  const end = Math.min(sourceText.length, start + SNIPPET_MAX_LENGTH);
  const prefix = start > 0 ? '...' : '';
  const suffix = end < sourceText.length ? '...' : '';
  const snippetText = `${prefix}${sourceText.slice(start, end)}${suffix}`;
  const adjustedRanges = ranges
    .map((range) => ({
      start: range.start - start + prefix.length,
      end: range.end - start + prefix.length,
    }))
    .filter((range) => range.end > prefix.length && range.start < snippetText.length - suffix.length)
    .map((range) => ({
      start: Math.max(0, range.start),
      end: Math.min(snippetText.length, range.end),
    }));

  return {
    text: snippetText,
    ranges: adjustedRanges,
    segments: buildHighlightSegments(snippetText, adjustedRanges),
  };
}

function getFieldMatch(fieldText, terms, query) {
  const termRanges = findTermRanges(fieldText, terms);
  if (termRanges.length) {
    return {
      ranges: termRanges,
      fuzzy: false,
    };
  }

  const fuzzyRanges = findSequentialRanges(fieldText, query);
  return {
    ranges: fuzzyRanges,
    fuzzy: fuzzyRanges.length > 0,
  };
}

function getItemTimestamp(item = {}) {
  const timestamp = new Date(item.publishedAt || `${item.date || ''}T${item.time || '00:00'}:00`).getTime();
  return Number.isNaN(timestamp) ? 0 : timestamp;
}

function getLocalDuplicateMaps(items = []) {
  const urlMap = new Map();
  const titleMap = new Map();

  for (const item of items) {
    const urlKey = normalizeUrlKey(item.sourceUrl);
    const titleKey = normalizeTitle(item.title);
    if (urlKey) urlMap.set(urlKey, item);
    if (titleKey) titleMap.set(titleKey, item);
  }

  return {
    urlMap,
    titleMap,
  };
}

function isSimilarTitle(titleA, titleB) {
  const normalizedA = normalizeTitle(titleA);
  const normalizedB = normalizeTitle(titleB);

  if (!normalizedA || !normalizedB) return false;
  if (normalizedA === normalizedB) return true;

  const shorter = normalizedA.length <= normalizedB.length ? normalizedA : normalizedB;
  const longer = normalizedA.length > normalizedB.length ? normalizedA : normalizedB;
  if (shorter.length < 8) return false;

  let matchCount = 0;
  for (const character of shorter) {
    if (longer.includes(character)) matchCount += 1;
  }

  return matchCount / shorter.length >= 0.85;
}

function findDuplicateLocalItem(item, localItems = [], maps = getLocalDuplicateMaps(localItems)) {
  const urlKey = normalizeUrlKey(item.sourceUrl);
  if (urlKey && maps.urlMap.has(urlKey)) return maps.urlMap.get(urlKey);

  const titleKey = normalizeTitle(item.title);
  if (titleKey && maps.titleMap.has(titleKey)) return maps.titleMap.get(titleKey);

  return localItems.find((localItem) => isSimilarTitle(localItem.title, item.title)) || null;
}

function isCategoryMatched(item = {}, category = ALL_CATEGORY) {
  if (category === ALL_CATEGORY) return true;
  if (category === INVESTMENT_TOPIC) return Array.isArray(item.topics) && item.topics.includes(INVESTMENT_TOPIC);
  return item.category === category;
}

function sanitizeSearchItem(item, match) {
  const snippet = buildSnippet(match.snippetSource, match.snippetRanges);

  return {
    id: item.id,
    title: item.title,
    category: item.category,
    topics: Array.isArray(item.topics) ? item.topics : [],
    overview: item.overview || '',
    searchSnippet: snippet.text || item.overview || '',
    source: item.source,
    sourceUrl: item.sourceUrl || '',
    imageUrl: item.imageUrl || '',
    imageAlt: item.imageAlt || item.title || '',
    publishedAt: item.publishedAt || '',
    date: item.date || '',
    time: item.time || '',
    priority: item.priority || 'P2',
    origin: item.origin || 'local',
    originLabel: item.originLabel || (item.origin === 'web' ? '联网补充' : '本地已收录'),
    relevance: item.relevance || 'weak',
    searchCachedAt: item.searchCachedAt || '',
    matchedFields: match.matchedFields,
    highlights: {
      title: buildHighlightSegments(item.title, match.titleRanges),
      overview: buildHighlightSegments(item.overview || '', match.overviewRanges),
      snippet: snippet.segments,
    },
  };
}

function matchNewsItem(item, terms, query) {
  const titleMatch = getFieldMatch(item.title, terms, query);
  const overviewMatch = getFieldMatch(item.overview, terms, query);
  const bodyText = item.rawSummary || item.content || item.overview || '';
  const bodyMatch = getFieldMatch(bodyText, terms, query);
  const matchedFields = [];
  let score = 0;

  if (titleMatch.ranges.length) {
    matchedFields.push('title');
    score += titleMatch.fuzzy ? 6 : 12;
  }

  if (overviewMatch.ranges.length) {
    matchedFields.push('overview');
    score += overviewMatch.fuzzy ? 3 : 6;
  }

  if (bodyMatch.ranges.length) {
    matchedFields.push('content');
    score += bodyMatch.fuzzy ? 2 : 4;
  }

  if (!score) return null;

  const snippetSource = bodyMatch.ranges.length ? bodyText : item.overview || bodyText || item.title;
  const snippetRanges = bodyMatch.ranges.length ? bodyMatch.ranges : overviewMatch.ranges;

  return {
    score,
    titleRanges: titleMatch.ranges,
    overviewRanges: overviewMatch.ranges,
    snippetSource,
    snippetRanges,
    matchedFields,
  };
}

function buildSearchMatch(item, terms, query) {
  const match = matchNewsItem(item, terms, query);
  if (!match) return null;

  const hasStrongTitleMatch = match.matchedFields.includes('title') && findTermRanges(item.title, [normalizeSearchQuery(query)]).length > 0;
  const relevance = hasStrongTitleMatch || match.score >= STRONG_RELEVANCE_SCORE ? 'strong' : 'weak';

  return {
    ...match,
    relevance,
  };
}

function buildSearchCacheId(item = {}) {
  const publishedDate = item.date || (item.publishedAt ? String(item.publishedAt).slice(0, 10) : 'search');
  const idHash = buildStableId([item.sourceUrl, item.source, item.title, item.publishedAt]);
  return `search-${publishedDate.replace(/-/g, '')}-${idHash}`;
}

function toSearchCacheItem(item, options = {}) {
  return {
    ...item,
    id: options.id || item.id || buildSearchCacheId(item),
    origin: options.origin || item.origin || 'web',
    originLabel: options.originLabel || item.originLabel || (options.origin === 'local' ? '本地已收录' : '联网补充'),
    relevance: options.relevance || item.relevance || 'weak',
  };
}

function getDisplayMatch(item, terms, query, fallbackMatch) {
  const displayMatch = buildSearchMatch(item, terms, query);
  if (displayMatch) {
    return {
      ...displayMatch,
      score: Math.max(displayMatch.score, fallbackMatch?.score || 0),
      relevance: fallbackMatch?.relevance || displayMatch.relevance,
    };
  }

  return {
    ...(fallbackMatch || {}),
    titleRanges: [],
    overviewRanges: [],
    snippetSource: item.overview || item.rawSummary || item.title || '',
    snippetRanges: [],
    matchedFields: fallbackMatch?.matchedFields || [],
  };
}

function getRankingGroup(item) {
  if (item.origin === 'web' && item.relevance === 'strong') return 0;
  if (item.origin === 'web') return 1;
  if (item.relevance === 'strong') return 2;
  return 3;
}

function dedupeSearchResults(items = []) {
  const uniqueItems = [];
  const seenIds = new Set();
  const seenUrls = new Set();

  for (const item of items) {
    const urlKey = normalizeUrlKey(item.sourceUrl);
    if (item.id && seenIds.has(item.id)) continue;
    if (urlKey && seenUrls.has(urlKey)) continue;
    if (uniqueItems.some((existingItem) => isSimilarTitle(existingItem.title, item.title))) continue;

    uniqueItems.push(item);
    if (item.id) seenIds.add(item.id);
    if (urlKey) seenUrls.add(urlKey);
  }

  return uniqueItems;
}

async function getOnlineCandidateItems(limit) {
  const now = Date.now();
  const maxAge = env.onlineSearchCacheMinutes * 60 * 1000;

  if (onlineCandidateCache.items.length > 0 && now - onlineCandidateCache.fetchedAt <= maxAge) {
    return onlineCandidateCache.items;
  }

  const rawItems = await fetchAllNews();
  const cleanItems = cleanNewsItems(rawItems, {
    maxPerCategory: Math.max(env.maxNewsPerCategory, limit),
    retentionHours: 24 * 365 * 5,
  });

  onlineCandidateCache = {
    fetchedAt: now,
    items: cleanItems,
  };

  return cleanItems;
}

function searchLocalNews(query = {}) {
  const searchQuery = normalizeSearchQuery(query.q || query.query || '');
  const category = query.category || ALL_CATEGORY;
  const page = Math.max(Number(query.page) || 1, 1);
  const pageSize = Math.min(Math.max(Number(query.pageSize) || DEFAULT_SEARCH_PAGE_SIZE, 1), MAX_SEARCH_PAGE_SIZE);
  const data = loadTodayData();

  if (!searchQuery) {
    return {
      mode: 'local',
      query: searchQuery,
      date: data.date,
      updatedAt: data.updatedAt,
      isRefreshing: false,
      pagination: {
        page,
        pageSize,
        total: 0,
      },
      items: [],
      message: '请输入搜索关键词',
    };
  }

  const terms = getSearchTerms(searchQuery);
  const matchedItems = data.items
    .filter((item) => isCategoryMatched(item, category))
    .map((item) => {
      const match = buildSearchMatch(item, terms, searchQuery);
      if (!match) return null;

      return {
        item,
        match,
        timestamp: getItemTimestamp(item),
      };
    })
    .filter(Boolean)
    .sort((current, next) => next.match.score - current.match.score || next.timestamp - current.timestamp);

  const startIndex = (page - 1) * pageSize;
  const pageItems = matchedItems.slice(startIndex, startIndex + pageSize).map(({ item, match }) => sanitizeSearchItem(item, match));

  saveSearchResults(searchQuery, matchedItems.slice(0, env.searchResultLimit).map(({ item, match }) => sanitizeSearchItem(item, match)), {
    mode: 'local',
  });

  return {
    mode: 'local',
    query: searchQuery,
    category,
    date: data.date,
    updatedAt: data.updatedAt,
    isRefreshing: false,
    pagination: {
      page,
      pageSize,
      total: matchedItems.length,
    },
    items: pageItems,
    message: matchedItems.length ? '' : '没有找到匹配的新闻',
  };
}

async function searchOnlineNews(query = {}) {
  const searchQuery = normalizeSearchQuery(query.q || query.query || '');
  const limit = Math.min(Math.max(Number(query.limit) || env.searchResultLimit, 1), env.searchResultLimit);
  const localData = loadTodayData();

  if (!searchQuery) {
    return {
      mode: 'online',
      query: searchQuery,
      limit,
      total: 0,
      items: [],
      message: '请输入搜索关键词',
    };
  }

  const terms = getSearchTerms(searchQuery);
  const localMaps = getLocalDuplicateMaps(localData.items);
  const cleanItems = await getOnlineCandidateItems(limit);

  const onlineMatches = cleanItems
    .map((item) => {
      const match = buildSearchMatch(item, terms, searchQuery);
      if (!match) return null;

      const duplicateLocalItem = findDuplicateLocalItem(item, localData.items, localMaps);
      const resultItem = duplicateLocalItem
        ? toSearchCacheItem(duplicateLocalItem, {
            origin: 'local',
            originLabel: '本地已收录',
            relevance: match.relevance,
          })
        : toSearchCacheItem(item, {
            origin: 'web',
            originLabel: '联网补充',
            relevance: match.relevance,
          });
      const displayMatch = getDisplayMatch(resultItem, terms, searchQuery, match);

      return {
        item: resultItem,
        match: displayMatch,
        timestamp: getItemTimestamp(resultItem),
      };
    })
    .filter(Boolean);

  const matchedOnlineIds = new Set(onlineMatches.map(({ item }) => item.id));
  const localMatches = localData.items
    .map((item) => {
      if (matchedOnlineIds.has(item.id)) return null;
      const match = buildSearchMatch(item, terms, searchQuery);
      if (!match) return null;

      return {
        item: toSearchCacheItem(item, {
          origin: 'local',
          originLabel: '本地已收录',
          relevance: match.relevance,
        }),
        match,
        timestamp: getItemTimestamp(item),
      };
    })
    .filter(Boolean);

  const rankedResults = dedupeSearchResults(
    [...onlineMatches, ...localMatches]
      .sort((current, next) => {
        const groupDiff = getRankingGroup(current.item) - getRankingGroup(next.item);
        if (groupDiff !== 0) return groupDiff;
        return next.match.score - current.match.score || next.timestamp - current.timestamp;
      })
      .map(({ item, match }) => sanitizeSearchItem(item, match)),
  ).slice(0, limit);

  saveSearchResults(searchQuery, rankedResults, {
    mode: 'online',
  });

  return {
    mode: 'online',
    query: searchQuery,
    limit,
    total: rankedResults.length,
    retentionDays: env.searchHistoryRetentionDays,
    items: rankedResults,
    message: rankedResults.length ? '' : '没有找到匹配的新闻',
  };
}

module.exports = {
  searchOnlineNews,
  searchLocalNews,
};
