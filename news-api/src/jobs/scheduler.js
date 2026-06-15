const cron = require('node-cron');
const env = require('../config/env');
const { triggerRefresh, triggerRefreshIfNeeded } = require('../services/refreshService');

function startScheduler() {
  if (env.initialRefreshOnStart) {
    triggerRefreshIfNeeded('startup');
  }

  cron.schedule(env.cronSchedule, () => {
    triggerRefresh({
      reason: 'schedule',
      force: true,
    });
  });

  console.log(`[定时] Cron: ${env.cronSchedule}`);
}

module.exports = {
  startScheduler,
};
