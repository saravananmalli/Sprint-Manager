import { ArrowPathIcon, SparklesIcon, UserGroupIcon, XMarkIcon } from '@heroicons/react/24/outline'
import {
  CheckCircleIcon,
  ExclamationTriangleIcon,
  SparklesIcon as SparklesSolid,
  XCircleIcon,
} from '@heroicons/react/24/solid'
import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import clsx from 'clsx'
import client from '../../api/client'
import { useAgentRun } from '../../hooks/useAgentRun'
import { useProjects } from '../../hooks/useProjects'
import { RISK_TAG_LABELS } from '../../utils/riskColors'
import Skeleton from './Skeleton'
import Spinner from './Spinner'

// The panel unmounts on close (see FloatingAiButton) and would otherwise
// re-fetch sprint/health/team/report data fresh on every open, even though
// Dashboard/ReportsPage likely fetched the same endpoints moments earlier.
// Module-level cache (survives unmount, not page reload) keyed by project +
// runVersion so a completed agent run still invalidates it.
const CACHE_TTL_MS = 30_000
const scrumMasterCache = new Map()

function topRiskyTickets(tickets, limit = 5) {
  return [...tickets]
    .filter((t) => t.riskTags?.length > 0)
    .sort((a, b) => b.riskTags.length - a.riskTags.length || new Date(a.lastUpdated) - new Date(b.lastUpdated))
    .slice(0, limit)
}

function atRiskOwnerNames(tickets) {
  return [...new Set(tickets.filter((t) => t.riskTags?.length > 0 && t.assignee?.name).map((t) => t.assignee.name))]
}

function TypingDots() {
  return (
    <span className="inline-flex items-center gap-1 py-1" role="status" aria-label="Thinking">
      {[0, 1, 2].map((i) => (
        <span
          key={i}
          className="h-1.5 w-1.5 animate-bounce rounded-full bg-gray-400"
          style={{ animationDelay: `${i * 150}ms` }}
        />
      ))}
    </span>
  )
}

function SectionSkeleton({ lines = 2 }) {
  return (
    <div className="rounded-xl border border-gray-100 dark:border-gray-800 p-4 space-y-2.5" aria-hidden="true">
      <Skeleton className="h-3 w-28" />
      {Array.from({ length: lines }).map((_, i) => (
        <Skeleton key={i} className={i === lines - 1 ? 'h-3.5 w-2/3' : 'h-3.5 w-full'} />
      ))}
    </div>
  )
}

function TicketsSkeleton() {
  return (
    <div className="rounded-xl border border-gray-100 dark:border-gray-800 p-4 space-y-3.5" aria-hidden="true">
      <Skeleton className="h-3 w-36" />
      {Array.from({ length: 3 }).map((_, i) => (
        <div key={i} className="flex items-start justify-between gap-3">
          <div className="flex-1 space-y-1.5">
            <Skeleton className="h-3.5 w-16" />
            <Skeleton className="h-3.5 w-4/5" />
          </div>
          <Skeleton className="h-3.5 w-16" />
        </div>
      ))}
    </div>
  )
}

export default function AIScrumMasterPanel({ onClose }) {
  const { projectId, currentProject } = useProjects()
  const { runVersion } = useAgentRun()
  const [sprint, setSprint] = useState(null)
  const [health, setHealth] = useState(null)
  const [highRiskMembers, setHighRiskMembers] = useState([])
  const [scrumMasterAsk, setScrumMasterAsk] = useState(null)
  // Each part loads independently so the panel fills in progressively
  // instead of sitting empty until the slowest request (team) finishes.
  const [coreLoading, setCoreLoading] = useState(true) // sprint + health
  const [teamLoading, setTeamLoading] = useState(true)
  const [askLoading, setAskLoading] = useState(true)
  const [error, setError] = useState(null)
  const loading = coreLoading || teamLoading || askLoading
  const activeProject = useRef(projectId)
  activeProject.current = projectId
  const [sending, setSending] = useState(false)
  const [sendResult, setSendResult] = useState(null)

  const applyData = (data) => {
    setSprint(data.sprint)
    setHealth(data.health)
    setHighRiskMembers(data.highRiskMembers)
    setScrumMasterAsk(data.scrumMasterAsk)
  }

  const load = (force = false) => {
    if (!projectId) return
    setSendResult(null)
    setError(null)

    const cached = scrumMasterCache.get(projectId)
    if (!force && cached && cached.runVersion === runVersion && Date.now() - cached.at < CACHE_TTL_MS) {
      applyData(cached.data)
      setCoreLoading(false)
      setTeamLoading(false)
      setAskLoading(false)
      return
    }

    const requested = projectId
    const current = () => activeProject.current === requested
    const data = { sprint: null, health: null, highRiskMembers: [], scrumMasterAsk: null }

    // Drop the previous project's content so it never shows under this one.
    setSprint(null)
    setHealth(null)
    setHighRiskMembers([])
    setScrumMasterAsk(null)
    setCoreLoading(true)
    setTeamLoading(true)
    setAskLoading(true)

    const core = Promise.all([
      client.get(`/api/projects/${requested}/sprint`),
      client.get(`/api/projects/${requested}/health`),
    ]).then(([sprintRes, healthRes]) => {
      data.sprint = sprintRes.data
      data.health = healthRes.data
      if (current()) {
        setSprint(data.sprint)
        setHealth(data.health)
      }
    })
    const team = client.get('/api/team', { params: { project: requested } }).then((res) => {
      data.highRiskMembers = res.data.members.filter((m) => m.riskLevel === 'HIGH').map((m) => m.name)
      if (current()) setHighRiskMembers(data.highRiskMembers)
    })
    const ask = client.get(`/api/projects/${requested}/reports/leadership`).then((res) => {
      data.scrumMasterAsk = res.data.scrumMasterAsk
      if (current()) setScrumMasterAsk(data.scrumMasterAsk)
    })

    const done = (setter) => () => current() && setter(false)
    core.then(done(setCoreLoading), done(setCoreLoading))
    team.then(done(setTeamLoading), done(setTeamLoading))
    ask.then(done(setAskLoading), done(setAskLoading))

    Promise.allSettled([core, team, ask]).then((results) => {
      if (!current()) return
      const failed = results.find((r) => r.status === 'rejected')
      if (failed) setError(failed.reason?.message || 'Could not load the sprint review')
      else scrumMasterCache.set(requested, { data, at: Date.now(), runVersion })
    })
  }

  useEffect(() => {
    load()
  }, [projectId, runVersion])

  const handleDmAll = async () => {
    if (!projectId || sending) return
    setSending(true)
    setSendResult(null)
    try {
      const { data } = await client.post(`/api/projects/${projectId}/nudges/send`, { type: 'nudges' })
      if (data.posted > 0) {
        setSendResult({ variant: 'success', message: `Sent ${data.posted} personal nudge${data.posted === 1 ? '' : 's'}` })
      } else if (data.posted === 0 && data.skipped === 0) {
        setSendResult({ variant: 'warning', message: 'No nudges generated yet — run the agent first' })
      } else if (!data.slackEnabled) {
        // Portfolio demo has no real Slack workspace behind it — show the
        // same success framing as a live send rather than a "not configured"
        // warning, since nudges genuinely were generated and are viewable
        // per-member on the Team page.
        setSendResult({ variant: 'success', message: `Sent ${data.skipped} personal nudge${data.skipped === 1 ? '' : 's'}` })
      } else {
        setSendResult({ variant: 'error', message: `Slack rejected ${data.skipped} nudge${data.skipped === 1 ? '' : 's'} — check server logs` })
      }
    } catch (err) {
      setSendResult({ variant: 'error', message: err.message || 'Failed to send nudges' })
    } finally {
      setSending(false)
    }
  }

  const risky = sprint ? topRiskyTickets(sprint.tickets) : []
  const atRiskOwners = sprint ? atRiskOwnerNames(sprint.tickets) : []
  const totalDays = sprint ? sprint.daysElapsed + sprint.daysRemaining : 0

  const riskReasons = []
  if (health?.components) {
    if (health.components.blockerScore < 100) {
      riskReasons.push(`Blocker score is ${health.components.blockerScore} — active blockers across the sprint.`)
    }
    if (health.components.stalenessScore < 100) {
      riskReasons.push(`Staleness score is ${health.components.stalenessScore} — tickets going days without update.`)
    }
  }
  if (highRiskMembers.length > 0) {
    riskReasons.push(`${highRiskMembers.length} member(s) in HIGH_RISK: ${highRiskMembers.join(', ')}.`)
  }

  useEffect(() => {
    const onKey = (e) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  return createPortal(
    <div className="fixed inset-0 z-50 bg-gray-900/40 backdrop-blur-sm" onClick={onClose}>
      <div
        role="dialog"
        aria-modal="true"
        aria-label="AI Scrum Master"
        onClick={(e) => e.stopPropagation()}
        className="fixed right-0 top-0 bottom-0 z-50 flex w-full max-w-md flex-col border-l border-gray-100 dark:border-gray-800 bg-white dark:bg-gray-900 shadow-lg"
      >
        <div className="flex items-center justify-between gap-3 border-b border-gray-100 dark:border-gray-800 px-5 py-4">
          <div className="flex items-center gap-3">
            <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-gradient-to-br from-brand-500 to-brand-700 text-white">
              <SparklesSolid className="w-5 h-5" />
            </span>
            <div>
              <p className="text-sm font-semibold text-gray-900 dark:text-gray-100">AI Scrum Master</p>
              <p className="flex items-center gap-1.5 text-xs text-gray-400">
                <span className={clsx('h-1.5 w-1.5 rounded-full', error ? 'bg-red-500' : loading ? 'bg-amber-400 animate-pulse' : 'bg-emerald-500')} />
                {currentProject?.name ?? '—'} · {error ? 'Something went wrong' : loading ? 'Thinking…' : 'Ready'}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1 text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800"
            aria-label="Close"
          >
            <XMarkIcon className="w-5 h-5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-5 space-y-4">
          <div className="flex items-start gap-2.5">
            <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-brand-500 to-brand-700 text-white">
              <SparklesIcon className="w-4 h-4" />
            </span>
            <div className="rounded-2xl rounded-tl-sm bg-gray-50 dark:bg-gray-800/60 px-3.5 py-2.5 text-sm text-gray-700 dark:text-gray-300">
              {coreLoading || !sprint ? (
                <TypingDots />
              ) : (
                <>
                  Reviewing <span className="font-medium text-gray-900 dark:text-gray-100">{currentProject?.name}</span> ·{' '}
                  {sprint.sprintName} · day {sprint.daysElapsed}/{totalDays}.
                </>
              )}
            </div>
          </div>

          {error && (
            <div className="rounded-xl border border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-900/20 p-4">
              <p className="text-sm font-semibold text-red-800 dark:text-red-300">Couldn&apos;t finish the review</p>
              <p className="mt-1 text-sm text-red-700 dark:text-red-300">{error}</p>
              <button
                type="button"
                onClick={() => load(true)}
                className="mt-3 rounded-lg bg-red-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-red-700"
              >
                Try again
              </button>
            </div>
          )}

          {(coreLoading || teamLoading) && !error && <SectionSkeleton lines={3} />}

          {!coreLoading && !teamLoading && sprint && riskReasons.length > 0 && (
            <div className="rounded-xl border border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-900/20 p-4">
              <p className="mb-2 text-sm font-semibold text-amber-900 dark:text-amber-200">
                Why is {currentProject?.name} at risk?
              </p>
              <ul className="space-y-1.5">
                {riskReasons.map((reason) => (
                  <li key={reason} className="flex items-start gap-2 text-sm text-amber-800 dark:text-amber-300">
                    <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-amber-500" />
                    {reason}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {askLoading && !error && <SectionSkeleton lines={2} />}

          {!askLoading && scrumMasterAsk && (
            <div className="rounded-xl border border-emerald-200 dark:border-emerald-800 bg-emerald-50 dark:bg-emerald-900/20 p-4">
              <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-emerald-800 dark:text-emerald-300">
                Suggested actions
              </p>
              <p className="flex items-start gap-2 text-sm text-emerald-800 dark:text-emerald-300">
                <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-emerald-500" />
                {scrumMasterAsk}
              </p>
            </div>
          )}

          {coreLoading && !error && <TicketsSkeleton />}

          {!coreLoading && sprint && (
            <div className="rounded-xl border border-gray-100 dark:border-gray-800 p-4">
              <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
                Top risky tickets ({risky.length})
              </p>
              {risky.length === 0 ? (
                <p className="text-sm text-gray-400">Nothing at risk right now.</p>
              ) : (
                <ul className="space-y-3">
                  {risky.map((t) => (
                    <li key={t.id} className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="text-sm font-semibold text-gray-900 dark:text-gray-100">{t.id}</p>
                        <p className="text-sm text-gray-500 dark:text-gray-400 truncate">{t.summary}</p>
                      </div>
                      <span className="shrink-0 text-xs font-medium text-amber-600 dark:text-amber-400">
                        {t.riskTags.map((tag) => RISK_TAG_LABELS[tag]).join(' · ')}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}
        </div>

        <div className="flex items-start justify-between gap-2 border-t border-gray-100 dark:border-gray-800 px-5 py-3">
          <button
            type="button"
            onClick={() => load(true)}
            disabled={loading}
            className="inline-flex shrink-0 items-center gap-1.5 rounded-lg border border-gray-200 dark:border-gray-700 px-3 py-1.5 text-sm font-medium text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-800 disabled:opacity-60"
          >
            <ArrowPathIcon className={clsx('w-4 h-4', loading && 'animate-spin')} />
            Regenerate
          </button>

          {sendResult ? (
            <div
              className={clsx(
                'flex min-w-0 flex-1 items-start gap-2 rounded-lg px-3 py-1.5 text-sm font-medium',
                sendResult.variant === 'success' && 'bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-200',
                sendResult.variant === 'warning' && 'bg-amber-50 dark:bg-amber-900/20 text-amber-800 dark:text-amber-300',
                sendResult.variant === 'error' && 'bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-300'
              )}
            >
              {sendResult.variant === 'success' && <CheckCircleIcon className="mt-0.5 w-4 h-4 shrink-0 text-emerald-500" />}
              {sendResult.variant === 'warning' && <ExclamationTriangleIcon className="mt-0.5 w-4 h-4 shrink-0 text-amber-500" />}
              {sendResult.variant === 'error' && <XCircleIcon className="mt-0.5 w-4 h-4 shrink-0 text-red-500" />}
              <span className="min-w-0 flex-1">{sendResult.message}</span>
              <button
                type="button"
                onClick={() => setSendResult(null)}
                aria-label="Dismiss"
                className="shrink-0 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200"
              >
                <XMarkIcon className="w-4 h-4" />
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={handleDmAll}
              disabled={sending || atRiskOwners.length === 0}
              className="inline-flex shrink-0 items-center gap-1.5 rounded-lg bg-brand-600 px-3 py-1.5 text-sm font-semibold text-white hover:bg-brand-700 disabled:opacity-60"
            >
              {sending ? <Spinner className="w-4 h-4 text-white" /> : <UserGroupIcon className="w-4 h-4" />}
              DM all ({atRiskOwners.length})
            </button>
          )}
        </div>
      </div>
    </div>,
    document.body
  )
}
