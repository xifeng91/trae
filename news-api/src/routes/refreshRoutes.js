const express = require('express');
const { getRefreshStatus, triggerRefresh } = require('../services/refreshService');

const router = express.Router();

router.post('/refresh', (req, res) => {
  const result = triggerRefresh({
    reason: 'manual',
  });

  res.status(result.started ? 202 : 200).json({
    ...result.status,
    message: result.message,
  });
});

router.get('/refresh/status', (req, res) => {
  res.json(getRefreshStatus());
});

module.exports = router;
