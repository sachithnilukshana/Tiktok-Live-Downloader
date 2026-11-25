import fs from 'node:fs/promises';
import { config } from './config.js';
import { loadState } from './state.js';
import { verifyBucket } from './storage.js';
import { createBot } from './bot.js';
import { setBot, startMonitor } from './monitor.js';
import { startHealthServer } from './health.js';

async function main() {
  await fs.mkdir(config.recordingsDir, { recursive: true });
  await loadState();
  await verifyBucket();

  // Start HTTP health-check endpoint first so Render marks the service healthy.
  startHealthServer();

  const bot = createBot();
  setBot(bot);
  startMonitor();
  console.log('TikTok LIVE Auto Recorder started.');
  console.log(`Monitoring every ${config.pollSeconds} seconds.`);
}
main().catch(error => {
  console.error('Startup failed:', error);
  process.exit(1);
});
