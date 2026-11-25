import { spawn } from 'node:child_process';
import fs from 'node:fs/promises';
import path from 'node:path';
import { config } from './config.js';

export async function startRecording(username, streamUrl) {
  if (!streamUrl || !/^https:\/\//i.test(streamUrl)) throw new Error('TikTok did not provide a valid HTTPS stream URL.');
  await fs.mkdir(config.recordingsDir, { recursive: true });
  const startedAt = new Date().toISOString();
  const safeName = `${username}-${startedAt.replaceAll(':', '-').replaceAll('.', '-')}`;
  const output = path.join(config.recordingsDir, `${safeName}.mkv`);

  const args = [
    '-hide_banner', '-loglevel', 'warning', '-y',
    '-rw_timeout', '15000000',
    '-i', streamUrl,
    '-map', '0',
    '-c', 'copy',
    '-f', 'matroska',
    output
  ];
  const child = spawn(config.ffmpegPath, args, { stdio: ['ignore', 'ignore', 'pipe'] });
  let stderr = '';
  child.stderr.on('data', chunk => { stderr = (stderr + chunk.toString()).slice(-5000); });

  await new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      if (child.pid) resolve();
    }, 1200);
    child.once('error', err => { clearTimeout(timer); reject(new Error(`Could not start FFmpeg: ${err.message}`)); });
    child.once('spawn', () => { clearTimeout(timer); resolve(); });
  });

  return {
    username, startedAt, output, child, get stderr() { return stderr; },
    stop: () => new Promise(resolve => {
      if (child.exitCode !== null || child.signalCode !== null) return resolve({ code: child.exitCode, signal: child.signalCode });
      const timeout = setTimeout(() => child.kill('SIGKILL'), 15000);
      child.once('close', (code, signal) => { clearTimeout(timeout); resolve({ code, signal }); });
      child.kill('SIGINT');
    })
  };
}
