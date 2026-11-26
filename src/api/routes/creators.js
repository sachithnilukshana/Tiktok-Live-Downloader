import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../../db/client.js';
import { log as audit } from '../../services/auditService.js';
import { requireAuth } from '../middleware/auth.js';
import { isAdmin, isOperator } from '../middleware/rbac.js';
import { validate } from '../middleware/validate.js';

const router = Router();
router.use(requireAuth);

const AddSchema = z.object({
  username: z.string().min(2).max(24).regex(/^[a-z0-9._]+$/)
});

const UpdateSchema = z.object({
  enabled: z.boolean()
});

router.get('/', isOperator, async (_req, res, next) => {
  try {
    const creators = await prisma.creator.findMany({ orderBy: { username: 'asc' } });
    res.json(creators);
  } catch (e) {
    next(e);
  }
});

router.post('/', isAdmin, validate(AddSchema), async (req, res, next) => {
  try {
    const { username } = req.body;
    const creator = await prisma.creator.upsert({
      where: { username },
      update: { enabled: true },
      create: { username }
    });
    await audit({
      userId: req.user.sub,
      action: 'CREATOR_ADDED',
      resource: 'creator',
      resourceId: creator.id,
      meta: { username }
    });
    res.status(201).json(creator);
  } catch (e) {
    next(e);
  }
});

router.patch('/:id', isAdmin, validate(UpdateSchema), async (req, res, next) => {
  try {
    const { enabled } = req.body;
    const creator = await prisma.creator.update({
      where: { id: req.params.id },
      data: { enabled }
    });
    await audit({
      userId: req.user.sub,
      action: 'CREATOR_UPDATED',
      resource: 'creator',
      resourceId: req.params.id,
      meta: { enabled }
    });
    res.json(creator);
  } catch (e) {
    next(e);
  }
});

router.delete('/:id', isAdmin, async (req, res, next) => {
  try {
    const c = await prisma.creator.delete({ where: { id: req.params.id } });
    await audit({
      userId: req.user.sub,
      action: 'CREATOR_REMOVED',
      resource: 'creator',
      resourceId: req.params.id,
      meta: { username: c.username }
    });
    res.json({ ok: true });
  } catch (e) {
    next(e);
  }
});

export default router;
