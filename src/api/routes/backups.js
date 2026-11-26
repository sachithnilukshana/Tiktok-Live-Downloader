import { Router } from 'express';
import { prisma } from '../../db/client.js';
import { log as audit } from '../../services/auditService.js';
import { requireAuth } from '../middleware/auth.js';
import { isAdmin, isSuperAdmin } from '../middleware/rbac.js';

const router = Router();
router.use(requireAuth);

router.get('/', isAdmin, async (_req, res, next) => {
  try { res.json(await prisma.backup.findMany({ orderBy: { createdAt: 'desc' } })); } catch (e) { next(e); }
});

router.post('/', isSuperAdmin, async (req, res, next) => {
  try {
    const backup = await prisma.backup.create({
      data: { status: 'PENDING', notes: req.body?.notes || null }
    });
    await audit({ userId: req.user.sub, action: 'BACKUP_CREATED', resource: 'backup', resourceId: backup.id });
    res.status(202).json({ ...backup, message: 'Backup queued. Check /api/backups for status.' });
  } catch (e) {
    next(e);
  }
});

router.get('/:id', isAdmin, async (req, res, next) => {
  try {
    const b = await prisma.backup.findUnique({ where: { id: req.params.id } });
    if (!b) return res.status(404).json({ error: 'Backup not found' });
    res.json(b);
  } catch (e) {
    next(e);
  }
});

export default router;
