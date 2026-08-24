import {
  ArrowRightOnRectangleIcon,
  ArrowUpTrayIcon,
  BellIcon,
  ChevronUpDownIcon,
  MoonIcon,
  PlusIcon,
  QuestionMarkCircleIcon,
  SunIcon,
} from '@heroicons/react/24/outline'
import { PlayIcon as PlaySolidIcon } from '@heroicons/react/24/solid'
import clsx from 'clsx'
import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { useAgentRun } from '../../hooks/useAgentRun'
import { useAuth } from '../../hooks/useAuth'
import { useProjects } from '../../hooks/useProjects'
import { useTheme } from '../../hooks/useTheme'
import { useToast } from '../../hooks/useToast'
import NewProjectModal from '../projects/NewProjectModal'
import { projectDot } from '../../utils/projectColor'
import { SPRINT_STATUS_CLASSES } from '../../utils/riskColors'
import Spinner from '../common/Spinner'
import CommandPalette from './CommandPalette'

function PulseIcon({ className }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <path d="M22 12h-4l-3 9L9 3l-3 9H2" />
    </svg>
  )
}

function Logo() {
  return (
    <div className="hidden sm:flex w-60 shrink-0 items-center gap-2.5 border-r border-gray-100 dark:border-gray-800 px-4 py-3">
      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-brand-500 to-brand-700 text-white shadow-sm">
        <PulseIcon className="w-5 h-5" />
      </span>
      <span className="min-w-0 leading-tight">
        <span className="block text-sm font-semibold text-gray-900 dark:text-gray-100 truncate">Sprint Agent</span>
        <span className="block text-xs text-gray-400 dark:text-gray-500 truncate">Agile copilot</span>
      </span>
    </div>
  )
}

function ProjectSwitcher() {
  const { projects, currentProject, setProjectId, loading, refetch } = useProjects()
  const { showToast } = useToast()
  const [open, setOpen] = useState(false)
  const [modalMode, setModalMode] = useState(null)
  const ref = useRef(null)

  useEffect(() => {
    const onClick = (e) => {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false)
    }
    document.addEventListener('mousedown', onClick)
    return () => document.removeEventListener('mousedown', onClick)
  }, [])

  if (loading || !currentProject) {
    return <span className="text-sm text-gray-400">Loading projects…</span>
  }

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex items-center gap-2 rounded-lg px-2 py-1.5 text-sm font-medium text-gray-900 dark:text-gray-100 hover:bg-gray-50 dark:hover:bg-gray-800 focus:outline-none focus:ring-2 focus:ring-brand-500"
      >
        <span className={clsx('h-2 w-2 rounded-full', projectDot(currentProject.id))} />
        {currentProject.name}
        <span className="text-gray-400 dark:text-gray-500 font-normal">/ #{currentProject.teamSlug}</span>
        <ChevronUpDownIcon className="w-4 h-4 text-gray-400" />
      </button>
      {open && (
        <div className="absolute left-0 mt-1 w-96 rounded-xl border border-gray-100 dark:border-gray-800 bg-white dark:bg-gray-900 shadow-lg z-30 overflow-hidden">
          <div className="px-3 pt-2.5 pb-1.5 text-[10px] font-semibold uppercase tracking-wide text-gray-400">
            Projects · {projects.length}
          </div>
          <ul className="max-h-96 overflow-y-auto py-1">
            {projects.map((p) => (
              <li key={p.id}>
                <button
                  type="button"
                  onClick={() => {
                    setProjectId(p.id)
                    setOpen(false)
                  }}
                  className={clsx(
                    'flex w-full items-start justify-between gap-3 px-3 py-2 text-left hover:bg-gray-50 dark:hover:bg-gray-800',
                    p.id === currentProject.id && 'bg-brand-50 dark:bg-brand-500/10'
                  )}
                >
                  <span className="flex items-start gap-2 min-w-0">
                    <span className={clsx('mt-1.5 h-2 w-2 shrink-0 rounded-full', projectDot(p.id))} />
                    <span className="min-w-0">
                      <span className="flex items-center gap-1.5">
                        <span className={clsx('text-sm font-medium truncate', p.id === currentProject.id ? 'text-brand-700 dark:text-brand-400' : 'text-gray-900 dark:text-gray-100')}>
                          {p.name}
                        </span>
                        {p.custom && (
                          <span className="shrink-0 rounded bg-gray-100 dark:bg-gray-800 px-1.5 py-0.5 text-[10px] font-medium text-gray-500 dark:text-gray-400">
                            NEW
                          </span>
                        )}
                      </span>
                      <span className="block text-xs text-gray-400 truncate">{p.sprintName}</span>
                      <span className="block text-xs text-gray-400">
                        Health {p.health ?? '—'}/100 · {p.velocity}% vel
                      </span>
                    </span>
                  </span>
                  <span className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-medium ${SPRINT_STATUS_CLASSES[p.sprintStatus] ?? ''}`}>
                    {p.sprintStatus}
                  </span>
                </button>
              </li>
            ))}
          </ul>
          <div className="flex items-center justify-between gap-2 border-t border-gray-100 dark:border-gray-800 px-3 py-2">
            <span className="flex items-center gap-1 text-xs text-gray-400">
              <kbd className="rounded bg-gray-100 dark:bg-gray-800 px-1.5 py-0.5 text-[10px]">Ctrl</kbd>
              <kbd className="rounded bg-gray-100 dark:bg-gray-800 px-1.5 py-0.5 text-[10px]">K</kbd>
              Quick search
            </span>
            <span className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => {
                  setOpen(false)
                  setModalMode('import')
                }}
                className="inline-flex items-center gap-1 text-xs font-medium text-gray-600 dark:text-gray-300 hover:text-brand-600 dark:hover:text-brand-400"
              >
                <ArrowUpTrayIcon className="w-3.5 h-3.5" />
                Import
              </button>
              <button
                type="button"
                onClick={() => {
                  setOpen(false)
                  setModalMode('manual')
                }}
                className="inline-flex items-center gap-1 text-xs font-medium text-brand-600 dark:text-brand-400 hover:underline"
              >
                <PlusIcon className="w-3.5 h-3.5" />
                New project
              </button>
            </span>
          </div>
        </div>
      )}

      {modalMode && (
        <NewProjectModal
          initialMode={modalMode}
          onClose={() => setModalMode(null)}
          onCreated={async (project) => {
            setModalMode(null)
            await refetch()
            setProjectId(project.id)
            showToast(`${project.name} created`, 'success')
          }}
        />
      )}
    </div>
  )
}

function UserMenu() {
  const { user, logout } = useAuth()
  const [open, setOpen] = useState(false)
  const ref = useRef(null)

  useEffect(() => {
    const onClick = (e) => {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false)
    }
    document.addEventListener('mousedown', onClick)
    return () => document.removeEventListener('mousedown', onClick)
  }, [])

  if (!user) return null

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        aria-label="Account menu"
        onClick={() => setOpen((o) => !o)}
        className="flex h-8 w-8 items-center justify-center rounded-full bg-emerald-500 text-xs font-semibold text-white focus:outline-none focus:ring-2 focus:ring-brand-500"
      >
        {user.avatarInitial}
      </button>
      {open && (
        <div className="absolute right-0 mt-1 w-64 rounded-xl border border-gray-100 dark:border-gray-800 bg-white dark:bg-gray-900 shadow-lg z-30 overflow-hidden">
          <div className="px-4 py-3 border-b border-gray-100 dark:border-gray-800">
            <p className="text-sm font-semibold text-gray-900 dark:text-gray-100">{user.displayName}</p>
            <p className="text-xs text-gray-400">{user.role} · Demo account</p>
          </div>
          <button
            type="button"
            onClick={() => {
              setOpen(false)
              logout()
            }}
            className="flex w-full items-center gap-2 px-4 py-2.5 text-sm text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20"
          >
            <ArrowRightOnRectangleIcon className="w-4 h-4" />
            Log out
          </button>
        </div>
      )}
    </div>
  )
}

export default function Header({ onReplayOnboarding }) {
  const { running, runAgent, lastRunSummary, markNotificationSeen } = useAgentRun()
  const { currentProject } = useProjects()
  const { theme, toggleTheme } = useTheme()
  const [paletteOpen, setPaletteOpen] = useState(false)
  const [notifOpen, setNotifOpen] = useState(false)

  return (
    <header className="flex items-stretch border-b border-gray-100 dark:border-gray-800 bg-white dark:bg-gray-900">
      <Logo />

      <div className="flex flex-1 items-center justify-between gap-4 min-w-0 px-4 sm:px-6 py-3">
        <div className="flex items-center gap-6 min-w-0">
          <ProjectSwitcher />
          {currentProject && (
            <div className="hidden md:flex items-center gap-1.5 text-sm text-gray-500 dark:text-gray-400">
              <span className="h-2 w-2 rounded-full bg-emerald-500" />
              <span className="text-gray-900 dark:text-gray-100 font-medium">{currentProject.sprintName}</span>
              <span>· Synced now</span>
            </div>
          )}
        </div>

        <button
          type="button"
          onClick={() => setPaletteOpen(true)}
          className="hidden lg:flex items-center gap-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 px-3 py-1.5 text-sm text-gray-400 w-72 focus:outline-none focus:ring-2 focus:ring-brand-500"
        >
          <span className="flex-1 text-left">Search or jump to…</span>
          <kbd className="rounded bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 px-1.5 py-0.5 text-xs">Ctrl</kbd>
          <kbd className="rounded bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 px-1.5 py-0.5 text-xs">K</kbd>
        </button>

        <div className="flex items-center gap-3">
          <button
            type="button"
            data-run-agent-button
            onClick={runAgent}
            disabled={running}
            className="inline-flex items-center gap-1.5 rounded-lg bg-brand-600 px-3 py-1.5 text-sm font-semibold text-white transition-all duration-150 hover:bg-brand-700 disabled:opacity-60 focus:outline-none focus:ring-2 focus:ring-brand-500 focus:ring-offset-2 dark:focus:ring-offset-gray-900"
          >
            {running ? <Spinner className="w-4 h-4 text-white" /> : <PlaySolidIcon className="w-4 h-4" />}
            {running ? 'Running…' : 'Run'}
          </button>

          <div className="relative">
            <button
              type="button"
              aria-label="Notifications"
              onClick={() => {
                setNotifOpen((o) => !o)
                markNotificationSeen()
              }}
              className="relative rounded-lg p-1.5 text-gray-500 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800 focus:outline-none focus:ring-2 focus:ring-brand-500"
            >
              <BellIcon className="w-5 h-5" />
              {lastRunSummary && !lastRunSummary.seen && (
                <span className="absolute right-1 top-1 h-2 w-2 rounded-full bg-red-500 ring-2 ring-white dark:ring-gray-900" />
              )}
            </button>
            {notifOpen && (
              <div className="absolute right-0 mt-1 w-72 rounded-xl border border-gray-100 dark:border-gray-800 bg-white dark:bg-gray-900 shadow-lg p-3 text-sm z-30">
                {lastRunSummary && (
                  <Link
                    to="/team"
                    onClick={() => setNotifOpen(false)}
                    className="mb-2 block rounded-lg border border-gray-100 dark:border-gray-800 p-2.5 hover:bg-gray-50 dark:hover:bg-gray-800"
                  >
                    <p className="font-medium text-gray-900 dark:text-gray-100">
                      {lastRunSummary.status === 'partial' ? 'Agent run partially completed' : 'Agent run complete'}
                    </p>
                    <p className="mt-0.5 text-gray-500 dark:text-gray-400">
                      {lastRunSummary.nudgeCount
                        ? `${lastRunSummary.nudgeCount} nudge${lastRunSummary.nudgeCount === 1 ? '' : 's'} generated — check Nudges on the Team page.`
                        : 'No at-risk owners this run.'}
                    </p>
                  </Link>
                )}
                <p className="text-gray-500 dark:text-gray-400">
                  Check the Slack page for escalations and the Team page for at-risk members.
                </p>
              </div>
            )}
          </div>

          <button
            type="button"
            aria-label="Replay welcome tour"
            onClick={onReplayOnboarding}
            className="rounded-lg p-1.5 text-gray-500 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800 focus:outline-none focus:ring-2 focus:ring-brand-500"
          >
            <QuestionMarkCircleIcon className="w-5 h-5" />
          </button>

          <button
            type="button"
            aria-label={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
            onClick={toggleTheme}
            className="rounded-lg p-1.5 text-gray-500 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800 focus:outline-none focus:ring-2 focus:ring-brand-500"
          >
            {theme === 'dark' ? <SunIcon className="w-5 h-5" /> : <MoonIcon className="w-5 h-5" />}
          </button>

          <UserMenu />
        </div>
      </div>

      {paletteOpen && <CommandPalette onClose={() => setPaletteOpen(false)} />}
    </header>
  )
}
