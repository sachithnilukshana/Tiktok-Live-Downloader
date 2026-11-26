import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import fs from 'node:fs/promises';
import { prisma } from '../db/client.js';

const execFileAsync = promisify(execFile);

function parseFrameRate(rateStr) {
  if (!rateStr || typeof rateStr !== 'string') return null;
  const parts = rateStr.split('/').map(Number);
  if (parts.length === 2 && Number.isFinite(parts[0]) && Number.isFinite(parts[1]) && parts[1] > 0) {
    return Math.round((parts[0] / parts[1]) * 100) / 100;
  }
  const single = Number(rateStr);
  return Number.isFinite(single) ? single : null;
}

export async function extractMetadata(recordingId, filePath) {
  try {
    await fs.access(filePath);
  } catch {
    console.warn(`[metadata] File not accessible: ${filePath}`);
    return null;
  }

  const ffprobePath = process.env.FFPROBE_PATH || 'ffprobe';

  let raw;
  try {
    const { stdout } = await execFileAsync(ffprobePath, [
      '-v', 'quiet',
      '-print_format', 'json',
      '-show_format',
      '-show_streams',
      filePath
    ], { timeout: 30000 });
    raw = JSON.parse(stdout);
  } catch (e) {
    console.warn(`[metadata] ffprobe failed for ${filePath}:`, e.message);
    return null;
  }

  const videoStream = raw.streams?.find(s => s.codec_type === 'video');
  const audioStream = raw.streams?.find(s => s.codec_type === 'audio');
  const format = raw.format || {};

  const meta = {
    durationSecs: format.duration ? parseFloat(format.duration) : null,
    bytes: format.size ? BigInt(format.size) : null,
    width: videoStream?.width || null,
    height: videoStream?.height || null,
    fps: parseFrameRate(videoStream?.r_frame_rate),
    videoCodec: videoStream?.codec_name || null,
    audioCodec: audioStream?.codec_name || null,
    bitrate: format.bit_rate ? parseInt(format.bit_rate, 10) : null,
    container: format.format_name || null
  };

  await prisma.recording.update({ where: { id: recordingId }, data: meta });
  console.log(`[metadata] Extracted metadata for recording ${recordingId}`);
  return meta;
}
