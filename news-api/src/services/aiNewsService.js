const axios = require('axios');
const env = require('../config/env');
const { limitText } = require('../utils/textUtils');

function hasAiConfig() {
  return Boolean(env.deepseekApiKey);
}

function buildFallbackResult(newsItem, status = 'fallback') {
  const baseText = newsItem.rawSummary || newsItem.summary || newsItem.title;

  return {
    ...newsItem,
    summary: limitText(baseText, 80),
    interpretation: limitText(baseText || '这条新闻来自公开新闻源，可点击原文查看详情。', 150),
    aiStatus: status,
  };
}

function parseJsonFromContent(content) {
  const cleanContent = String(content || '')
    .replace(/^```json\s*/i, '')
    .replace(/^```\s*/i, '')
    .replace(/```$/i, '')
    .trim();

  try {
    return JSON.parse(cleanContent);
  } catch (error) {
    const match = cleanContent.match(/\{[\s\S]*\}/);
    if (!match) return null;

    try {
      return JSON.parse(match[0]);
    } catch (innerError) {
      return null;
    }
  }
}

function buildPrompt(newsItem) {
  return `请基于下面这条真实新闻生成适合个人快速浏览的内容。

要求：
1. 只输出 JSON，不要 Markdown，不要解释。
2. summary 是一句话概括，控制在 80 个中文字符以内。
3. interpretation 是 AI 解读，控制在 150 个中文字符以内，语言通俗、直接、有信息量。
4. 不要编造新闻事实，不要加入原文没有的信息。

新闻标题：${newsItem.title}
新闻来源：${newsItem.source}
新闻分类：${newsItem.category}
原始摘要：${newsItem.rawSummary || newsItem.summary || '无'}

输出格式：
{"summary":"...","interpretation":"..."}`;
}

async function analyzeNewsItem(newsItem) {
  if (!hasAiConfig()) {
    return buildFallbackResult(newsItem);
  }

  try {
    const response = await axios.post(
      env.deepseekApiUrl,
      {
        model: env.aiModel,
        messages: [
          {
            role: 'system',
            content: '你是新闻编辑助手，擅长把真实新闻压缩成简洁、准确、通俗的中文概括和解读。',
          },
          {
            role: 'user',
            content: buildPrompt(newsItem),
          },
        ],
        max_tokens: 500,
        temperature: 0.3,
      },
      {
        headers: {
          Authorization: `Bearer ${env.deepseekApiKey}`,
          'Content-Type': 'application/json',
        },
        timeout: 30000,
      },
    );

    const content = response.data?.choices?.[0]?.message?.content;
    const parsed = parseJsonFromContent(content);

    if (!parsed?.summary || !parsed?.interpretation) {
      throw new Error('AI 返回格式不完整');
    }

    return {
      ...newsItem,
      summary: limitText(parsed.summary, 80),
      interpretation: limitText(parsed.interpretation, 150),
      aiStatus: 'success',
    };
  } catch (error) {
    console.warn(`[AI] ${newsItem.title.slice(0, 24)} 处理失败: ${error.message}`);
    return buildFallbackResult(newsItem, 'failed');
  }
}

function buildExistingItemMap(existingItems = []) {
  const itemMap = new Map();

  for (const item of existingItems) {
    if (!item?.summary || !item?.interpretation || item.aiStatus !== 'success') continue;
    if (item.sourceUrl) itemMap.set(`url:${item.sourceUrl}`, item);
    itemMap.set(`title:${item.title}`, item);
  }

  return itemMap;
}

function reuseExistingAnalysis(newsItem, itemMap) {
  const existingItem = itemMap.get(`url:${newsItem.sourceUrl}`) || itemMap.get(`title:${newsItem.title}`);
  if (!existingItem) return null;

  return {
    ...newsItem,
    summary: existingItem.summary,
    interpretation: existingItem.interpretation,
    aiStatus: existingItem.aiStatus,
  };
}

async function enrichNewsItems(newsItems, options = {}) {
  const existingItemMap = buildExistingItemMap(options.existingItems);
  const results = new Array(newsItems.length);
  const queue = newsItems.map((item, index) => ({ item, index }));
  const workerCount = Math.min(env.aiConcurrency, queue.length || 1);

  console.log(`[AI] 开始处理 ${newsItems.length} 条新闻，并发 ${workerCount}`);

  async function worker() {
    while (queue.length > 0) {
      const task = queue.shift();
      const reusedItem = reuseExistingAnalysis(task.item, existingItemMap);

      if (reusedItem) {
        results[task.index] = reusedItem;
        continue;
      }

      results[task.index] = await analyzeNewsItem(task.item);
    }
  }

  await Promise.all(Array.from({ length: workerCount }, () => worker()));
  console.log('[AI] 新闻处理完成');
  return results.filter(Boolean);
}

module.exports = {
  enrichNewsItems,
  hasAiConfig,
};
