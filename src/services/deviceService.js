import bcrypt from 'bcryptjs';
import crypto from 'node:crypto';
import { prisma } from '../db/client.js';
import { log as audit } from './auditService.js';

export async function registerDevice({ name, hostname, os, version, ipAddress }, actorId) {
  const secret = crypto.randomBytes(32).toString('hex');
  const secretHash = await bcrypt.hash(secret, 10);
  const device = await prisma.device.create({
    data: {
      name,
      hostname,
      os: os || null,
      ipAddress: ipAddress || null,
      secretHash,
      version: version || null
    }
  });
  await audit({
    userId: actorId,
    action: 'DEVICE_REGISTERED',
    resource: 'device',
    resourceId: device.id,
    meta: { name, hostname }
  });
  return { ...sanitize(device), secret };
}

export async function authenticateDevice(deviceId, secret) {
  const device = await prisma.device.findUnique({ where: { id: deviceId } });
  if (!device || !device.enabled) return null;
  const ok = await bcrypt.compare(secret, device.secretHash);
  return ok ? device : null;
}

export async function listDevices() {
  const devices = await prisma.device.findMany({ orderBy: { createdAt: 'asc' } });
  return devices.map(sanitize);
}

export async function getDevice(id) {
  const d = await prisma.device.findUnique({
    where: { id },
    include: { creators: { include: { creator: true } } }
  });
  if (!d) throw Object.assign(new Error('Device not found'), { status: 404 });
  return sanitize(d);
}

export async function updateDevice(id, data, actorId) {
  const allowed = {};
  if (data.name) allowed.name = data.name;
  if (typeof data.enabled === 'boolean') allowed.enabled = data.enabled;
  const device = await prisma.device.update({ where: { id }, data: allowed });
  await audit({
    userId: actorId,
    action: 'DEVICE_UPDATED',
    resource: 'device',
    resourceId: id,
    meta: allowed
  });
  return sanitize(device);
}

export async function heartbeat(deviceId, { cpuPercent, ramPercent, diskPercent, version, ipAddress }) {
  return prisma.device.update({
    where: { id: deviceId },
    data: {
      lastSeen: new Date(),
      cpuPercent: cpuPercent ?? null,
      ramPercent: ramPercent ?? null,
      diskPercent: diskPercent ?? null,
      version: version ?? undefined,
      ipAddress: ipAddress ?? undefined
    }
  });
}

export async function deleteDevice(id, actorId) {
  await prisma.device.delete({ where: { id } });
  await audit({ userId: actorId, action: 'DEVICE_DELETED', resource: 'device', resourceId: id });
}

export async function assignCreator(deviceId, creatorUsername, actorId) {
  const clean = creatorUsername.replace(/^@/, '').toLowerCase();
  let creator = await prisma.creator.findUnique({ where: { username: clean } });
  if (!creator) {
    creator = await prisma.creator.create({ data: { username: clean } });
  }
  await prisma.creatorDevice.upsert({
    where: { creatorId_deviceId: { creatorId: creator.id, deviceId } },
    update: {},
    create: { creatorId: creator.id, deviceId }
  });
  await audit({
    userId: actorId,
    action: 'CREATOR_ASSIGNED',
    resource: 'device',
    resourceId: deviceId,
    meta: { creatorUsername: clean }
  });
}

function sanitize(d) {
  const { secretHash, ...rest } = d;
  return rest;
}
