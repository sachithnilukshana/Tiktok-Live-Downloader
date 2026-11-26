import { prisma } from '../db/client.js';

export async function log({ userId, username, action, resource, resourceId, deviceId, ipAddress, success = true, meta }) {
  try {
    await prisma.auditEvent.create({
      data: {
        userId: userId || null,
        username: username || null,
        action,
        resource: resource || null,
        resourceId: resourceId || null,
        deviceId: deviceId || null,
        ipAddress: ipAddress || null,
        success,
        meta: meta ? JSON.stringify(meta) : null
      }
    });
  } catch (e) {
    console.error('[audit] Failed to write audit event:', e.message);
  }
}

export async function listEvents({ page = 1, limit = 50, action, userId, resource, success, startDate, endDate } = {}) {
  const where = {};
  if (action) where.action = { contains: action };
  if (userId) where.userId = userId;
  if (resource) where.resource = resource;
  if (typeof success === 'boolean') where.success = success;
  if (startDate || endDate) {
    where.createdAt = {};
    if (startDate) where.createdAt.gte = new Date(startDate);
    if (endDate) where.createdAt.lte = new Date(endDate);
  }
  const [total, events] = await Promise.all([
    prisma.auditEvent.count({ where }),
    prisma.auditEvent.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * limit,
      take: limit
    })
  ]);
  return { total, page, limit, events };
}
