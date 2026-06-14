const env = require('./config/env');
const createApp = require('./app');
const { startScheduler } = require('./jobs/scheduler');

const app = createApp();

process.on('unhandledRejection', (error) => {
  console.error('[进程] 未捕获的 Promise 拒绝:', error?.stack || error);
});

process.on('uncaughtException', (error) => {
  console.error('[进程] 未捕获异常:', error?.stack || error);
});

app.listen(env.port, () => {
  console.log('\n' + '='.repeat(56));
  console.log('今日简报 API 服务已启动');
  console.log(`本地地址: http://localhost:${env.port}`);
  console.log(`健康检查: http://localhost:${env.port}/api/health`);
  console.log('='.repeat(56) + '\n');

  startScheduler();
});
