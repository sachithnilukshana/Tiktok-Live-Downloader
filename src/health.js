/**
 * Lightweight HTTP health-check server.
 *
 * GET /health  → 200 { status:"ok", ... }  if the process is running.
 * GET /         → 200 { status:"ok" }       alias used by some probes.
 *
 * The server binds on $PORT (default 8080) so Render's health-check can
 * reach it without touching the Telegram polling loop.
 */

import http from 'node:http';
import { getState } from './state.js';
import { activeRecordings } from './monitor.js';

const PORT = Number(process.env.PORT) || 8080;

export function startHealthServer() {
  const server = http.createServer((req, res) => {
    if (req.method !== 'GET') {
      res.writeHead(405, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Method Not Allowed' }));
      return;
    }

    if (req.url === '/health' || req.url === '/') {
      const state = getState();
      const active = activeRecordings();

      const payload = {
        status: 'ok',
        uptime: Math.floor(process.uptime()),
        monitored: state.creators.length,
        activeRecordings: active.length,
        recordings: active,
        timestamp: new Date().toISOString()
      };

      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(payload));
      return;
    }

    res.writeHead(404, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'Not Found' }));
  });

  server.listen(PORT, '0.0.0.0', () => {
    console.log(`Health-check server listening on port ${PORT}`);
  });

  // Graceful shutdown: let the process exit cleanly without waiting for
  // the HTTP server's keep-alive connections to drain.
  server.unref();

  return server;
}
