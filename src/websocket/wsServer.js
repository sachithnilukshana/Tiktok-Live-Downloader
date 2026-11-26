import { Server as SocketIOServer } from 'socket.io';
import { verifyAccess } from '../services/authService.js';

let io = null;

export function createWsServer(httpServer) {
  io = new SocketIOServer(httpServer, {
    cors: {
      origin: process.env.DASHBOARD_ORIGIN || 'http://localhost:5173',
      credentials: true
    },
    transports: ['websocket', 'polling']
  });

  io.use((socket, next) => {
    const token =
      socket.handshake.auth?.token ||
      socket.handshake.headers?.authorization?.replace('Bearer ', '');
    if (!token) return next(new Error('Authentication required'));
    try {
      socket.user = verifyAccess(token);
      next();
    } catch {
      next(new Error('Invalid token'));
    }
  });

  io.on('connection', socket => {
    console.log(`[ws] Client connected: ${socket.user.username} (${socket.id})`);
    socket.join(`user:${socket.user.sub}`);

    socket.on('subscribe:device', id => socket.join(`device:${id}`));
    socket.on('unsubscribe:device', id => socket.leave(`device:${id}`));
    socket.on('subscribe:creator', u => socket.join(`creator:${u}`));
    socket.on('unsubscribe:creator', u => socket.leave(`creator:${u}`));

    socket.on('disconnect', () => {
      console.log(`[ws] Client disconnected: ${socket.user.username}`);
    });
  });

  return io;
}

export function emit(event, data, room = null) {
  if (!io) return;
  if (room) io.to(room).emit(event, data);
  else io.emit(event, data);
}

export function emitToAll(event, data) {
  emit(event, data);
}

export function emitDeviceEvent(event, deviceId, data) {
  emit(event, { deviceId, ...data }, `device:${deviceId}`);
  emitToAll(event, { deviceId, ...data });
}

export function emitRecordingEvent(event, username, data) {
  emit(event, { username, ...data }, `creator:${username}`);
  emitToAll(event, { username, ...data });
}
