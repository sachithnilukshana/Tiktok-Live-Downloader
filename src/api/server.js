import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';
import { apiLimiter } from './middleware/rateLimiter.js';
import authRoutes from './routes/auth.js';
import userRoutes from './routes/users.js';
import deviceRoutes from './routes/devices.js';
import creatorRoutes from './routes/creators.js';
import recordingRoutes from './routes/recordings.js';
import tagRoutes from './routes/tags.js';
import storageRoutes from './routes/storage.js';
import backupRoutes from './routes/backups.js';
import auditRoutes from './routes/audit.js';
import analyticsRoutes from './routes/analytics.js';
import { getState } from '../state.js';
import { activeRecordings } from '../monitor.js';

export function createApiServer() {
  const app = express();

  // Safely serialize Prisma BigInt values in JSON responses
  app.set('json replacer', (_key, value) => (typeof value === 'bigint' ? Number(value) : value));

  app.use(helmet());
  app.use(cors({
    origin: process.env.DASHBOARD_ORIGIN || 'http://localhost:5173',
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS']
  }));

  app.use(express.json({ limit: '1mb' }));
  app.use(cookieParser());

  app.use('/api', apiLimiter);

  app.use('/api/auth', authRoutes);
  app.use('/api/users', userRoutes);
  app.use('/api/devices', deviceRoutes);
  app.use('/api/creators', creatorRoutes);
  app.use('/api/recordings', recordingRoutes);
  app.use('/api/tags', tagRoutes);
  app.use('/api/storage', storageRoutes);
  app.use('/api/backups', backupRoutes);
  app.use('/api/audit', auditRoutes);
  app.use('/api/analytics', analyticsRoutes);

  app.get('/health', (_req, res) => {
    const state = getState();
    const active = activeRecordings();
    res.json({
      status: 'ok',
      uptime: Math.floor(process.uptime()),
      monitored: state.creators.length,
      activeRecordings: active.length,
      recordings: active,
      timestamp: new Date().toISOString()
    });
  });

  app.use((_req, res) => {
    res.status(404).json({ error: 'Not found' });
  });

  app.use((err, _req, res, _next) => {
    const status = err.status || 500;
    const message = status < 500 ? err.message : 'Internal server error';
    if (status >= 500) console.error('[api] Unhandled error:', err);
    res.status(status).json({ error: message });
  });

  return app;
}
