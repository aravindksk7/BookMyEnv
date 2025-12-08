'use client';

import { io, Socket } from 'socket.io-client';

// Use empty string for production (connects to same origin via nginx proxy)
// For local dev without nginx, set NEXT_PUBLIC_WS_URL=http://localhost:5000
const WS_URL = process.env.NEXT_PUBLIC_WS_URL || '';

let socket: Socket | null = null;

export const getSocket = (): Socket => {
  if (!socket) {
    // When WS_URL is empty, socket.io connects to the current page origin
    socket = io(WS_URL || undefined, {
      autoConnect: false,
      path: '/socket.io',
    });
  }
  return socket;
};

export const connectSocket = (token: string) => {
  const socket = getSocket();
  socket.auth = { token };
  socket.connect();
  return socket;
};

export const disconnectSocket = () => {
  if (socket) {
    socket.disconnect();
    socket = null;
  }
};

export const subscribeToRoom = (room: string) => {
  const socket = getSocket();
  socket.emit('join', room);
};

export const unsubscribeFromRoom = (room: string) => {
  const socket = getSocket();
  socket.emit('leave', room);
};

export default getSocket;
