import { io, Socket } from 'socket.io-client';

let socket: Socket | null = null;

export function getSocket(): Socket {
  if (!socket) {
    const url = import.meta.env.PROD
      ? 'https://osi-logistics-backend.onrender.com'
      : 'http://localhost:3001';
    socket = io(url, {
      transports: ['polling', 'websocket'],
    });
  }
  return socket;
}

export function disconnectSocket(): void {
  if (socket) {
    socket.disconnect();
    socket = null;
  }
}
