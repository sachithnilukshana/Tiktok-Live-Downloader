import { Router } from 'express';
import { z } from 'zod';
import {
  registerDevice,
  listDevices,
  getDevice,
  updateDevice,
  deleteDevice,
  heartbeat,
  authenticateDevice,
  assignCreator
} from '../../services/deviceService.js';
import { requireAuth } from '../middleware/auth.js';
import { isAdmin, isSuperAdmin } from '../middleware/rbac.js';
import { validate } from '../middleware/validate.js';
import { emitDeviceEvent } from '../../websocket/wsServer.js';

const router = Router();

const RegisterSchema = z.object({
  name: z.string().min(1),
  hostname: z.string().min(1),
  os: z.string().optional(),
  version: z.string().optional(),
  ipAddress: z.string().optional()
});

const UpdateSchema = z.object({
  name: z.string().min(1).optional(),
  enabled: z.boolean().optional()
});

const HeartbeatSchema = z.object({
  deviceId: z.string().min(1),
  deviceSecret: z.string().min(1),
  cpuPercent: z.number().min(0).max(100).optional(),
  ramPercent: z.number().min(0).max(100).optional(),
  diskPercent: z.number().min(0).max(100).optional(),
  version: z.string().optional()
});

const AssignSchema = z.object({
  username: z.string().min(2).max(24)
});

router.post('/heartbeat', validate(HeartbeatSchema), async (req, res, next) => {
  try {
    const { deviceId, deviceSecret, ...stats } = req.body;
    const device = await authenticateDevice(deviceId, deviceSecret);
    if (!device) return res.status(401).json({ error: 'Invalid device credentials' });
    const ipAddress = req.ip || req.socket?.remoteAddress;
    await heartbeat(deviceId, { ...stats, ipAddress });
    emitDeviceEvent('device:heartbeat', deviceId, { ...stats, lastSeen: new Date().toISOString() });
    res.json({ ok: true });
  } catch (e) {
    next(e);
  }
});

router.get('/', requireAuth, isAdmin, async (_req, res, next) => {
  try {
    res.json(await listDevices());
  } catch (e) {
    next(e);
  }
});

router.post('/', requireAuth, isSuperAdmin, validate(RegisterSchema), async (req, res, next) => {
  try {
    const device = await registerDevice(req.body, req.user.sub);
    res.status(201).json(device);
  } catch (e) {
    next(e);
  }
});

router.get('/:id', requireAuth, isAdmin, async (req, res, next) => {
  try {
    res.json(await getDevice(req.params.id));
  } catch (e) {
    next(e);
  }
});

router.patch('/:id', requireAuth, isSuperAdmin, validate(UpdateSchema), async (req, res, next) => {
  try {
    res.json(await updateDevice(req.params.id, req.body, req.user.sub));
  } catch (e) {
    next(e);
  }
});

router.delete('/:id', requireAuth, isSuperAdmin, async (req, res, next) => {
  try {
    await deleteDevice(req.params.id, req.user.sub);
    res.json({ ok: true });
  } catch (e) {
    next(e);
  }
});

router.post('/:id/assign', requireAuth, isAdmin, validate(AssignSchema), async (req, res, next) => {
  try {
    await assignCreator(req.params.id, req.body.username, req.user.sub);
    res.json({ ok: true });
  } catch (e) {
    next(e);
  }
});

export default router;
