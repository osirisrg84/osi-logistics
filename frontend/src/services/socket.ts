import { io, Socket } from 'socket.io-client';

let socket: Socket | null = null;

export function getSocket(): Socket {
  if (!socket) {
    // In production: VITE_API_URL = https://your-backend.onrender.com
    // In development: connect directly to localhost:3001 (bypass Vite proxy for WS)
    const url = import.meta.env.VITE_API_URL || 'http://localhost:3001';
    socket = io(url, {
      transports: ['websocket', 'polling'],
      withCredentials: true,
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
