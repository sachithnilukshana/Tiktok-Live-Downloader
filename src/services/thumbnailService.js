import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import fs from 'node:fs/promises';
import { createReadStream } from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { S3Client } from '@aws-sdk/client-s3';
import { Upload } from '@aws-sdk/lib-storage';
import { prisma } from '../db/client.js';

const execFileAsync = promisify(execFile);

function getS3() {
  return new S3Client({
    endpoint: process.env.B2_ENDPOINT,
    region: process.env.B2_REGION || 'us-west-004',
    forcePathStyle: true,
    credentials: {
      accessKeyId: process.env.B2_ACCESS_KEY_ID,
      secretAccessKey: process.env.B2_SECRET_ACCESS_KEY
    }
  });
}

export async function generateThumbnail(recordingId, filePath) {
  try {
    await fs.access(filePath);
  } catch {
    console.warn(`[thumbnail] File not accessible: ${filePath}`);
    return null;
  }

  const ffmpegPath = process.env.FFMPEG_PATH || 'ffmpeg';
  const tmpFile = path.join(os.tmpdir(), `thumb-${recordingId}.jpg`);

  try {
    await execFileAsync(ffmpegPath, [
      '-ss', '10',
      '-i', filePath,
      '-vframes', '1',
      '-vf', 'scale=640:-1',
      '-q:v', '3',
      '-y', tmpFile
    ], { timeout: 30000 });
  } catch {
    try {
      await execFileAsync(ffmpegPath, [
        '-i', filePath,
        '-vframes', '1',
        '-vf', 'scale=640:-1',
        '-q:v', '3',
        '-y', tmpFile
      ], { timeout: 30000 });
    } catch (e2) {
      console.warn(`[thumbnail] Generation failed for ${filePath}:`, e2.message);
      return null;
    }
  }

  try {
    await fs.access(tmpFile);
    const recording = await prisma.recording.findUnique({ where: { id: recordingId } });
    if (!recording) return null;
    const prefix = (process.env.B2_PREFIX || 'live-recordings').replace(/^\/+|\/+$/g, '');
    const thumbKey = `${prefix}/${recording.username}/thumbs/${recordingId}.jpg`;

    const s3 = getS3();
    const upload = new Upload({
      client: s3,
      params: {
        Bucket: process.env.B2_BUCKET,
        Key: thumbKey,
        Body: createReadStream(tmpFile),
        ContentType: 'image/jpeg'
      }
    });
    await upload.done();

    const thumbUrl = `${process.env.B2_ENDPOINT}/${process.env.B2_BUCKET}/${thumbKey}`;

    await prisma.recording.update({
      where: { id: recordingId },
      data: { thumbKey, thumbUrl }
    });

    console.log(`[thumbnail] Generated and uploaded: ${thumbKey}`);
    return { thumbKey, thumbUrl };
  } finally {
    await fs.unlink(tmpFile).catch(() => {});
  }
}
