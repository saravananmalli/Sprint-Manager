import { RectangleGroupIcon } from '@heroicons/react/24/outline'
import clsx from 'clsx'
import { useEffect, useMemo, useState } from 'react'
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import client from '../api/client'
import Card from '../components/common/Card'
import { AnalyticsSkeleton } from '../components/common/PageSkeletons'
import TicketTable from '../components/tickets/TicketTable'
import { useAgentRun } from '../hooks/useAgentRun'
import { useProjects } from '../hooks/useProjects'
import { RISK_TAG_CLASSES, RISK_TAG_LABELS } from '../utils/riskColors'

const RISK_COLORS = { Stale: '#f59e0b', Stuck: '#f97316', Blocked: '#ef4444', 'No AC': '#a855f7', Unassigned: '#9ca3af' }
const RISK_TAGS = ['STALE', 'STUCK', 'BLOCKED', 'UNASSIGNED', 'INCOMPLETE_AC']
const STATUS_OPTIONS = ['All', 'Backlog', 'Todo', 'In Progress', 'Testing', 'In Review', 'Done']
const GROUP_OPTIONS = [
  { value: 'none', label: 'No grouping' },
  { value: 'status', label: 'Group by status' },
  { value: 'owner', label: 'Group by owner' },
  { value: 'priority', label: 'Group by priority' },
]

export default function AnalyticsPage() {
  const { projectId } = useProjects()
  const { runVersion } = useAgentRun()
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [status, setStatus] = useState('All')
  const [riskFilter, setRiskFilter] = useState([])
  const [search, setSearch] = useState('')
  const [groupBy, setGroupBy] = useState('none')

  useEffect(() => {
    setData(null)
  }, [projectId])

  useEffect(() => {
    if (!projectId) return
    let stale = false // ignore the response if the project changed meanwhile
    client
      .get(`/api/projects/${projectId}/analytics`)
      .then(({ data }) => {
        if (!stale) setData(data)
      })
      .finally(() => {
        if (!stale) setLoading(false)
      })
    return () => {
      stale = true
    }
  }, [projectId, runVersion])

  const filteredTickets = useMemo(() => {
    if (!data) return []
    return data.tickets.filter((t) => {
      if (status !== 'All' && t.status !== status) return false
      if (riskFilter.length > 0 && !riskFilter.some((tag) => t.riskTags?.includes(tag))) return false
      if (search && !`${t.id} ${t.summary}`.toLowerCase().includes(search.toLowerCase())) return false
      return true
    })
  }, [data, status, riskFilter, search])

  const toggleRisk = (tag) => setRiskFilter((c) => (c.includes(tag) ? c.filter((t) => t !== tag) : [...c, tag]))

  if (loading || !data) {
    return <AnalyticsSkeleton />
  }

  const actualSeries = data.velocityPrediction.filter((p) => p.kind === 'actual')
  const forecastSeries = data.velocityPrediction.filter((p) => p.kind === 'forecast')
  const chartData = [...actualSeries, ...forecastSeries.map((f, i) => ({ ...f, actual: i === 0 ? actualSeries.at(-1)?.value : undefined }))]

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-gray-900 dark:text-gray-100">Analytics</h1>
        <p className="text-sm text-gray-500 dark:text-gray-400">Risk distribution, per-assignee load, velocity prediction, and the full ticket list.</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card className="p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-semibold text-gray-900 dark:text-gray-100">Risk distribution</h2>
            <span className="text-xs text-gray-400">across all tickets</span>
          </div>
          <div className="flex items-center gap-8">
            <ResponsiveContainer width={220} height={300}>
              <PieChart>
                <Pie data={data.riskDistribution} dataKey="count" nameKey="label" innerRadius={65} outerRadius={105} paddingAngle={2}>
                  {data.riskDistribution.map((d) => (
                    <Cell key={d.label} fill={RISK_COLORS[d.label] ?? '#9ca3af'} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
            <ul className="space-y-3 text-sm">
              {data.riskDistribution.map((d) => (
                <li key={d.label} className="flex items-center gap-2">
                  <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: RISK_COLORS[d.label] ?? '#9ca3af' }} />
                  <span className="text-gray-600 dark:text-gray-400">{d.label}</span>
                  <span className="font-semibold text-gray-900 dark:text-gray-100">{d.count}</span>
                </li>
              ))}
            </ul>
          </div>
        </Card>

        <Card className="p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-semibold text-gray-900 dark:text-gray-100">Points per assignee</h2>
            <span className="text-xs text-gray-400">stacked by status</span>
          </div>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={data.pointsPerAssignee} layout="vertical" margin={{ left: 24 }}>
              <CartesianGrid strokeDasharray="3 3" className="stroke-gray-100 dark:stroke-gray-800" />
              <XAxis type="number" tick={{ fontSize: 11 }} />
              <YAxis type="category" dataKey="assignee" width={90} tick={{ fontSize: 11 }} />
              <Tooltip />
              <Legend />
              <Bar dataKey="done" stackId="a" name="Done" fill="#10b981" radius={[0, 0, 0, 0]} />
              <Bar dataKey="inProgress" stackId="a" name="In Progress" fill="#6366f1" radius={[0, 4, 4, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </Card>

        <Card className="p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-semibold text-gray-900 dark:text-gray-100">Velocity prediction</h2>
            <span className="text-xs text-gray-400">
              {actualSeries.length}d actual · {forecastSeries.length}d forecast
            </span>
          </div>
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" className="stroke-gray-100 dark:stroke-gray-800" />
              <XAxis dataKey="date" tick={{ fontSize: 10 }} />
              <YAxis domain={[0, 100]} tick={{ fontSize: 11 }} />
              <Tooltip />
              <Line type="monotone" dataKey="value" stroke="#10b981" strokeWidth={2} dot connectNulls={false} />
            </LineChart>
          </ResponsiveContainer>
        </Card>
      </div>

      <Card className="p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-medium text-gray-900 dark:text-gray-100">Tickets</h2>
          <span className="text-xs text-gray-400">
            {filteredTickets.length} of {data.tickets.length}
          </span>
        </div>
        <div className="flex flex-wrap items-center gap-3 mb-4">
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search tickets…"
            className="rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 px-3 py-1.5 text-sm text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-brand-500 w-56"
          />
          <select
            value={status}
            onChange={(e) => setStatus(e.target.value)}
            className="rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 px-2 py-1.5 text-sm text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-brand-500"
          >
            {STATUS_OPTIONS.map((s) => (
              <option key={s} value={s}>{s}</option>
            ))}
          </select>
          <div className="relative">
            <RectangleGroupIcon className="pointer-events-none absolute left-2.5 top-1/2 w-4 h-4 -translate-y-1/2 text-gray-400" />
            <select
              value={groupBy}
              onChange={(e) => setGroupBy(e.target.value)}
              className="rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 pl-8 pr-3 py-1.5 text-sm text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-brand-500"
            >
              {GROUP_OPTIONS.map((g) => (
                <option key={g.value} value={g.value}>{g.label}</option>
              ))}
            </select>
          </div>
          {RISK_TAGS.map((tag) => (
            <button
              key={tag}
              type="button"
              onClick={() => toggleRisk(tag)}
              className={clsx(
                'inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-medium',
                RISK_TAG_CLASSES[tag],
                riskFilter.includes(tag) && 'ring-2 ring-offset-1 ring-brand-500 dark:ring-offset-gray-900'
              )}
            >
              <span className="h-1.5 w-1.5 rounded-full bg-current" />
              {RISK_TAG_LABELS[tag] ?? tag}
            </button>
          ))}
        </div>
        <TicketTable tickets={filteredTickets} groupBy={groupBy} />
      </Card>
    </div>
  )
}
