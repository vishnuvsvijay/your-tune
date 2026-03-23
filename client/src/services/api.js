import axios from 'axios'

const api = axios.create({
  baseURL: '/api', // proxy handle pannum
  withCredentials: true,
})

api.interceptors.request.use((config) => {
  try {
    const url = (config?.url || '').toString()
    // Do not attach Authorization for login/register
    if (/^\/auth\/(login|register)$/.test(url)) return config
    const token = localStorage.getItem('token')
    if (token && token.split('.').length === 3) {
      config.headers.Authorization = `Bearer ${token}`
    }
  } catch (e) { void e }
  return config
})

api.interceptors.response.use(
  (res) => res,
  (err) => {
    console.error("API ERROR:", err?.response?.data || err.message)
    return Promise.reject(err)
  }
)

export const getServerBase = () => {
  if (import.meta.env.PROD) {
    return import.meta.env.VITE_API_URL || ''
  }
  return 'http://localhost:5001'
}

export default api
