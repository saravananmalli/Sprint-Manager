import axios from 'axios'

const client = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000',
  headers: { 'Content-Type': 'application/json' },
})

const AUTH_STORAGE_KEY = 'sprint-agent-auth'

let unauthorizedHandler = null
export function registerUnauthorizedHandler(handler) {
  unauthorizedHandler = handler
}

client.interceptors.request.use((config) => {
  const raw = localStorage.getItem(AUTH_STORAGE_KEY)
  if (raw) {
    try {
      const { token } = JSON.parse(raw)
      if (token) config.headers.Authorization = `Bearer ${token}`
    } catch {
      // ignore malformed storage
    }
  }
  return config
})

client.interceptors.response.use(
  (response) => response,
  (error) => {
    const status = error.response?.status
    const data = error.response?.data
    const message = data?.error || error.message || 'Something went wrong'
    const isLoginCall = error.config?.url?.includes('/api/auth/login')
    if (status === 401 && !isLoginCall) unauthorizedHandler?.()
    return Promise.reject({ message, status, code: data?.code })
  }
)

export default client
