import { Router } from 'express';
import { getOverview, getCreatorStats, getStorageStats } from '../../services/analyticsService.js';
import { getStats as queueStats, getHistory as queueHistory } from '../../services/jobQueue.js';
import { requireAuth } from '../middleware/auth.js';
import { isAdmin } from '../middleware/rbac.js';

const router = Router();
router.use(requireAuth, isAdmin);

router.get('/overview', async (_req, res, next) => { try { res.json(await getOverview()); } catch (e) { next(e); } });
router.get('/creators', async (_req, res, next) => { try { res.json(await getCreatorStats()); } catch (e) { next(e); } });
router.get('/storage', async (_req, res, next) => { try { res.json(await getStorageStats()); } catch (e) { next(e); } });
router.get('/jobs', async (_req, res, next) => { try { res.json({ queues: queueStats(), history: queueHistory(20) }); } catch (e) { next(e); } });

export default router;
