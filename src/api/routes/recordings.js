import { Router } from 'express';
import { listRecordings, getRecording, deleteRecording } from '../../services/recordingService.js';
import { requireAuth } from '../middleware/auth.js';
import { isAdmin, isOperator } from '../middleware/rbac.js';

const router = Router();
router.use(requireAuth);

router.get('/', isOperator, async (req, res, next) => {
  try {
    const { page, limit, username, uploadStatus, isDuplicate, tagId, startDate, endDate } = req.query;
    res.json(await listRecordings({
      page: parseInt(page, 10) || 1,
      limit: Math.min(parseInt(limit, 10) || 20, 100),
      username,
      uploadStatus,
      isDuplicate: isDuplicate === 'true' ? true : isDuplicate === 'false' ? false : undefined,
      tagId,
      startDate,
      endDate
    }));
  } catch (e) {
    next(e);
  }
});

router.get('/:id', isOperator, async (req, res, next) => {
  try {
    res.json(await getRecording(req.params.id));
  } catch (e) {
    next(e);
  }
});

router.delete('/:id', isAdmin, async (req, res, next) => {
  try {
    await deleteRecording(req.params.id, req.user.sub);
    res.json({ ok: true });
  } catch (e) {
    next(e);
  }
});

export default router;
