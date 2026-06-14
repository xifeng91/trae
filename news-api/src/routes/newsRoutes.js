const express = require('express');
const { ALL_CATEGORY, CATEGORY_VALUES } = require('../constants/categories');
const { getNewsPage, triggerRefreshIfNeeded } = require('../services/refreshService');

const router = express.Router();

router.get('/news', (req, res) => {
  const category = req.query.category || ALL_CATEGORY;

  if (category !== ALL_CATEGORY && !CATEGORY_VALUES.includes(category)) {
    return res.status(400).json({
      message: '不支持的新闻分类',
      allowedCategories: [ALL_CATEGORY, ...CATEGORY_VALUES],
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

module.exports = router;
