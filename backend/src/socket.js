import {Server as SocketIOServer} from 'socket.io';

let io = null;

export function initSocket(httpServer, clientOrigin) {
  io = new SocketIOServer(httpServer, {
    cors: {
      origin: clientOrigin,
      methods: ['GET', 'POST', 'PATCH'],
    },
  });

  io.on('connection', socket => {
    socket.emit('system:connected', {
      connectedAt: new Date().toISOString(),
      message: 'Connected to ResQ AI realtime server',
    });
  });

  return io;
}

export function getSocketServer() {
  return io;
}

export function emitEvent(eventName, payload) {
  if (!io) {
    return;
  }

  io.emit(eventName, payload);
}
