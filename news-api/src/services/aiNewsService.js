const axios = require('axios');
const env = require('../config/env');
const { normalizeText } = require('../utils/textUtils');

const ANALYSIS_RULES = [
  {
    type: 'monetary_policy',
    label: '货币政策',
    keywords: [
      '央行',
      '美联储',
      'Fed',
      'FOMC',
      '利率',
      '通胀',
      'CPI',
      'PCE',
      '点阵图',
      '降息',
      '加息',
      '货币政策',
      '就业',
      '非农',
      '工资',
      '鲍威尔',
      '沃什',
    ],
    signals: ['通胀措辞', '利率指引', '就业与工资压力', '委员预期', '发布会风险表述'],
    promptRules:
      '重点识别通胀是否被描述为持续、超预期或需要高度警惕；利率指引是否从“耐心/不宜调整”转向“准备行动”；就业、工资和点阵图是否暗示鹰派或鸽派变化；发布会里的“数据依赖、平衡风险、中性利率、限制性不足”等措辞分别意味着什么。',
  },
  {
    type: 'macro_economy',
    label: '宏观经济',
    keywords: ['GDP', 'PMI', 'CPI', 'PPI', '社融', '信贷', 'M2', '出口', '进口', '消费', '投资', '就业', '失业率', '零售', '工业增加值'],
    signals: ['数据方向', '预期差', '政策含义', '需求与价格', '市场影响'],
    promptRules:
      '重点判断数据是强于预期、弱于预期还是结构分化；拆解需求、价格、就业、信用和外需的变化；说明这些变化对政策宽松或收紧、股债汇商品可能意味着什么。',
  },
  {
    type: 'company_business',
    label: '公司经营',
    keywords: ['财报', '业绩', '营收', '利润', '净利', '毛利率', '订单', '裁员', '回购', '并购', '上市', '股价', '指引', 'CEO', '公司'],
    signals: ['业绩质量', '盈利能力', '管理层指引', '现金流', '竞争格局'],
    promptRules:
      '重点看营收利润是否真实改善，毛利率、现金流和订单是否支撑增长；管理层指引是否上修或下修；股价反应是业绩驱动还是情绪驱动；并购、裁员和回购对长期竞争力意味着什么。',
  },
  {
    type: 'financial_market',
    label: '金融市场',
    keywords: ['股市', 'A股', '港股', '美股', '债券', '国债', '汇率', '人民币', '美元', '黄金', '原油', '期货', '收益率', '市场'],
    signals: ['风险偏好', '利率变化', '资金流向', '资产联动', '持续性'],
    promptRules:
      '重点拆解市场波动来自利率、盈利、政策、流动性还是风险事件；说明股、债、汇、商品之间是否出现一致信号；区分短期情绪冲击和基本面变化。',
  },
  {
    type: 'geopolitics',
    label: '地缘政治',
    keywords: ['制裁', '反制', '外交', '冲突', '战争', '停火', '谈判', '峰会', '军方', '边境', '关税', '贸易战', '安全', '声明'],
    signals: ['措辞升级', '谈判窗口', '制裁范围', '军事或供应链风险', '后续节点'],
    promptRules:
      '重点识别措辞是升级还是降温，是否出现制裁、反制、军事部署或谈判窗口；说明对贸易、供应链、能源、市场避险情绪和区域安全的影响，避免过度推断未证实信息。',
  },
  {
    type: 'technology',
    label: '科技产业',
    keywords: ['AI', '人工智能', '芯片', '半导体', '大模型', '算力', '数据中心', '量子', '机器人', '自动驾驶', '航天', '专利', '开源'],
    signals: ['技术成熟度', '商业化阶段', '产业链约束', '监管风险', '竞争壁垒'],
    promptRules:
      '重点判断这是实验进展、产品发布还是商业化落地；拆解算力、芯片、数据、成本、监管和供应链约束；说明可能受益的环节，以及哪些说法仍需要验证。',
  },
  {
    type: 'policy_regulation',
    label: '政策监管',
    keywords: ['政策', '监管', '罚款', '处罚', '整改', '条例', '办法', '征求意见', '发布', '出台', '改革', '审批', '许可'],
    signals: ['监管口径', '适用范围', '执行强度', '行业影响', '合规成本'],
    promptRules:
      '重点看这是个案执法还是行业口径变化；政策适用范围、执行时间、处罚尺度和合规成本如何变化；哪些企业或群体受益，哪些会承压。',
  },
  {
    type: 'public_life',
    label: '民生社会',
    keywords: ['教育', '医疗', '医保', '住房', '养老', '就业', '消费', '交通', '旅游', '食品', '公共服务', '学校', '医院'],
    signals: ['影响人群', '成本变化', '落地难点', '供给改善', '长期影响'],
    promptRules:
      '重点说明影响哪些人，成本、服务供给和准入门槛是否变化；政策或事件落地可能遇到什么执行难点；对普通人的实际影响是什么。',
  },
  {
    type: 'emergency',
    label: '突发事件',
    keywords: ['突发', '事故', '地震', '火灾', '爆炸', '洪水', '台风', '伤亡', '救援', '坠毁', '袭击', '紧急'],
    signals: ['伤亡与范围', '原因是否明确', '处置进展', '次生风险', '责任追踪'],
    promptRules:
      '重点区分已确认事实和待查原因；说明伤亡、影响范围、救援处置和次生风险；不要替官方调查下结论，关注后续责任认定和防范措施。',
  },
];

const DEFAULT_RULE = {
  type: 'general',
  label: '综合新闻',
  keywords: [],
  signals: ['核心事实', '关键变化', '影响对象', '后续观察'],
  promptRules:
    '重点提炼事件的核心事实、相较此前的关键变化、直接影响对象和后续观察点；不要泛泛而谈，优先解释普通读者容易忽略的信号。',
};

function hasAiConfig() {
  return Boolean(env.deepseekApiKey);
}

function scoreRule(rule, text) {
  return rule.keywords.reduce((score, keyword) => {
    if (!keyword) return score;
    return text.toLowerCase().includes(String(keyword).toLowerCase()) ? score + 1 : score;
  }, 0);
}

function resolveAnalysisRule(newsItem) {
  const text = normalizeText(`${newsItem.title || ''} ${newsItem.category || ''} ${newsItem.overview || ''} ${newsItem.rawSummary || ''}`);
  let selectedRule = DEFAULT_RULE;
  let selectedScore = 0;

  for (const rule of ANALYSIS_RULES) {
    const score = scoreRule(rule, text);
    if (score > selectedScore) {
      selectedRule = rule;
      selectedScore = score;
    }
  }

  if (selectedScore > 0) return selectedRule;
  if (newsItem.category === '财经') return ANALYSIS_RULES.find((rule) => rule.type === 'macro_economy') || DEFAULT_RULE;
  if (newsItem.category === '科技') return ANALYSIS_RULES.find((rule) => rule.type === 'technology') || DEFAULT_RULE;
  if (newsItem.category === '国际') return ANALYSIS_RULES.find((rule) => rule.type === 'geopolitics') || DEFAULT_RULE;

  return selectedRule;
}

function buildFallbackInterpretation(newsItem, status = 'fallback') {
  const rule = resolveAnalysisRule(newsItem);
  const overview = newsItem.overview || newsItem.rawSummary || newsItem.title || '这条新闻来自公开新闻源。';

  return {
    interpretation: `**快速判断**\n\n这条新闻可先关注三点：一是核心事实本身，二是它是否代表政策、市场或行业口径变化，三是后续是否有官方说明、数据验证或执行细则。当前 AI 解读暂不可用，可先结合原文继续判断。\n\n**新闻总览**\n\n${overview}`,
    interpretationStatus: status,
    aiStatus: status,
    analysisType: rule.type,
    signals: rule.signals,
  };
}

function buildInterpretationPrompt(newsItem, rule) {
  return `请基于下面这条真实新闻生成一份适合个人快速浏览的 AI 解读。

输出要求：
1. 直接输出中文 Markdown 正文，不要 JSON，不要 HTML。
2. 可以使用简短小标题、分段、列表、加粗、引用、链接和 Markdown 表格，读起来要像“关键词解析 + 影响判断”。
3. 如需展示对比信息，可使用 Markdown 表格；如无明显对比关系，不要强行使用表格。
4. 只有在材料中存在明确、可信的图片链接时，才可以使用 Markdown 图片语法；不要编造图片链接，也不要求必须输出图片。
5. 信息完整优先，通常控制在 400-800 字；复杂政策、财经、地缘新闻可以更长，但不要为了凑字重复。
6. 必须基于新闻标题、来源、总览和原始摘要，不要编造原文没有的事实、数字、人物表态或市场反应。
7. 如果原文信息不足，要明确写“目前材料不足以判断”，不要强行给确定结论。

新闻类型：${rule.label}
重点规则：${rule.promptRules}
建议观察点：${rule.signals.join('、')}

新闻标题：${newsItem.title}
新闻来源：${newsItem.source}
新闻分类：${newsItem.category}
新闻时间：${newsItem.publishedAt || '未知'}
新闻总览：${newsItem.overview || '无'}
原始摘要：${newsItem.rawSummary || newsItem.overview || '无'}`;
}

function buildAiRequestBody(newsItem, rule) {
  const requestBody = {
    model: env.aiModel,
    messages: [
      {
        role: 'system',
        content:
          '你是新闻分析助手，擅长根据不同新闻类型做关键词、措辞变化、风险信号和后续观察点解析。你必须尊重原始新闻事实，不能编造。',
      },
      {
        role: 'user',
        content: buildInterpretationPrompt(newsItem, rule),
      },
    ],
    temperature: 0.25,
    stream: true,
  };

  if (env.aiInterpretationMaxTokens) {
    requestBody.max_tokens = env.aiInterpretationMaxTokens;
  }

  return requestBody;
}

function parseStreamPayload(payload) {
  if (!payload || payload === '[DONE]') return null;

  try {
    const parsed = JSON.parse(payload);
    return parsed.choices?.[0]?.delta?.content || parsed.choices?.[0]?.message?.content || '';
  } catch (error) {
    return '';
  }
}

function parseStreamEvent(event) {
  return event
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line.startsWith('data:'))
    .map((line) => line.replace(/^data:\s*/, ''))
    .map(parseStreamPayload)
    .filter(Boolean);
}

async function streamFallbackText(text, onDelta) {
  const chunkSize = 18;

  for (let index = 0; index < text.length; index += chunkSize) {
    const chunk = text.slice(index, index + chunkSize);
    onDelta?.(chunk);
    await new Promise((resolve) => setTimeout(resolve, 16));
  }
}

async function streamAiInterpretation(newsItem, options = {}) {
  const rule = resolveAnalysisRule(newsItem);

  if (!hasAiConfig()) {
    const fallback = buildFallbackInterpretation(newsItem);
    await streamFallbackText(fallback.interpretation, options.onDelta);
    return fallback;
  }

  try {
    const response = await axios.post(
      env.deepseekApiUrl,
      buildAiRequestBody(newsItem, rule),
      {
        headers: {
          Authorization: `Bearer ${env.deepseekApiKey}`,
          'Content-Type': 'application/json',
        },
        responseType: 'stream',
        timeout: 90000,
      },
    );

    let buffer = '';
    let interpretation = '';

    for await (const chunk of response.data) {
      buffer += chunk.toString('utf-8');
      const events = buffer.split(/\n\n/);
      buffer = events.pop() || '';

      for (const event of events) {
        for (const delta of parseStreamEvent(event)) {
          interpretation += delta;
          options.onDelta?.(delta);
        }
      }
    }

    if (buffer.trim()) {
      for (const delta of parseStreamEvent(buffer)) {
        interpretation += delta;
        options.onDelta?.(delta);
      }
    }

    const cleanInterpretation = interpretation.trim();
    if (!cleanInterpretation) throw new Error('AI 未返回解读内容');

    return {
      interpretation: cleanInterpretation,
      interpretationStatus: 'success',
      aiStatus: 'success',
      analysisType: rule.type,
      signals: rule.signals,
    };
  } catch (error) {
    console.warn(`[AI] ${String(newsItem.title || '').slice(0, 24)} 流式解读失败: ${error.message}`);
    const fallback = buildFallbackInterpretation(newsItem, 'failed');
    await streamFallbackText(fallback.interpretation, options.onDelta);
    return fallback;
  }
}

module.exports = {
  hasAiConfig,
  resolveAnalysisRule,
  streamAiInterpretation,
};
