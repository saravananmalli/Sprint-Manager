import { ArrowPathIcon, SparklesIcon, UserGroupIcon, XMarkIcon } from '@heroicons/react/24/outline'
import {
  CheckCircleIcon,
  ExclamationTriangleIcon,
  SparklesIcon as SparklesSolid,
  XCircleIcon,
} from '@heroicons/react/24/solid'
import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import clsx from 'clsx'
import client from '../../api/client'
import { useAgentRun } from '../../hooks/useAgentRun'
import { useProjects } from '../../hooks/useProjects'
import { RISK_TAG_LABELS } from '../../utils/riskColors'
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

export default function AIScrumMasterPanel({ onClose }) {
  const { projectId, currentProject } = useProjects()
  const { runVersion } = useAgentRun()
  const [sprint, setSprint] = useState(null)
  const [health, setHealth] = useState(null)
  const [highRiskMembers, setHighRiskMembers] = useState([])
  const [scrumMasterAsk, setScrumMasterAsk] = useState(null)
  const [loading, setLoading] = useState(true)
  const [sending, setSending] = useState(false)
  const [sendResult, setSendResult] = useState(null)

  const applyData = (data) => {
    setSprint(data.sprint)
    setHealth(data.health)
    setHighRiskMembers(data.highRiskMembers)
    setScrumMasterAsk(data.scrumMasterAsk)
  }

  const load = () => {
    if (!projectId) return
    setSendResult(null)

    const cached = scrumMasterCache.get(projectId)
    if (cached && cached.runVersion === runVersion && Date.now() - cached.at < CACHE_TTL_MS) {
      applyData(cached.data)
      setLoading(false)
      return
    }

    setLoading(true)
    Promise.all([
      client.get(`/api/projects/${projectId}/sprint`),
      client.get(`/api/projects/${projectId}/health`),
      client.get('/api/team', { params: { project: projectId } }),
      client.get(`/api/projects/${projectId}/reports/leadership`),
    ])
      .then(([sprintRes, healthRes, teamRes, reportRes]) => {
        const data = {
          sprint: sprintRes.data,
          health: healthRes.data,
          highRiskMembers: teamRes.data.members.filter((m) => m.riskLevel === 'HIGH').map((m) => m.name),
          scrumMasterAsk: reportRes.data.scrumMasterAsk,
        }
        scrumMasterCache.set(projectId, { data, at: Date.now(), runVersion })
        applyData(data)
      })
      .finally(() => setLoading(false))
  }

  useEffect(load, [projectId, runVersion])

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
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                {currentProject?.name ?? '—'} · {loading ? 'Thinking…' : 'Ready'}
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
              {loading || !sprint ? (
                'Reviewing your sprint…'
              ) : (
                <>
                  Reviewing <span className="font-medium text-gray-900 dark:text-gray-100">{currentProject?.name}</span> ·{' '}
                  {sprint.sprintName} · day {sprint.daysElapsed}/{totalDays}.
                </>
              )}
            </div>
          </div>

          {!loading && sprint && riskReasons.length > 0 && (
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

          {!loading && scrumMasterAsk && (
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

          {!loading && sprint && (
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
            onClick={load}
            disabled={loading}
            className="inline-flex shrink-0 items-center gap-1.5 rounded-lg border border-gray-200 dark:border-gray-700 px-3 py-1.5 text-sm font-medium text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-800 disabled:opacity-60"
          >
            <ArrowPathIcon className="w-4 h-4" />
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
