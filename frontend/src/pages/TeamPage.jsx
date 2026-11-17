import {
  CpuChipIcon,
  LockClosedIcon,
  MagnifyingGlassIcon,
  PaperAirplaneIcon,
  SparklesIcon,
  UsersIcon,
} from '@heroicons/react/24/outline'
import clsx from 'clsx'
import { useEffect, useMemo, useState } from 'react'
import client from '../api/client'
import Card from '../components/common/Card'
import { TeamSkeleton } from '../components/common/PageSkeletons'
import { useAgentRun } from '../hooks/useAgentRun'
import { useToast } from '../hooks/useToast'
import { avatarGradient } from '../utils/avatarColor'
import { formatShortDate, initials } from '../utils/formatters'
import { PRIORITY_CLASSES, RISK_LEVEL_CLASSES, RISK_LEVEL_DOT, STATUS_CLASSES } from '../utils/riskColors'

const ACTIVITY_DOT = {
  Done: 'bg-emerald-500',
  Testing: 'bg-amber-500',
  'In Review': 'bg-purple-500',
  'In Progress': 'bg-brand-500',
  Backlog: 'bg-gray-400',
}

function describeActivity(entry) {
  if (entry.event === 'manual.move') return `Moved ${entry.ticketId} to ${entry.to}`
  return `${entry.ticketId} moved to ${entry.to} · ${entry.event}`
}

const FILTERS = ['All', 'Active', 'Idle', 'At risk', 'Blocked']

function matchesFilter(member, filter) {
  switch (filter) {
    case 'Active':
      return member.todayTasks.length > 0
    case 'Idle':
      return member.todayTasks.length === 0
    case 'At risk':
      return member.riskLevel !== 'LOW'
    case 'Blocked':
      return member.reasons.some((r) => r.includes('blocked'))
    default:
      return true
  }
}

export default function TeamPage() {
  const { runVersion } = useAgentRun()
  const { showToast } = useToast()
  const [members, setMembers] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [filter, setFilter] = useState('All')
  const [selectedEmail, setSelectedEmail] = useState(null)

  useEffect(() => {
    // Deliberately unscoped — this page reports each member's workload and
    // risk across every project they're on, not just the currently
    // selected one (that's what the Dashboard's Team workload card is for).
    client
      .get('/api/team')
      .then(({ data }) => {
        setMembers(data.members)
        setSelectedEmail((current) => current ?? data.members[0]?.email)
      })
      .finally(() => setLoading(false))
  }, [runVersion])

  const filtered = useMemo(() => {
    const needle = search.trim().toLowerCase()
    return members.filter(
      (m) => matchesFilter(m, filter) && (!needle || m.name.toLowerCase().includes(needle) || m.projects.some((p) => p.toLowerCase().includes(needle)))
    )
  }, [members, search, filter])

  const selected = members.find((m) => m.email === selectedEmail) || filtered[0]

  if (loading) {
    return <TeamSkeleton />
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-gray-900 dark:text-gray-100">Team Members</h1>
        <p className="text-sm text-gray-500 dark:text-gray-400">
          Click any member to inspect workload, risk, and AI-suggested next actions across every project they&apos;re on.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
        <Card className="p-4 lg:col-span-1">
          <div className="flex items-center justify-between mb-3 px-1">
            <span className="flex items-center gap-2 text-sm font-semibold text-gray-900 dark:text-gray-100">
              <UsersIcon className="w-5 h-5 text-gray-400" />
              Team Members
            </span>
            <span className="text-xs text-gray-400">{filtered.length}/{members.length}</span>
          </div>
          <div className="relative mb-3">
            <MagnifyingGlassIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search name or project…"
              className="w-full rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 pl-9 pr-3 py-2 text-sm text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-brand-500"
            />
          </div>
          <div className="flex flex-wrap gap-1 mb-3">
            {FILTERS.map((f) => (
              <button
                key={f}
                type="button"
                onClick={() => setFilter(f)}
                className={clsx(
                  'rounded-full px-2.5 py-1 text-xs font-medium',
                  filter === f
                    ? 'bg-brand-600 text-white'
                    : 'text-gray-500 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800'
                )}
              >
                {f}
              </button>
            ))}
          </div>
          <ul className="max-h-[520px] overflow-y-auto space-y-1">
            {filtered.map((m) => (
              <li key={m.email}>
                <button
                  type="button"
                  onClick={() => setSelectedEmail(m.email)}
                  className={clsx(
                    'w-full flex items-center gap-3 rounded-lg px-2 py-2 text-left',
                    selected?.email === m.email ? 'bg-brand-50 dark:bg-brand-500/10' : 'hover:bg-gray-50 dark:hover:bg-gray-800'
                  )}
                >
                  <span className={`relative flex h-9 w-9 items-center justify-center rounded-full ${avatarGradient(m.email)} text-xs font-semibold text-white`}>
                    {initials(m.name)}
                    <span className={clsx('absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full border-2 border-white dark:border-gray-900', RISK_LEVEL_DOT[m.riskLevel])} />
                  </span>
                  <span>
                    <p className={clsx('text-sm font-medium', selected?.email === m.email ? 'text-brand-700 dark:text-brand-400' : 'text-gray-900 dark:text-gray-100')}>
                      {m.name}
                    </p>
                    <p className="text-xs text-gray-400">{m.projects.join(', ') || 'No active project'}</p>
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </Card>

        <div className="lg:col-span-2 space-y-6">
          {!selected ? (
            <Card className="p-10 text-center text-sm text-gray-400">No members match your filters.</Card>
          ) : (
            <>
              <Card className="p-6 flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <span className={`flex h-12 w-12 items-center justify-center rounded-full ${avatarGradient(selected.email)} text-sm font-semibold text-white`}>
                    {initials(selected.name)}
                  </span>
                  <div>
                    <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">{selected.name}</h2>
                    <p className="text-sm text-gray-500 dark:text-gray-400">{selected.role} · {selected.email}</p>
                    <div className="mt-1 flex gap-1.5">
                      {selected.projects.map((p) => (
                        <span key={p} className="rounded-full bg-gray-100 dark:bg-gray-800 px-2 py-0.5 text-xs text-gray-600 dark:text-gray-300">
                          {p}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => showToast(`DM to ${selected.name} is a visual placeholder in this build.`, 'info')}
                  className="inline-flex items-center gap-1.5 rounded-lg bg-brand-600 px-3 py-1.5 text-sm font-semibold text-white hover:bg-brand-700 focus:outline-none focus:ring-2 focus:ring-brand-500"
                >
                  <PaperAirplaneIcon className="w-4 h-4" />
                  DM
                </button>
              </Card>

              <Card className="p-6">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100">Performance summary</h3>
                  <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${RISK_LEVEL_CLASSES[selected.riskLevel]}`}>{selected.riskLevel}</span>
                </div>
                <div className="grid grid-cols-3 gap-6">
                  <div>
                    <p className="text-xs uppercase text-gray-400 mb-1">Velocity</p>
                    <p className="text-2xl font-bold text-amber-600 dark:text-amber-400">{selected.velocity}%</p>
                  </div>
                  <div>
                    <p className="text-xs uppercase text-gray-400 mb-1">Done</p>
                    <p className="text-2xl font-bold text-gray-900 dark:text-gray-100">
                      {selected.pointsDone}/{selected.pointsTotal} <span className="text-sm font-normal text-gray-400">pts</span>
                    </p>
                  </div>
                  <div>
                    <p className="text-xs uppercase text-gray-400 mb-1">Tickets</p>
                    <p className="text-2xl font-bold text-gray-900 dark:text-gray-100">
                      {selected.ticketsDone}/{selected.ticketsTotal}
                    </p>
                  </div>
                </div>
                <div className="mt-4 h-2 w-full rounded-full bg-gray-100 dark:bg-gray-800 overflow-hidden">
                  <div className="h-full rounded-full bg-amber-500" style={{ width: `${selected.velocity}%` }} />
                </div>
                <div className="mt-3 flex gap-4 text-xs text-gray-500 dark:text-gray-400">
                  {selected.staleCount > 0 && <span>⏱ {selected.staleCount} stale</span>}
                  {selected.stuckCount > 0 && <span>⏱ {selected.stuckCount} stuck</span>}
                </div>
              </Card>

              {selected.reasons.length > 0 && (
                <Card className="p-6">
                  <div className="flex items-center gap-2 mb-3">
                    <SparklesIcon className="w-5 h-5 text-brand-500" />
                    <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100">AI insight</h3>
                  </div>
                  <p className="text-xs font-semibold uppercase text-gray-500 dark:text-gray-400 mb-2">This member is at risk because:</p>
                  <ul className="space-y-1 text-sm text-gray-700 dark:text-gray-300 mb-4">
                    {selected.reasons.map((r) => (
                      <li key={r} className="flex gap-2">
                        <span className="text-amber-500">•</span>
                        {r}
                      </li>
                    ))}
                  </ul>
                  <p className="text-xs font-semibold uppercase text-gray-500 dark:text-gray-400 mb-2">Suggested action</p>
                  <ul className="space-y-1 text-sm text-gray-700 dark:text-gray-300">
                    {selected.suggestedActions.map((a) => (
                      <li key={a} className="flex gap-2">
                        <span className="text-emerald-500">•</span>
                        {a}
                      </li>
                    ))}
                  </ul>
                </Card>
              )}

              <Card className="p-6">
                <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100 mb-3">Today&apos;s tasks</h3>
                {selected.todayTasks.length === 0 ? (
                  <p className="text-sm text-gray-400">Nothing in flight right now.</p>
                ) : (
                  <ul className="space-y-2">
                    {selected.todayTasks.map((t) => (
                      <li key={t.id} className="flex items-center justify-between rounded-lg border border-gray-100 dark:border-gray-800 px-3 py-2 text-sm">
                        <span className="font-medium text-gray-900 dark:text-gray-100">{t.id}</span>
                        <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_CLASSES[t.status]}`}>{t.status}</span>
                        {t.priority && (
                          <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${PRIORITY_CLASSES[t.priority]}`}>
                            {t.priority} · {t.priorityLabel}
                          </span>
                        )}
                        <span className="text-gray-400">{t.storyPoints}pt</span>
                      </li>
                    ))}
                  </ul>
                )}
              </Card>

              <Card className="p-6">
                <div className="flex items-center justify-between mb-3">
                  <span className="flex items-center gap-2 text-sm font-semibold text-gray-900 dark:text-gray-100">
                    <CpuChipIcon className="w-5 h-5 text-gray-400" />
                    Nudges received
                  </span>
                  <span className="text-xs text-gray-400">{selected.nudgesReceived.length} from AI Scrum Master</span>
                </div>
                {selected.nudgesReceived.length === 0 ? (
                  <p className="text-sm text-gray-400">No nudges sent to {selected.name.split(' ')[0]} yet.</p>
                ) : (
                  <ul className="space-y-3">
                    {selected.nudgesReceived.map((n, i) => (
                      <li key={i} className="rounded-lg border border-gray-100 dark:border-gray-800 px-3 py-2.5">
                        <div className="flex items-center justify-between gap-3 mb-1.5">
                          <span className="text-xs text-gray-500 dark:text-gray-400">
                            <span className="font-medium text-gray-700 dark:text-gray-300">Scrum Master</span> · {n.projectName} ·{' '}
                            {n.ticketIds.join(', ')}
                            {n.loggedOnly && (
                              <span className="ml-2 inline-flex items-center gap-1 rounded-full bg-gray-100 dark:bg-gray-800 px-1.5 py-0.5 text-[10px] font-medium text-gray-500 dark:text-gray-400">
                                <LockClosedIcon className="w-2.5 h-2.5" />
                                Logged only
                              </span>
                            )}
                          </span>
                          <span className="shrink-0 text-xs text-gray-400">{formatShortDate(n.generatedAt)}</span>
                        </div>
                        <p className="text-sm text-gray-700 dark:text-gray-300">{n.message}</p>
                        <p className="mt-1 text-xs text-gray-400">sent to #{n.teamSlug}</p>
                      </li>
                    ))}
                  </ul>
                )}
              </Card>

              <Card className="p-6">
                <div className="flex items-center justify-between mb-3">
                  <span className="flex items-center gap-2 text-sm font-semibold text-gray-900 dark:text-gray-100">
                    <SparklesIcon className="w-5 h-5 text-gray-400" />
                    Recent activity
                  </span>
                  <span className="text-xs text-gray-400">{selected.recentActivity.length} events</span>
                </div>
                {selected.recentActivity.length === 0 ? (
                  <p className="text-sm text-gray-400">No ticket movement logged for {selected.name.split(' ')[0]} yet.</p>
                ) : (
                  <ul className="space-y-3">
                    {selected.recentActivity.map((a, i) => (
                      <li key={i} className="flex items-start gap-2.5">
                        <span className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${ACTIVITY_DOT[a.to] ?? 'bg-gray-400'}`} />
                        <div>
                          <p className="text-sm text-gray-900 dark:text-gray-100">{describeActivity(a)}</p>
                          <p className="text-xs text-gray-400">{a.projectName} · {formatShortDate(a.at)}</p>
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
              </Card>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
