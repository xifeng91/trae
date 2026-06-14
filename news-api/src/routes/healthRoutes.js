const express = require('express');
const { getDateKey } = require('../utils/dateUtils');
const { getRefreshStatus } = require('../services/refreshService');

const router = express.Router();

router.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    date: getDateKey(),
    refresh: getRefreshStatus(),
    uptime: process.uptime(),
  });
});

module.exports = router;
