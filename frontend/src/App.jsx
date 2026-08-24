import { Component, useCallback, useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { Navigate, Route, Routes, useNavigate } from 'react-router-dom'
import BackendBanner from './components/common/BackendBanner'
import FloatingAiButton from './components/common/FloatingAiButton'
import Spinner from './components/common/Spinner'
import ToastContainer from './components/common/Toast'
import CommandPalette from './components/layout/CommandPalette'
import Header from './components/layout/Header'
import Sidebar from './components/layout/Sidebar'
import OnboardingModal from './components/onboarding/OnboardingModal'
import { AgentRunProvider } from './hooks/useAgentRun'
import { AuthProvider, useAuth } from './hooks/useAuth'
import { ProjectProvider } from './hooks/useProjects'
import { ThemeProvider } from './hooks/useTheme'
import { ToastProvider } from './hooks/useToast'
import AllProjectsPage from './pages/AllProjectsPage'
import AnalyticsPage from './pages/AnalyticsPage'
import Dashboard from './pages/Dashboard'
import KanbanPage from './pages/KanbanPage'
import LoginPage from './pages/LoginPage'
import ReportsPage from './pages/ReportsPage'
import SettingsPage from './pages/SettingsPage'
import SlackPage from './pages/SlackPage'
import TeamPage from './pages/TeamPage'
import { GO_TO_ROUTES, NAV_ITEMS } from './utils/navItems'
import { hasSeenOnboarding, markOnboardingSeen } from './utils/onboarding'

const SHORTCUTS = [
  { keys: 'Ctrl K', label: 'Open command palette' },
  { keys: 'R', label: 'Run agent' },
  ...NAV_ITEMS.map((n) => ({ keys: `G ${n.key.toUpperCase()}`, label: `Go to ${n.label}` })),
  { keys: '?', label: 'Open command palette (help)' },
  { keys: 'Esc', label: 'Close palette / modal / drawer' },
]

class ErrorBoundary extends Component {
  constructor(props) {
    super(props)
    this.state = { hasError: false }
  }

  static getDerivedStateFromError() {
    return { hasError: true }
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="flex min-h-screen flex-col items-center justify-center gap-4 p-8 text-center bg-gray-50 dark:bg-gray-950">
          <p className="text-lg font-medium text-gray-900 dark:text-gray-100">Something went wrong. Try reloading.</p>
          <button
            type="button"
            onClick={() => window.location.reload()}
            className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-700"
          >
            Reload
          </button>
        </div>
      )
    }
    return this.props.children
  }
}

function ShortcutCheatsheet({ onClose }) {
  const cardRef = useRef(null)

  useEffect(() => {
    cardRef.current?.focus()
    const onKey = (e) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-gray-900/50 backdrop-blur-sm" onClick={onClose}>
      <div
        ref={cardRef}
        tabIndex={-1}
        role="dialog"
        aria-modal="true"
        aria-label="Keyboard shortcuts"
        onClick={(e) => e.stopPropagation()}
        className="max-w-md w-full rounded-2xl bg-white dark:bg-gray-900 p-6 shadow-lg focus:outline-none border border-gray-100 dark:border-gray-800"
      >
        <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">Keyboard shortcuts</h2>
        <ul className="space-y-2 text-sm">
          {SHORTCUTS.map((s) => (
            <li key={s.keys} className="flex items-center justify-between">
              <span className="text-gray-600 dark:text-gray-400">{s.label}</span>
              <kbd className="rounded bg-gray-100 dark:bg-gray-800 px-2 py-0.5 font-mono text-xs text-gray-700 dark:text-gray-300">{s.keys}</kbd>
            </li>
          ))}
        </ul>
        <button
          type="button"
          onClick={onClose}
          className="mt-6 w-full rounded-lg bg-brand-600 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-700 focus:outline-none focus:ring-2 focus:ring-brand-500 focus:ring-offset-2"
        >
          Close
        </button>
      </div>
    </div>,
    document.body
  )
}

function AppShell() {
  const navigate = useNavigate()
  const [showCheatsheet, setShowCheatsheet] = useState(false)
  const [paletteOpen, setPaletteOpen] = useState(false)
  const [showOnboarding, setShowOnboarding] = useState(false)
  const pendingG = useRef(false)

  useEffect(() => {
    if (!hasSeenOnboarding()) setShowOnboarding(true)
  }, [])

  const closeOnboarding = useCallback(() => {
    setShowOnboarding(false)
    markOnboardingSeen()
  }, [])

  useEffect(() => {
    const onKeyDown = (e) => {
      const tag = e.target.tagName
      if (tag === 'INPUT' || tag === 'TEXTAREA' || e.altKey) return

      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault()
        setPaletteOpen(true)
        return
      }
      if (e.metaKey || e.ctrlKey) return

      if (pendingG.current) {
        pendingG.current = false
        const route = GO_TO_ROUTES[e.key]
        if (route) navigate(route)
        return
      }
      if (e.key === 'g') {
        pendingG.current = true
        setTimeout(() => (pendingG.current = false), 1000)
        return
      }
      if (e.key === 'r') {
        document.querySelector('[data-run-agent-button]')?.click()
        return
      }
      if (e.key === '?') {
        setShowCheatsheet(true)
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [navigate])

  return (
    <div className="h-screen flex flex-col overflow-hidden bg-gray-50 dark:bg-gray-950">
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:fixed focus:top-2 focus:left-2 focus:z-50 focus:rounded-lg focus:bg-white focus:px-4 focus:py-2 focus:shadow-lg"
      >
        Skip to content
      </a>
      <div className="shrink-0">
        <Header onReplayOnboarding={() => setShowOnboarding(true)} />
        <BackendBanner />
      </div>
      <div className="flex flex-1 min-h-0">
        <Sidebar />
        <main id="main-content" className="flex-1 min-w-0 overflow-y-auto">
          <div className="mx-auto max-w-[1600px] w-full p-4 sm:p-8">
          <Routes>
            <Route path="/" element={<Dashboard />} />
            <Route path="/all-projects" element={<AllProjectsPage />} />
            <Route path="/kanban" element={<KanbanPage />} />
            <Route path="/team" element={<TeamPage />} />
            <Route path="/reports" element={<ReportsPage />} />
            <Route path="/analytics" element={<AnalyticsPage />} />
            <Route path="/slack" element={<SlackPage />} />
            <Route path="/settings" element={<SettingsPage />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
          </div>
        </main>
      </div>
      {showCheatsheet && <ShortcutCheatsheet onClose={() => setShowCheatsheet(false)} />}
      {paletteOpen && <CommandPalette onClose={() => setPaletteOpen(false)} />}
      {showOnboarding && <OnboardingModal onClose={closeOnboarding} />}
      <FloatingAiButton />
    </div>
  )
}

function AuthGate() {
  const { isAuthenticated, loading } = useAuth()

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-50 dark:bg-gray-950">
        <Spinner className="w-6 h-6 text-brand-600" />
      </div>
    )
  }

  if (!isAuthenticated) return <LoginPage />

  return (
    <ProjectProvider>
      <AgentRunProvider>
        <AppShell />
      </AgentRunProvider>
    </ProjectProvider>
  )
}

export default function App() {
  return (
    <ErrorBoundary>
      <ThemeProvider>
        <ToastProvider>
          <AuthProvider>
            <AuthGate />
          </AuthProvider>
          <ToastContainer />
        </ToastProvider>
      </ThemeProvider>
    </ErrorBoundary>
  )
}
