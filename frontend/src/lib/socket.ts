'use client';

import { io, Socket } from 'socket.io-client';

const WS_URL = process.env.NEXT_PUBLIC_WS_URL || 'http://localhost:5000';

let socket: Socket | null = null;

export const getSocket = (): Socket => {
  if (!socket) {
    socket = io(WS_URL, {
      autoConnect: false,
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
