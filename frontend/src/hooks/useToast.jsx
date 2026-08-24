import { createContext, useCallback, useContext, useRef, useState } from 'react'

const ToastContext = createContext(null)

const DURATIONS = { success: 5000, info: 5000, warning: 8000, error: null }

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([])
  const idRef = useRef(0)

  const dismiss = useCallback((id) => {
    setToasts((current) => current.filter((t) => t.id !== id))
  }, [])

  const showToast = useCallback(
    (message, variant = 'info') => {
      const id = ++idRef.current
      setToasts((current) => {
        const next = [...current, { id, message, variant }]
        return next.length > 3 ? next.slice(next.length - 3) : next
      })
      const duration = DURATIONS[variant]
      if (duration) {
        setTimeout(() => dismiss(id), duration)
      }
      return id
    },
    [dismiss]
  )

  return (
    <ToastContext.Provider value={{ toasts, showToast, dismiss }}>
      {children}
    </ToastContext.Provider>
  )
}

export function useToast() {
  const ctx = useContext(ToastContext)
  if (!ctx) throw new Error('useToast must be used within a ToastProvider')
  return ctx
}
