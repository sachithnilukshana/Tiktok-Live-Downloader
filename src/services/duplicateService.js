import crypto from 'node:crypto';
import fs from 'node:fs';
import { prisma } from '../db/client.js';

export async function computeChecksum(filePath) {
  return new Promise((resolve, reject) => {
    const hash = crypto.createHash('sha256');
    const stream = fs.createReadStream(filePath);
    stream.on('data', chunk => hash.update(chunk));
    stream.on('end', () => resolve(hash.digest('hex')));
    stream.on('error', reject);
  });
}

export async function checkDuplicate(recordingId, filePath) {
  let checksum;
  try {
    checksum = await computeChecksum(filePath);
  } catch (e) {
    console.warn(`[duplicate] Could not compute checksum for ${filePath}:`, e.message);
    return { isDuplicate: false, checksum: null };
  }

  await prisma.recording.update({ where: { id: recordingId }, data: { checksum } });

  const existing = await prisma.recording.findFirst({
    where: { checksum, id: { not: recordingId }, isDuplicate: false }
  });

  if (existing) {
    await prisma.recording.update({
      where: { id: recordingId },
      data: { isDuplicate: true, duplicateOfId: existing.id }
    });
    console.log(`[duplicate] Recording ${recordingId} is duplicate of ${existing.id}`);
    return { isDuplicate: true, duplicateOfId: existing.id, checksum };
  }

  return { isDuplicate: false, checksum };
}
