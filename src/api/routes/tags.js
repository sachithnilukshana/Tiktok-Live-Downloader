import { Router } from 'express';
import { z } from 'zod';
import { listTags, createTag, updateTag, deleteTag, assignTag, removeTag } from '../../services/tagService.js';
import { requireAuth } from '../middleware/auth.js';
import { isAdmin, isOperator } from '../middleware/rbac.js';
import { validate } from '../middleware/validate.js';

const router = Router();
router.use(requireAuth);

const TagSchema = z.object({
  name: z.string().min(1).max(40),
  color: z.string().optional()
});

const AssignTagSchema = z.object({
  recordingId: z.string().min(1),
  tagId: z.string().min(1)
});

router.get('/', isOperator, async (_req, res, next) => {
  try { res.json(await listTags()); } catch (e) { next(e); }
});

router.post('/', isAdmin, validate(TagSchema), async (req, res, next) => {
  try { res.status(201).json(await createTag(req.body, req.user.sub)); } catch (e) { next(e); }
});

router.patch('/:id', isAdmin, validate(TagSchema.partial()), async (req, res, next) => {
  try { res.json(await updateTag(req.params.id, req.body, req.user.sub)); } catch (e) { next(e); }
});

router.delete('/:id', isAdmin, async (req, res, next) => {
  try { await deleteTag(req.params.id, req.user.sub); res.json({ ok: true }); } catch (e) { next(e); }
});

router.post('/assign', isOperator, validate(AssignTagSchema), async (req, res, next) => {
  try {
    await assignTag(req.body.recordingId, req.body.tagId, req.user.sub);
    res.json({ ok: true });
  } catch (e) {
    next(e);
  }
});

router.post('/remove', isOperator, validate(AssignTagSchema), async (req, res, next) => {
  try {
    await removeTag(req.body.recordingId, req.body.tagId, req.user.sub);
    res.json({ ok: true });
  } catch (e) {
    next(e);
  }
});

export default router;
