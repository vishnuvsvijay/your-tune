import { io } from 'socket.io-client'
import { getServerBase } from '../services/api'

export const socket = io(import.meta.env.VITE_SOCKET_URL || '/', {
  autoConnect: false,
})

export const connectSocket = (token) => {
  if (token) socket.auth = { token }
  socket.connect()
}

export const disconnectSocket = () => {
  socket.disconnect()
}
