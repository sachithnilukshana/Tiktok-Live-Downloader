import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { prisma } from '../db/client.js';

const ACCESS_SECRET = process.env.JWT_ACCESS_SECRET || 'change-me-access-secret';
const REFRESH_SECRET = process.env.JWT_REFRESH_SECRET || 'change-me-refresh-secret';
const ACCESS_TTL = '15m';
const REFRESH_TTL = '7d';

export function signAccess(payload) {
  return jwt.sign(payload, ACCESS_SECRET, { expiresIn: ACCESS_TTL });
}

export function signRefresh(payload) {
  return jwt.sign(payload, REFRESH_SECRET, { expiresIn: REFRESH_TTL });
}

export function verifyAccess(token) {
  return jwt.verify(token, ACCESS_SECRET);
}

export function verifyRefresh(token) {
  return jwt.verify(token, REFRESH_SECRET);
}

export async function login(username, password, ip) {
  const user = await prisma.user.findUnique({ where: { username } });
  if (!user || !user.enabled) {
    await prisma.auditEvent.create({
      data: {
        username,
        action: 'LOGIN_FAILED',
        resource: 'auth',
        success: false,
        ipAddress: ip,
        meta: JSON.stringify({ reason: user ? 'disabled' : 'not_found' })
      }
    });
    throw Object.assign(new Error('Invalid credentials'), { status: 401 });
  }
  const ok = await bcrypt.compare(password, user.passwordHash);
  if (!ok) {
    await prisma.auditEvent.create({
      data: {
        userId: user.id,
        username: user.username,
        action: 'LOGIN_FAILED',
        resource: 'auth',
        success: false,
        ipAddress: ip,
        meta: JSON.stringify({ reason: 'wrong_password' })
      }
    });
    throw Object.assign(new Error('Invalid credentials'), { status: 401 });
  }
  const payload = { sub: user.id, role: user.role, username: user.username };
  const accessToken = signAccess(payload);
  const refreshToken = signRefresh(payload);
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
  await prisma.session.create({ data: { userId: user.id, token: refreshToken, expiresAt } });
  await prisma.auditEvent.create({
    data: { userId: user.id, username: user.username, action: 'LOGIN', resource: 'auth', success: true, ipAddress: ip }
  });
  return {
    accessToken,
    refreshToken,
    user: { id: user.id, username: user.username, email: user.email, role: user.role }
  };
}

export async function logout(refreshToken, userId) {
  if (refreshToken) {
    await prisma.session.deleteMany({ where: { token: refreshToken } });
  }
  await prisma.auditEvent.create({
    data: { userId, action: 'LOGOUT', resource: 'auth', success: true }
  });
}

export async function refresh(refreshToken) {
  try {
    verifyRefresh(refreshToken);
  } catch {
    throw Object.assign(new Error('Invalid refresh token'), { status: 401 });
  }
  const session = await prisma.session.findUnique({ where: { token: refreshToken } });
  if (!session || session.expiresAt < new Date()) {
    throw Object.assign(new Error('Session expired'), { status: 401 });
  }
  const user = await prisma.user.findUnique({ where: { id: session.userId } });
  if (!user || !user.enabled) {
    throw Object.assign(new Error('Account disabled'), { status: 401 });
  }
  const newPayload = { sub: user.id, role: user.role, username: user.username };
  return { accessToken: signAccess(newPayload) };
}

export async function createUser({ username, email, password, role }, actorId) {
  const existing = await prisma.user.findFirst({ where: { OR: [{ username }, { email }] } });
  if (existing) throw Object.assign(new Error('Username or email already exists'), { status: 409 });
  if (password.length < 8) throw Object.assign(new Error('Password too short'), { status: 400 });
  const passwordHash = await bcrypt.hash(password, 12);
  const user = await prisma.user.create({
    data: { username, email, passwordHash, role: role || 'VIEWER' }
  });
  await prisma.auditEvent.create({
    data: {
      userId: actorId,
      action: 'USER_CREATED',
      resource: 'user',
      resourceId: user.id,
      success: true,
      meta: JSON.stringify({ username, role: user.role })
    }
  });
  return {
    id: user.id,
    username: user.username,
    email: user.email,
    role: user.role,
    enabled: user.enabled,
    createdAt: user.createdAt
  };
}

export async function changePassword(userId, oldPassword, newPassword) {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) throw Object.assign(new Error('User not found'), { status: 404 });
  const ok = await bcrypt.compare(oldPassword, user.passwordHash);
  if (!ok) throw Object.assign(new Error('Current password incorrect'), { status: 400 });
  if (newPassword.length < 8) throw Object.assign(new Error('Password too short'), { status: 400 });
  const passwordHash = await bcrypt.hash(newPassword, 12);
  await prisma.user.update({ where: { id: userId }, data: { passwordHash } });
  await prisma.session.deleteMany({ where: { userId } });
}

export async function listUsers() {
  return prisma.user.findMany({
    select: { id: true, username: true, email: true, role: true, enabled: true, createdAt: true }
  });
}

export async function updateUser(id, data, actorId) {
  const allowed = {};
  if (data.role) allowed.role = data.role;
  if (typeof data.enabled === 'boolean') allowed.enabled = data.enabled;
  if (data.email) allowed.email = data.email;
  const user = await prisma.user.update({
    where: { id },
    data: allowed,
    select: { id: true, username: true, email: true, role: true, enabled: true, createdAt: true }
  });
  await prisma.auditEvent.create({
    data: {
      userId: actorId,
      action: 'USER_UPDATED',
      resource: 'user',
      resourceId: id,
      success: true,
      meta: JSON.stringify(allowed)
    }
  });
  return user;
}
