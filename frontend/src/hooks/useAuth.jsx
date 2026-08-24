import { createContext, useCallback, useContext, useEffect, useState } from 'react'
import client, { registerUnauthorizedHandler } from '../api/client'
import { useToast } from './useToast'

const AuthContext = createContext(null)
const STORAGE_KEY = 'sprint-agent-auth'

function readStored() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    return raw ? JSON.parse(raw) : null
  } catch {
    return null
  }
}

export function AuthProvider({ children }) {
  const { showToast } = useToast()
  const [token, setToken] = useState(() => readStored()?.token || null)
  const [user, setUser] = useState(() => readStored()?.user || null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  const persist = useCallback((nextToken, nextUser) => {
    if (nextToken && nextUser) localStorage.setItem(STORAGE_KEY, JSON.stringify({ token: nextToken, user: nextUser }))
    else localStorage.removeItem(STORAGE_KEY)
  }, [])

  const clearAuth = useCallback(() => {
    setToken(null)
    setUser(null)
    persist(null, null)
  }, [persist])

  const login = useCallback(
    async (username, password) => {
      setError(null)
      try {
        const { data } = await client.post('/api/auth/login', { username, password })
        setToken(data.token)
        setUser(data.user)
        persist(data.token, data.user)
        return { ok: true }
      } catch (err) {
        setError(err)
        return { ok: false, status: err.status, message: err.message }
      }
    },
    [persist]
  )

  const logout = useCallback(async () => {
    try {
      await client.post('/api/auth/logout')
    } catch {
      // best-effort — clear local state regardless
    }
    clearAuth()
  }, [clearAuth])

  // Restore session on mount (page refresh)
  useEffect(() => {
    const stored = readStored()
    if (!stored?.token) {
      setLoading(false)
      return
    }
    client
      .get('/api/auth/me')
      .then(({ data }) => {
        setUser(data)
        persist(stored.token, data)
      })
      .catch((err) => {
        // No response at all (status undefined) means the backend is
        // unreachable, not that the session is invalid — stay optimistically
        // logged in with the stored user and let BackendBanner (driven by
        // ProjectProvider's own fetch) surface the outage instead of
        // bouncing the user to the login screen for a transient network blip.
        if (err.status) clearAuth()
      })
      .finally(() => setLoading(false))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Wire the axios 401 indirection to a real logout + toast
  useEffect(() => {
    registerUnauthorizedHandler(() => {
      if (!readStored()?.token) return // already logged out, avoid duplicate toasts
      clearAuth()
      showToast('Your session has expired. Please sign in again.', 'warning')
    })
    return () => registerUnauthorizedHandler(null)
  }, [clearAuth, showToast])

  // Existing app data routes are intentionally unauthenticated (see backend/auth.py) —
  // so nothing the user does in normal navigation would ever surface a 401 from an
  // expired session. Poll /api/auth/me periodically while logged in so expiry is
  // actually detected and the 401 handler above gets a chance to fire.
  useEffect(() => {
    if (!token) return
    const interval = setInterval(() => {
      client.get('/api/auth/me').catch(() => {
        // 401s are handled globally by the response interceptor above
      })
    }, 60000)
    return () => clearInterval(interval)
  }, [token])

  return (
    <AuthContext.Provider value={{ user, token, isAuthenticated: !!token && !!user, loading, error, login, logout }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within a AuthProvider')
  return ctx
}
