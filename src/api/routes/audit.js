import { Router } from 'express';
import { listEvents } from '../../services/auditService.js';
import { requireAuth } from '../middleware/auth.js';
import { isAdmin } from '../middleware/rbac.js';

const router = Router();
router.use(requireAuth, isAdmin);

router.get('/', async (req, res, next) => {
  try {
    const { page, limit, action, userId, resource, success, startDate, endDate } = req.query;
    res.json(await listEvents({
      page: parseInt(page, 10) || 1,
      limit: Math.min(parseInt(limit, 10) || 50, 200),
      action,
      userId,
      resource,
      success: success === 'true' ? true : success === 'false' ? false : undefined,
      startDate,
      endDate
    }));
  } catch (e) {
    next(e);
  }
});

export default router;
