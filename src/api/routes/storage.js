import { Router } from 'express';
import { z } from 'zod';
import { getStorageStats } from '../../services/analyticsService.js';
import { prisma } from '../../db/client.js';
import { log as audit } from '../../services/auditService.js';
import { requireAuth } from '../middleware/auth.js';
import { isAdmin, isSuperAdmin } from '../middleware/rbac.js';
import { validate } from '../middleware/validate.js';

const router = Router();
router.use(requireAuth);

const PolicySchema = z.object({
  name: z.string().min(1),
  retainDays: z.number().int().positive().nullable().optional(),
  retainCount: z.number().int().positive().nullable().optional(),
  protectTags: z.array(z.string()).optional(),
  enabled: z.boolean().optional()
});

router.get('/stats', isAdmin, async (_req, res, next) => {
  try { res.json(await getStorageStats()); } catch (e) { next(e); }
});

router.get('/policies', isAdmin, async (_req, res, next) => {
  try { res.json(await prisma.storagePolicy.findMany()); } catch (e) { next(e); }
});

router.post('/policies', isSuperAdmin, validate(PolicySchema), async (req, res, next) => {
  try {
    const { name, retainDays, retainCount, protectTags, enabled } = req.body;
    const policy = await prisma.storagePolicy.create({
      data: {
        name,
        retainDays: retainDays ?? null,
        retainCount: retainCount ?? null,
        protectTags: JSON.stringify(protectTags || []),
        enabled: enabled ?? true
      }
    });
    await audit({ userId: req.user.sub, action: 'STORAGE_POLICY_CREATED', resource: 'storagePolicy', resourceId: policy.id });
    res.status(201).json(policy);
  } catch (e) {
    next(e);
  }
});

router.patch('/policies/:id', isSuperAdmin, validate(PolicySchema.partial()), async (req, res, next) => {
  try {
    const data = { ...req.body };
    if (Array.isArray(data.protectTags)) {
      data.protectTags = JSON.stringify(data.protectTags);
    }
    const policy = await prisma.storagePolicy.update({ where: { id: req.params.id }, data });
    await audit({ userId: req.user.sub, action: 'STORAGE_POLICY_UPDATED', resource: 'storagePolicy', resourceId: req.params.id });
    res.json(policy);
  } catch (e) {
    next(e);
  }
});

router.delete('/policies/:id', isSuperAdmin, async (req, res, next) => {
  try {
    await prisma.storagePolicy.delete({ where: { id: req.params.id } });
    await audit({ userId: req.user.sub, action: 'STORAGE_POLICY_DELETED', resource: 'storagePolicy', resourceId: req.params.id });
    res.json({ ok: true });
  } catch (e) {
    next(e);
  }
});

export default router;
