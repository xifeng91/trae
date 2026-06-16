const express = require('express');
const healthRoutes = require('./routes/healthRoutes');
const newsRoutes = require('./routes/newsRoutes');
const refreshRoutes = require('./routes/refreshRoutes');
const searchRoutes = require('./routes/searchRoutes');

function createApp() {
  const app = express();

  app.use(express.json());

  app.use((req, res, next) => {
    res.header('Access-Control-Allow-Origin', '*');
    res.header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.header('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') {
      return res.sendStatus(204);
    }

    return next();
  });

  app.use('/api', healthRoutes);
  app.use('/api', newsRoutes);
  app.use('/api', refreshRoutes);
  app.use('/api', searchRoutes);

  app.use((req, res) => {
    res.status(404).json({
      message: '接口不存在',
    });
  });

  app.use((error, req, res, next) => {
    console.error(`[接口] 未处理异常: ${error.stack || error.message}`);
    res.status(500).json({
      message: '服务内部错误',
    });
  });

  return app;
}

module.exports = createApp;
