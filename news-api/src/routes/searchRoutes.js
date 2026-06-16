const express = require('express');
const { ALL_CATEGORY, QUERY_CATEGORY_VALUES } = require('../constants/categories');
const { getSearchHistory } = require('../services/searchCacheService');
const { searchLocalNews, searchOnlineNews } = require('../services/searchService');

const router = express.Router();

function validateCategory(category) {
  return category === ALL_CATEGORY || QUERY_CATEGORY_VALUES.includes(category);
}

router.get('/search/local', (req, res) => {
  const category = req.query.category || ALL_CATEGORY;

  if (!validateCategory(category)) {
    return res.status(400).json({
      message: '不支持的新闻分类',
      allowedCategories: [ALL_CATEGORY, ...QUERY_CATEGORY_VALUES],
    });
  }

  return res.json(
    searchLocalNews({
      q: req.query.q,
      category,
      page: req.query.page,
      pageSize: req.query.pageSize,
    }),
  );
});

router.get('/search/online', async (req, res, next) => {
  try {
    const payload = await searchOnlineNews({
      q: req.query.q,
      limit: req.query.limit,
    });

    return res.json(payload);
  } catch (error) {
    return next(error);
  }
});

router.post('/search/online', async (req, res, next) => {
  try {
    const payload = await searchOnlineNews({
      q: req.body?.q || req.query.q,
      limit: req.body?.limit || req.query.limit,
    });

    return res.json(payload);
  } catch (error) {
    return next(error);
  }
});

router.get('/search/history', (req, res) => {
  return res.json(getSearchHistory({
    bucket: req.query.bucket,
  }));
});

module.exports = router;
