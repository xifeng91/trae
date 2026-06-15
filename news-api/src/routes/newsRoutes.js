const express = require('express');
const { ALL_CATEGORY, QUERY_CATEGORY_VALUES } = require('../constants/categories');
const { getNewsPage, streamNewsInterpretation, triggerRefreshIfNeeded } = require('../services/refreshService');

const router = express.Router();

router.get('/news', (req, res) => {
  const category = req.query.category || ALL_CATEGORY;

  if (category !== ALL_CATEGORY && !QUERY_CATEGORY_VALUES.includes(category)) {
    return res.status(400).json({
      message: '不支持的新闻分类',
      allowedCategories: [ALL_CATEGORY, ...QUERY_CATEGORY_VALUES],
    });
  }

  triggerRefreshIfNeeded('read');
  const payload = getNewsPage({
    category,
    page: req.query.page,
    pageSize: req.query.pageSize,
  });

  return res.status(payload.items.length > 0 ? 200 : 202).json(payload);
});

function writeSseEvent(res, eventName, data) {
  res.write(`event: ${eventName}\n`);
  res.write(`data: ${JSON.stringify(data)}\n\n`);
}

router.get('/news/:id/interpretation/stream', async (req, res) => {
  res.setHeader('Content-Type', 'text/event-stream; charset=utf-8');
  res.setHeader('Cache-Control', 'no-cache, no-transform');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no');
  res.flushHeaders?.();

  try {
    await streamNewsInterpretation(
      req.params.id,
      {
        onMeta: (payload) => writeSseEvent(res, 'meta', payload),
        onDelta: (text) => writeSseEvent(res, 'delta', { text }),
        onDone: (payload) => writeSseEvent(res, 'done', payload),
      },
      {
        force: req.query.force === '1' || req.query.force === 'true',
      },
    );
  } catch (error) {
    writeSseEvent(res, 'fail', {
      message: error.message || 'AI 解读生成失败',
      status: error.status || 500,
    });
  } finally {
    res.end();
  }
});

module.exports = router;
