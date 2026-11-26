import { Router } from 'express';
import { z } from 'zod';
import { login, logout, refresh, changePassword } from '../../services/authService.js';
import { requireAuth } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import { loginLimiter } from '../middleware/rateLimiter.js';

const router = Router();

const LoginSchema = z.object({
  username: z.string().min(1),
  password: z.string().min(1)
});

const ChangePasswordSchema = z.object({
  oldPassword: z.string().min(1),
  newPassword: z.string().min(8)
});

router.post('/login', loginLimiter, validate(LoginSchema), async (req, res, next) => {
  try {
    const ip = req.ip || req.socket?.remoteAddress;
    const data = await login(req.body.username, req.body.password, ip);
    res.cookie('refreshToken', data.refreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: 7 * 24 * 60 * 60 * 1000
    });
    res.json({ accessToken: data.accessToken, user: data.user });
  } catch (e) {
    next(e);
  }
});

router.post('/logout', requireAuth, async (req, res, next) => {
  try {
    const rt = req.cookies?.refreshToken;
    await logout(rt, req.user.sub);
    res.clearCookie('refreshToken');
    res.json({ ok: true });
  } catch (e) {
    next(e);
  }
});

router.post('/refresh', async (req, res, next) => {
  try {
    const rt = req.cookies?.refreshToken;
    if (!rt) return res.status(401).json({ error: 'No refresh token' });
    const { accessToken } = await refresh(rt);
    res.json({ accessToken });
  } catch (e) {
    next(e);
  }
});

router.get('/me', requireAuth, (req, res) => {
  res.json({ user: req.user });
});

router.post('/change-password', requireAuth, validate(ChangePasswordSchema), async (req, res, next) => {
  try {
    await changePassword(req.user.sub, req.body.oldPassword, req.body.newPassword);
    res.clearCookie('refreshToken');
    res.json({ ok: true, message: 'Password changed. All sessions revoked.' });
  } catch (e) {
    next(e);
  }
});

export default router;
