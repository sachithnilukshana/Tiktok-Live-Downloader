import 'dotenv/config';
import path from 'node:path';

function required(name) {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`Missing required environment variable: ${name}`);
  return value;
}
function integer(name, fallback, min, max) {
  const n = Number.parseInt(process.env[name] ?? String(fallback), 10);
  if (!Number.isInteger(n) || n < min || n > max) throw new Error(`${name} must be an integer from ${min} to ${max}`);
  return n;
}

const endpoint = required('B2_ENDPOINT');
const parsedEndpoint = new URL(endpoint);
if (parsedEndpoint.protocol !== 'https:') throw new Error('B2_ENDPOINT must use HTTPS');

export const config = {
  telegramToken: required('TELEGRAM_BOT_TOKEN'),
  allowedUserId: required('TELEGRAM_ALLOWED_USER_ID'),
  b2: {
    endpoint,
    region: process.env.B2_REGION || 'us-west-004',
    bucket: required('B2_BUCKET'),
    accessKeyId: required('B2_ACCESS_KEY_ID'),
    secretAccessKey: required('B2_SECRET_ACCESS_KEY'),
    linkExpiry: integer('B2_LINK_EXPIRY_SECONDS', 604800, 60, 604800),
    prefix: (process.env.B2_PREFIX || 'live-recordings').replace(/^\/+|\/+$/g, '')
  },
  pollSeconds: integer('POLL_INTERVAL_SECONDS', 45, 30, 600),
  offlineConfirmations: integer('OFFLINE_CONFIRMATIONS', 2, 1, 10),
  maxRecordings: integer('MAX_CONCURRENT_RECORDINGS', 2, 1, 10),
  recordingsDir: path.resolve(process.env.RECORDINGS_DIR || './recordings'),
  ffmpegPath: process.env.FFMPEG_PATH || 'ffmpeg'
};
