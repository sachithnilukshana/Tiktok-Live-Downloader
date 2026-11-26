import { prisma } from '../db/client.js';

export async function getOverview() {
  const [
    totalCreators,
    totalRecordings,
    activeRecordingsCount,
    totalDevices,
    connectedDevices,
    uploadStats,
    sizeAgg
  ] = await Promise.all([
    prisma.creator.count({ where: { enabled: true } }),
    prisma.recording.count(),
    prisma.recording.count({ where: { finishedAt: null } }),
    prisma.device.count(),
    prisma.device.count({
      where: {
        enabled: true,
        lastSeen: { gte: new Date(Date.now() - 2 * 60 * 1000) }
      }
    }),
    prisma.recording.groupBy({
      by: ['uploadStatus'],
      _count: { id: true }
    }),
    prisma.recording.aggregate({ _sum: { bytes: true } })
  ]);

  const uploadMap = Object.fromEntries(uploadStats.map(s => [s.uploadStatus, s._count.id]));
  const done = uploadMap.DONE || 0;
  const failed = uploadMap.FAILED || 0;
  const total = done + failed;
  const uploadSuccessRate = total > 0 ? Math.round((done / total) * 100) : 100;
  const totalBytes = Number(sizeAgg._sum.bytes || 0n);

  return {
    totalCreators,
    totalRecordings,
    activeRecordings: activeRecordingsCount,
    totalDevices,
    connectedDevices,
    disconnectedDevices: totalDevices - connectedDevices,
    uploadSuccessRate,
    totalBytes
  };
}

export async function getCreatorStats() {
  const creators = await prisma.creator.findMany({ include: { recordings: true } });
  return creators.map(c => ({
    username: c.username,
    enabled: c.enabled,
    totalRecordings: c.recordings.length,
    totalBytes: c.recordings.reduce((acc, r) => acc + Number(r.bytes || 0n), 0)
  }));
}

export async function getStorageStats() {
  const rows = await prisma.recording.groupBy({
    by: ['username'],
    _sum: { bytes: true },
    _count: { id: true }
  });
  return rows.map(r => ({
    username: r.username,
    totalBytes: Number(r._sum.bytes || 0n),
    totalCount: r._count.id
  }));
}
