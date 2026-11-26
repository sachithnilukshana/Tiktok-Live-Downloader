import { Router } from 'express';
import { z } from 'zod';
import { createUser, listUsers, updateUser } from '../../services/authService.js';
import { requireAuth } from '../middleware/auth.js';
import { isSuperAdmin, isAdmin } from '../middleware/rbac.js';
import { validate } from '../middleware/validate.js';

const router = Router();
router.use(requireAuth);

const CreateUserSchema = z.object({
  username: z.string().min(2).max(32),
  email: z.string().email(),
  password: z.string().min(8),
  role: z.enum(['SUPER_ADMIN', 'ADMIN', 'OPERATOR', 'VIEWER']).optional()
});

const UpdateUserSchema = z.object({
  role: z.enum(['SUPER_ADMIN', 'ADMIN', 'OPERATOR', 'VIEWER']).optional(),
  enabled: z.boolean().optional(),
  email: z.string().email().optional()
});

router.get('/', isAdmin, async (_req, res, next) => {
  try {
    res.json(await listUsers());
  } catch (e) {
    next(e);
  }
});

router.post('/', isSuperAdmin, validate(CreateUserSchema), async (req, res, next) => {
  try {
    res.status(201).json(await createUser(req.body, req.user.sub));
  } catch (e) {
    next(e);
  }
});

router.patch('/:id', isSuperAdmin, validate(UpdateUserSchema), async (req, res, next) => {
  try {
    res.json(await updateUser(req.params.id, req.body, req.user.sub));
  } catch (e) {
    next(e);
  }
});

export default router;
