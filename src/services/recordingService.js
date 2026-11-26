import { prisma } from '../db/client.js';
import { log as audit } from './auditService.js';
import { enqueue } from './jobQueue.js';
import { extractMetadata } from './metadataService.js';
import { generateThumbnail } from './thumbnailService.js';
import { checkDuplicate } from './duplicateService.js';

export async function finalizeRecording({ username, startedAt, finishedAt, bytes, objectKey, url, deviceId, localPath }) {
  await prisma.creator.upsert({
    where: { username },
    update: {},
    create: { username }
  });

  const startedDate = new Date(startedAt);
  const existing = await prisma.recording.findFirst({
    where: { username, startedAt: startedDate }
  });

  const data = {
    finishedAt: finishedAt ? new Date(finishedAt) : null,
    bytes: bytes != null ? BigInt(bytes) : null,
    objectKey: objectKey || null,
    url: url || null,
    uploadStatus: 'DONE',
    deviceId: deviceId || null,
    localPath: localPath || null
  };

  const recording = existing
    ? await prisma.recording.update({ where: { id: existing.id }, data })
    : await prisma.recording.create({ data: { username, startedAt: startedDate, ...data } });

  if (localPath) {
    enqueue('media', () => extractMetadata(recording.id, localPath), `metadata:${recording.id}`);
    enqueue('media', () => generateThumbnail(recording.id, localPath), `thumbnail:${recording.id}`);
    enqueue('media', () => checkDuplicate(recording.id, localPath), `checksum:${recording.id}`);
  }

  return recording;
}

export async function listRecordings({ page = 1, limit = 20, username, uploadStatus, isDuplicate, tagId, startDate, endDate } = {}) {
  const where = {};
  if (username) where.username = { contains: username };
  if (uploadStatus) where.uploadStatus = uploadStatus;
  if (typeof isDuplicate === 'boolean') where.isDuplicate = isDuplicate;
  if (tagId) where.tags = { some: { tagId } };
  if (startDate || endDate) {
    where.startedAt = {};
    if (startDate) where.startedAt.gte = new Date(startDate);
    if (endDate) where.startedAt.lte = new Date(endDate);
  }
  const [total, recordings] = await Promise.all([
    prisma.recording.count({ where }),
    prisma.recording.findMany({
      where,
      orderBy: { startedAt: 'desc' },
      skip: (page - 1) * limit,
      take: limit,
      include: { tags: { include: { tag: true } } }
    })
  ]);
  return { total, page, limit, recordings };
}

export async function getRecording(id) {
  const r = await prisma.recording.findUnique({
    where: { id },
    include: { tags: { include: { tag: true } }, device: { select: { id: true, name: true, hostname: true } } }
  });
  if (!r) throw Object.assign(new Error('Recording not found'), { status: 404 });
  return r;
}

export async function deleteRecording(id, actorId) {
  const r = await prisma.recording.findUnique({ where: { id } });
  if (!r) throw Object.assign(new Error('Recording not found'), { status: 404 });
  await prisma.recording.delete({ where: { id } });
  await audit({
    userId: actorId,
    action: 'RECORDING_DELETED',
    resource: 'recording',
    resourceId: id,
    meta: { username: r.username }
  });
}
