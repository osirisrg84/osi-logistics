import { io, Socket } from 'socket.io-client';

let socket: Socket | null = null;

export function getSocket(): Socket {
  if (!socket) {
    const url = import.meta.env.PROD
      ? 'https://osi-logistics-backend.onrender.com'
      : 'http://localhost:3001';
    // Hasta ahora el handshake no mandaba ningun token -- el backend aceptaba
    // la conexion igual y dejaba unirse a cualquier sala. Se manda el token
    // del portal activo (driver u operador) para que el servidor verifique
    // la sesion antes de aceptar la conexion.
    const token = window.location.pathname.startsWith('/driver')
      ? localStorage.getItem('osi_driver_token')
      : localStorage.getItem('osi_token');
    socket = io(url, {
      transports: ['polling', 'websocket'],
      auth: { token },
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
