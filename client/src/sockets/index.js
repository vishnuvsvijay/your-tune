import { io } from 'socket.io-client'
import { getServerBase } from '../services/api'

const socketUrl = import.meta.env.VITE_SOCKET_URL || getServerBase()

export const socket = io(socketUrl, {
  autoConnect: false,
  withCredentials: true,
  transports: ['websocket', 'polling']
})

export const connectSocket = (token) => {
  if (token) socket.auth = { token }
  socket.connect()
}

export const disconnectSocket = () => {
  socket.disconnect()
}
