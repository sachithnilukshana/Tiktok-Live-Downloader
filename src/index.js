import fs from 'node:fs/promises';
import http from 'node:http';
import { config } from './config.js';
import { loadState } from './state.js';
import { verifyBucket } from './storage.js';
import { createBot } from './bot.js';
import { setBot, startMonitor } from './monitor.js';
import { createApiServer } from './api/server.js';
import { createWsServer } from './websocket/wsServer.js';

async function main() {
  await fs.mkdir(config.recordingsDir, { recursive: true });
  await loadState();
  await verifyBucket();

  const app = createApiServer();
  const httpServer = http.createServer(app);
  createWsServer(httpServer);

  const port = Number(process.env.PORT) || 8080;
  httpServer.listen(port, '0.0.0.0', () => {
    console.log(`API & WebSocket server listening on port ${port}`);
  });
  httpServer.unref();

  const bot = createBot();
  setBot(bot);
  startMonitor();
  console.log('TikTok LIVE Auto Recorder V2.0 started.');
  console.log(`Monitoring every ${config.pollSeconds} seconds.`);
}

main().catch(error => {
  console.error('Startup failed:', error);
  process.exit(1);
});
