/**
 * AI 解读生成模块
 * 调用大模型 API 对新闻生成通俗解读
 * 支持 DeepSeek / OpenAI / OpenRouter
 */

const axios = require('axios');

/**
 * 获取API配置
 */
function getAPIConfig() {
  const model = process.env.AI_MODEL || 'deepseek-chat';

  // DeepSeek
  if (process.env.DEEPSEEK_API_KEY && model.includes('deepseek')) {
    return {
      url: 'https://api.deepseek.com/v1/chat/completions',
      key: process.env.DEEPSEEK_API_KEY,
      model: 'deepseek-chat',
    };
  }

  // OpenAI
  if (process.env.OPENAI_API_KEY) {
    return {
      url: 'https://api.openai.com/v1/chat/completions',
      key: process.env.OPENAI_API_KEY,
      model: model || 'gpt-4o-mini',
    };
  }

  // OpenRouter
  if (process.env.OPENROUTER_API_KEY) {
    return {
      url: 'https://openrouter.ai/api/v1/chat/completions',
      key: process.env.OPENROUTER_API_KEY,
      model: model || 'openai/gpt-4o-mini',
    };
  }

  return null;
}

/**
 * 使用AI为单条新闻生成解读
 * @param {Object} news - 新闻对象 { title, summary, category }
 * @returns {Promise<string>} 解读文本
 */
async function generateInterpretation(news) {
  const config = getAPIConfig();
  if (!config) {
    console.warn('[AI] 未配置API Key，使用模板解读');
    return `这是一条来自${news.source || '新闻媒体'}的报道。${news.summary || news.title}。具体详情可以点击信息来源链接查看。`;
  }

  const prompt = `请用 6-8 句通俗大白话解读以下新闻，让读者看完后不需要再看原文。

你必须用段落回答 3 个问题（每问1个段落，段落之间用空行隔开）：
1️⃣ 对于本件事情的叙述
2️⃣ 为什么会发生
3️⃣ 衍生或升华的结论

写作要求：
- 语言通俗易懂，清楚有条理
- 禁止出现：政策文件原文、专业术语堆砌、模糊表态

❌ 错误示范："本次降准释放长期流动性约5000亿元，有助于降低金融机构资金成本。"
✅ 正确示范："央行往市场里多放了5000亿的水。银行能借出去的钱变多了。"

新闻标题：${news.title}
新闻摘要：${news.summary || '无'}
新闻分类：${news.category}

直接输出解读内容，不要任何前缀。`;

  try {
    const response = await axios.post(config.url, {
      model: config.model,
      messages: [
        { role: 'system', content: '你擅长用通俗易懂的语言解读新闻。每次输出6-8句，分3段回答：事件叙述、原因、衍生结论。禁止任何术语和官话。' },
        { role: 'user', content: prompt }
      ],
      max_tokens: 600,
      temperature: 0.7,
    }, {
      headers: {
        'Authorization': `Bearer ${config.key}`,
        'Content-Type': 'application/json',
      },
      timeout: 30000,
    });

    const text = response.data.choices?.[0]?.message?.content?.trim();
    if (text) return text;

    throw new Error('API返回内容为空');
  } catch (err) {
    console.warn(`[AI] 生成失败 (${news.title.slice(0, 20)}...): ${err.message}`);
    // 降级：用模板生成
    return `${news.summary || news.title}。这条新闻来自${news.source || '权威媒体'}，反映了${news.category === '国内' ? '国内' : news.category === '国际' ? '国际' : '相关'}领域的最新动态，对关注该领域的读者有重要参考价值。`;
  }
}

/**
 * 批量生成 AI 解读（含并发控制）
 * @param {Array} newsItems - 新闻数组
 * @param {number} concurrency - 并发数（默认3）
 * @returns {Promise<Array>} 添加了 interpretation 的新闻数组
 */
async function batchInterpret(newsItems, concurrency = 3) {
  console.log(`[AI] 开始为 ${newsItems.length} 条新闻生成解读...`);

  const results = [];
  const queue = [...newsItems];

  async function worker() {
    while (queue.length > 0) {
      const news = queue.shift();
      const interpretation = await generateInterpretation(news);
      results.push({ ...news, interpretation });
      console.log(`[AI] ✓ ${results.length}/${newsItems.length} - ${news.title.slice(0, 24)}`);
    }
  }

  const workers = Array.from({ length: Math.min(concurrency, newsItems.length) }, () => worker());
  await Promise.all(workers);

  console.log(`[AI] 全部完成`);
  return results;
}

/**
 * 用AI生成今日简报副标题（一句话概括今日新闻，约30字）
 * @param {Array} newsItems - 已完成解读的新闻数组
 * @returns {Promise<string>} 副标题文本
 */
async function generateSubtitle(newsItems) {
  const config = getAPIConfig();
  if (!config) return '今日国内外要闻精选';

  // 提取所有新闻标题做分析素材
  const titles = newsItems.slice(0, 20).map(n => `[${n.category}] ${n.title}`).join('\n');

  const prompt = `你是一位新闻编辑。以下是今日精选新闻标题列表：

${titles}

请用一句话（**不超过30个字**）概括今天新闻的整体主题和氛围。要求：
- 简明扼要，有概括力
- 不要列点，不要分段
- 不要用"今日"、"今天"等时间词开头
- 限定在30字以内

示例：
"中美贸易博弈持续升温，全球金融市场震荡"

只输出这句话，不要任何前缀或额外说明。`;

  try {
    const response = await axios.post(config.url, {
      model: config.model,
      messages: [
        { role: 'system', content: '你是一名资深新闻编辑，擅长用精炼的语言概括新闻主题。输出极度简洁，始终控制在30字以内。' },
        { role: 'user', content: prompt }
      ],
      max_tokens: 80,
      temperature: 0.5,
    }, {
      headers: {
        'Authorization': `Bearer ${config.key}`,
        'Content-Type': 'application/json',
      },
      timeout: 15000,
    });

    const text = response.data.choices?.[0]?.message?.content?.trim();
    if (text && text.length <= 50) return text;
    return text ? text.slice(0, 40) : '今日国内外要闻精选';
  } catch (err) {
    console.warn(`[AI] 副标题生成失败: ${err.message}`);
    return '今日国内外要闻精选';
  }
}

/**
 * 用AI将摘要缩短到30字以内
 * @param {Array} newsItems - 已有 interpretation 的新闻数组
 * @param {number} concurrency - 并发数（默认5）
 * @returns {Promise<Array>} 添加了 shortSummary 的新闻数组
 */
async function batchShortenSummaries(newsItems, concurrency = 5) {
  const config = getAPIConfig();
  if (!config) return newsItems.map(n => ({ ...n, shortSummary: (n.summary || n.title).slice(0, 30) }));

  console.log(`[AI] 开始为 ${newsItems.length} 条新闻生成短摘要...`);
  const results = [];
  const queue = [...newsItems];

  async function worker() {
    while (queue.length > 0) {
      const news = queue.shift();
      try {
        const response = await axios.post(config.url, {
          model: config.model,
          messages: [
            { role: 'system', content: '你是一名新闻编辑。用不超过30个字概括新闻核心内容。只输出摘要本身，不要任何前缀。' },
            { role: 'user', content: `请用30字以内概括：${news.title}` }
          ],
          max_tokens: 50,
          temperature: 0.3,
        }, {
          headers: { 'Authorization': `Bearer ${config.key}`, 'Content-Type': 'application/json' },
          timeout: 10000,
        });

        let short = response.data.choices?.[0]?.message?.content?.trim() || '';
        // 确保不超过30字
        if (short.length > 30) short = short.slice(0, 30);
        results.push({ ...news, shortSummary: short });
      } catch (err) {
        // AI失败时用截断的原始摘要
        results.push({ ...news, shortSummary: (news.summary || news.title).slice(0, 30) });
      }
    }
  }

  const workers = Array.from({ length: Math.min(concurrency, newsItems.length) }, () => worker());
  await Promise.all(workers);
  console.log(`[AI] 短摘要全部完成`);
  return results;
}

module.exports = { generateInterpretation, batchInterpret, getAPIConfig, generateSubtitle, batchShortenSummaries };
