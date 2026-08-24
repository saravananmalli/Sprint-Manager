import { EyeIcon, EyeSlashIcon, LockClosedIcon, MoonIcon, SunIcon, UserIcon } from '@heroicons/react/24/outline'
import { useState } from 'react'
import Spinner from '../components/common/Spinner'
import { useAuth } from '../hooks/useAuth'
import { useTheme } from '../hooks/useTheme'

function PulseIcon({ className }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <path d="M22 12h-4l-3 9L9 3l-3 9H2" />
    </svg>
  )
}

// Keep in sync with backend/auth.py DEMO_ACCOUNTS — meant to be publicly
// visible for a showcase, not a real secret. Single account, full app access.
const DEMO_ACCOUNT = { username: 'scrummaster', password: 'sprint2026' }

export default function LoginPage() {
  const { login } = useAuth()
  const { theme, toggleTheme } = useTheme()
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState(null)

  const attempt = async (u, p) => {
    setSubmitting(true)
    setError(null)
    const result = await login(u, p)
    setSubmitting(false)
    if (!result.ok) {
      setError(
        result.status
          ? 'Invalid username or password.'
          : "Can't reach the server — check that the backend is running."
      )
    }
  }

  const handleSubmit = (e) => {
    e.preventDefault()
    attempt(username, password)
  }

  const fillDemoCredentials = () => {
    setUsername(DEMO_ACCOUNT.username)
    setPassword(DEMO_ACCOUNT.password)
  }

  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-gray-50 dark:bg-gray-950 p-4 sm:p-8">
      <div
        className="pointer-events-none absolute -left-24 -top-24 h-96 w-96 rounded-full bg-brand-500/30 blur-3xl animate-pulse"
        style={{ animationDuration: '6s' }}
      />
      <div
        className="pointer-events-none absolute -right-24 top-1/3 h-96 w-96 rounded-full bg-purple-500/20 blur-3xl animate-pulse"
        style={{ animationDuration: '8s', animationDelay: '1s' }}
      />
      <div
        className="pointer-events-none absolute bottom-0 left-1/3 h-80 w-80 rounded-full bg-emerald-500/20 blur-3xl animate-pulse"
        style={{ animationDuration: '7s', animationDelay: '2s' }}
      />

      <button
        type="button"
        onClick={toggleTheme}
        aria-label={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
        className="absolute right-4 top-4 sm:right-8 sm:top-8 z-10 rounded-lg p-2 text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 focus:outline-none focus:ring-2 focus:ring-brand-500"
      >
        {theme === 'dark' ? <SunIcon className="w-5 h-5" /> : <MoonIcon className="w-5 h-5" />}
      </button>

      <div className="relative z-10 grid w-full max-w-4xl grid-cols-1 overflow-hidden rounded-2xl border border-gray-100 dark:border-gray-800 bg-white/80 dark:bg-gray-900/80 shadow-2xl backdrop-blur-xl lg:grid-cols-2">
        <div className="hidden flex-col justify-between bg-gradient-to-br from-brand-600 via-brand-700 to-purple-700 p-8 text-white lg:flex">
          <div>
            <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-white/15 shadow-sm">
              <PulseIcon className="w-5 h-5" />
            </span>
            <h1 className="mt-6 text-2xl font-bold leading-tight">Your agile copilot, always in sync.</h1>
            <p className="mt-3 text-sm text-white/70">
              Live sprint health, risk detection, and AI-drafted nudges — across every project your team runs.
            </p>
          </div>
          <div className="grid grid-cols-3 gap-3">
            {[
              { label: 'Health', value: '84' },
              { label: 'Velocity', value: '92%' },
              { label: 'Projects', value: '12' },
            ].map((stat) => (
              <div key={stat.label} className="rounded-xl bg-white/10 px-3 py-2.5">
                <p className="text-lg font-bold">{stat.value}</p>
                <p className="text-[11px] uppercase tracking-wide text-white/60">{stat.label}</p>
              </div>
            ))}
          </div>
          <p className="text-xs text-white/50">Portfolio demo — no real data.</p>
        </div>

        <div className="p-8 sm:p-10">
          <div className="mb-6 lg:hidden">
            <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-gradient-to-br from-brand-500 to-brand-700 text-white shadow-sm">
              <PulseIcon className="w-5 h-5" />
            </span>
          </div>
          <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100">Sign in</h2>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">Welcome back to Sprint Agent.</p>

          <form onSubmit={handleSubmit} className="mt-6 space-y-4">
            <label className="block">
              <span className="mb-1 block text-xs font-medium text-gray-500 dark:text-gray-400">Username</span>
              <div className="relative">
                <UserIcon className="pointer-events-none absolute left-3 top-1/2 w-4 h-4 -translate-y-1/2 text-gray-400" />
                <input
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="scrummaster"
                  autoComplete="username"
                  className="w-full rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 py-2 pl-9 pr-3 text-sm text-gray-900 dark:text-gray-100 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-brand-500"
                />
              </div>
            </label>
            <label className="block">
              <span className="mb-1 block text-xs font-medium text-gray-500 dark:text-gray-400">Password</span>
              <div className="relative">
                <LockClosedIcon className="pointer-events-none absolute left-3 top-1/2 w-4 h-4 -translate-y-1/2 text-gray-400" />
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  autoComplete="current-password"
                  className="w-full rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 py-2 pl-9 pr-9 text-sm text-gray-900 dark:text-gray-100 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-brand-500"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((s) => !s)}
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
                >
                  {showPassword ? <EyeSlashIcon className="w-4 h-4" /> : <EyeIcon className="w-4 h-4" />}
                </button>
              </div>
            </label>

            {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}

            <button
              type="submit"
              disabled={submitting}
              className="flex w-full items-center justify-center gap-2 rounded-lg bg-brand-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-brand-700 disabled:opacity-60 focus:outline-none focus:ring-2 focus:ring-brand-500 focus:ring-offset-2 dark:focus:ring-offset-gray-900"
            >
              {submitting && <Spinner className="w-4 h-4 text-white" />}
              {submitting ? 'Signing in…' : 'Sign in'}
            </button>
          </form>

          <div className="mt-6 flex items-center justify-between gap-3 rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/60 px-3.5 py-2.5">
            <p className="text-xs text-gray-500 dark:text-gray-400">
              Demo login:{' '}
              <span className="font-mono text-gray-700 dark:text-gray-300">
                {DEMO_ACCOUNT.username} / {DEMO_ACCOUNT.password}
              </span>
            </p>
            <button
              type="button"
              onClick={fillDemoCredentials}
              className="shrink-0 whitespace-nowrap text-xs font-medium text-brand-600 dark:text-brand-400 hover:underline"
            >
              Autofill
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
