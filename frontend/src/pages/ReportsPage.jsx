import {
  ArrowDownTrayIcon,
  BriefcaseIcon,
  ClipboardDocumentIcon,
  EnvelopeIcon,
  ExclamationTriangleIcon,
} from '@heroicons/react/24/outline'
import { useEffect, useState } from 'react'
import {
  Area,
  CartesianGrid,
  ComposedChart,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import client from '../api/client'
import Card from '../components/common/Card'
import Skeleton from '../components/common/Skeleton'
import { useAgentRun } from '../hooks/useAgentRun'
import { useProjects } from '../hooks/useProjects'
import { useSprint } from '../hooks/useSprint'
import { useToast } from '../hooks/useToast'
import { RISK_TAG_CLASSES, RISK_TAG_LABELS, SPRINT_STATUS_CLASSES, STATUS_CLASSES } from '../utils/riskColors'

export default function ReportsPage() {
  const { projectId, currentProject } = useProjects()
  const { runVersion, runAgent, running } = useAgentRun()
  const { sprint, health } = useSprint()
  const { showToast } = useToast()
  const [report, setReport] = useState(null)
  const [standup, setStandup] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [emailStatus, setEmailStatus] = useState(null)
  const [copied, setCopied] = useState(false)

  const load = () => {
    if (!projectId) return
    setLoading(true)
    setError(null)
    client
      .get(`/api/projects/${projectId}/reports/leadership`)
      .then(({ data }) => setReport(data))
      .catch((err) => setError(err))
      .finally(() => setLoading(false))
    client
      .get(`/api/projects/${projectId}/reports/standup`)
      .then(({ data }) => setStandup(data))
      .catch(() => setStandup(null))
  }

  useEffect(load, [projectId, runVersion])

  const copyReport = async () => {
    if (!report) return
    await navigator.clipboard.writeText(report.text)
    setCopied(true)
    showToast('Copied to clipboard', 'success')
    setTimeout(() => setCopied(false), 1500)
  }

  const downloadPdf = () => {
    window.open(`${client.defaults.baseURL}/api/projects/${projectId}/reports/pdf`, '_blank')
  }

  const sendEmail = async () => {
    try {
      const { data } = await client.post(`/api/projects/${projectId}/reports/email`)
      setEmailStatus(data)
      showToast(data.sent ? 'Report emailed' : data.detail, data.sent ? 'success' : 'info')
    } catch (err) {
      showToast(err.message || 'Failed to send email', 'error')
    }
  }

  const sendToSlack = async () => {
    try {
      await client.post(`/api/slack/send/${projectId}`)
      showToast('Sent full flow to Slack', 'success')
    } catch (err) {
      showToast(err.message || 'Failed to send to Slack', 'error')
    }
  }

  if (error) {
    return (
      <div className="rounded-2xl border border-red-100 dark:border-red-900/40 bg-red-50 dark:bg-red-900/20 p-8 text-center">
        <p className="text-red-700 dark:text-red-300 mb-4">{error.message || 'Failed to load the leadership report'}</p>
        <button
          type="button"
          onClick={load}
          className="rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-brand-500 focus:ring-offset-2"
        >
          Retry
        </button>
      </div>
    )
  }

  if (loading || !report) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-96" />
        <Skeleton className="h-64" />
      </div>
    )
  }

  const emailConfigured = !emailStatus || emailStatus.sent
  const velocitySeries = sprint
    ? Array.from({ length: sprint.daysElapsed + sprint.daysRemaining + 1 }, (_, day) => {
        const dailyBurn = sprint.daysElapsed > 0 ? sprint.pointsDone / sprint.daysElapsed : 0
        const value = day <= sprint.daysElapsed ? sprint.totalCommitted - dailyBurn * day : null
        const ideal = sprint.totalCommitted - (sprint.totalCommitted / (sprint.daysElapsed + sprint.daysRemaining)) * day
        return {
          day,
          value: value !== null ? Math.max(Math.round(value * 10) / 10, 0) : null,
          band: [Math.max(ideal * 0.85, 0), ideal * 1.15],
        }
      })
    : []

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900 dark:text-gray-100">Reports</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400">Six outputs for {currentProject?.name} · {currentProject?.sprintName}</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={sendToSlack}
            className="rounded-lg border border-gray-200 dark:border-gray-700 px-3 py-1.5 text-sm font-medium text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-800 focus:outline-none focus:ring-2 focus:ring-brand-500"
          >
            Send full flow to Slack
          </button>
          <button
            type="button"
            onClick={runAgent}
            disabled={running}
            className="rounded-lg bg-brand-600 px-3 py-1.5 text-sm font-semibold text-white hover:bg-brand-700 disabled:opacity-60 focus:outline-none focus:ring-2 focus:ring-brand-500"
          >
            {running ? 'Running…' : 'Regenerate'}
          </button>
        </div>
      </div>

      {!emailConfigured && (
        <Card className="p-4 bg-amber-50 dark:bg-amber-900/20 border-amber-200 dark:border-amber-900/40 flex items-start gap-2">
          <EnvelopeIcon className="w-5 h-5 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
          <div className="text-sm">
            <p className="font-semibold text-amber-800 dark:text-amber-300">Email — not configured</p>
            <p className="text-amber-700 dark:text-amber-400">{emailStatus?.detail}</p>
          </div>
        </Card>
      )}

      <Card className="p-6">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <BriefcaseIcon className="w-5 h-5 text-gray-400" />
            <h2 className="text-lg font-medium text-gray-900 dark:text-gray-100">Leadership-ready sprint status</h2>
          </div>
          <div className="flex items-center gap-2">
            <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${SPRINT_STATUS_CLASSES[report.sprintStatus]}`}>{report.sprintStatus}</span>
            <button type="button" onClick={copyReport} className="inline-flex items-center gap-1 rounded-lg border border-gray-200 dark:border-gray-700 px-2.5 py-1.5 text-xs font-medium text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-800">
              <ClipboardDocumentIcon className="w-4 h-4" />
              {copied ? 'Copied ✓' : 'Copy'}
            </button>
            <button type="button" onClick={downloadPdf} className="inline-flex items-center gap-1 rounded-lg border border-gray-200 dark:border-gray-700 px-2.5 py-1.5 text-xs font-medium text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-800">
              <ArrowDownTrayIcon className="w-4 h-4" />
              Download PDF
            </button>
            <button type="button" onClick={sendEmail} className="inline-flex items-center gap-1 rounded-lg bg-gray-100 dark:bg-gray-800 px-2.5 py-1.5 text-xs font-medium text-gray-500 dark:text-gray-400">
              <EnvelopeIcon className="w-4 h-4" />
              Email
            </button>
          </div>
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <pre className="lg:col-span-2 whitespace-pre-wrap rounded-xl bg-gray-50 dark:bg-gray-800/60 p-4 text-sm text-gray-700 dark:text-gray-300 font-sans">{report.text}</pre>
          <div className="space-y-3 text-sm">
            <div>
              <p className="text-xs uppercase text-gray-400">Sprint</p>
              <p className="text-gray-900 dark:text-gray-100">{report.sprintName}</p>
            </div>
            <div>
              <p className="text-xs uppercase text-gray-400">Days</p>
              <p className="text-gray-900 dark:text-gray-100">{report.days}</p>
            </div>
            <div>
              <p className="text-xs uppercase text-gray-400">Velocity</p>
              <p className="text-gray-900 dark:text-gray-100">{report.velocity}%</p>
            </div>
            <div>
              <p className="text-xs uppercase text-gray-400">Projected</p>
              <p className="text-gray-900 dark:text-gray-100">{report.projected} / {report.totalCommitted} pts</p>
            </div>
            <div>
              <p className="text-xs uppercase text-gray-400">Health</p>
              <p className="text-gray-900 dark:text-gray-100">{report.health}/100 ({report.trend})</p>
            </div>
            {report.scrumMasterAsk && (
              <div>
                <p className="text-xs uppercase text-gray-400">Scrum Master ask</p>
                <p className="text-gray-900 dark:text-gray-100">{report.scrumMasterAsk}</p>
              </div>
            )}
          </div>
        </div>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card className="p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-medium text-gray-900 dark:text-gray-100">Sprint health score</h2>
            <span className="text-xs text-gray-400">{health?.trend}</span>
          </div>
          <p className="text-5xl font-bold text-red-500 dark:text-red-400">
            {health?.score ?? '—'} <span className="text-lg font-normal text-gray-400">/ 100</span>
          </p>
          <div className="mt-4 grid grid-cols-2 gap-4 text-sm">
            <div>
              <p className="text-xs uppercase text-gray-400">Velocity</p>
              <p className="text-gray-900 dark:text-gray-100">{health?.components?.velocityScore ?? '—'}</p>
            </div>
            <div>
              <p className="text-xs uppercase text-gray-400">Blockers</p>
              <p className="text-gray-900 dark:text-gray-100">{health?.components?.blockerScore ?? '—'}</p>
            </div>
            <div>
              <p className="text-xs uppercase text-gray-400">Staleness</p>
              <p className="text-gray-900 dark:text-gray-100">{health?.components?.stalenessScore ?? '—'}</p>
            </div>
            <div>
              <p className="text-xs uppercase text-gray-400">Completion</p>
              <p className="text-gray-900 dark:text-gray-100">{health?.components?.completionScore ?? '—'}</p>
            </div>
          </div>
        </Card>

        <Card className="p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-medium text-gray-900 dark:text-gray-100">Velocity &amp; burndown projection</h2>
            <span className="text-xs text-gray-400">±15% on-track band</span>
          </div>
          <div className="grid grid-cols-3 gap-4 text-sm mb-4">
            <div>
              <p className="text-xs uppercase text-gray-400">Daily burn</p>
              <p className="text-gray-900 dark:text-gray-100">{sprint && sprint.daysElapsed > 0 ? (sprint.pointsDone / sprint.daysElapsed).toFixed(2) : '0.00'} pts/day</p>
            </div>
            <div>
              <p className="text-xs uppercase text-gray-400">Projected total</p>
              <p className="text-gray-900 dark:text-gray-100">{sprint?.projectedCompletion} pts</p>
            </div>
            <div>
              <p className="text-xs uppercase text-gray-400">Status</p>
              <p className="text-gray-900 dark:text-gray-100">{sprint?.sprintStatus}</p>
            </div>
          </div>
          <ResponsiveContainer width="100%" height={180}>
            <ComposedChart data={velocitySeries}>
              <CartesianGrid strokeDasharray="3 3" className="stroke-gray-100 dark:stroke-gray-800" />
              <XAxis dataKey="day" tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 11 }} />
              <Tooltip />
              <Area dataKey="band" fill="#c7d2fe" fillOpacity={0.35} stroke="none" />
              <Line type="monotone" dataKey="value" stroke="#4f46e5" strokeWidth={2} dot />
            </ComposedChart>
          </ResponsiveContainer>
        </Card>
      </div>

      <Card className="p-6">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-lg font-medium text-gray-900 dark:text-gray-100">Daily stand-up summary</h2>
          <span className="text-xs text-gray-400">Slack-mrkdwn · ready for email</span>
        </div>
        {standup ? (
          <pre className="whitespace-pre-wrap rounded-xl bg-gray-50 dark:bg-gray-800/60 p-4 text-sm text-gray-700 dark:text-gray-300 font-sans">{standup.text}</pre>
        ) : (
          <p className="text-sm text-gray-400">Run the agent to generate the standup.</p>
        )}
      </Card>

      <Card className="p-6">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <ExclamationTriangleIcon className="w-5 h-5 text-amber-500" />
            <h2 className="text-lg font-medium text-gray-900 dark:text-gray-100">At-risk story list</h2>
          </div>
          <span className="text-xs text-gray-400">
            {sprint?.tickets.filter((t) => t.riskTags?.length).length ?? 0} tickets with risk reasons
          </span>
        </div>
        <ul className="divide-y divide-gray-100 dark:divide-gray-800">
          {sprint?.tickets
            .filter((t) => t.riskTags?.length)
            .map((t) => (
              <li key={t.id} className="py-3 flex items-center justify-between gap-4">
                <div>
                  <p className="text-sm font-medium text-gray-900 dark:text-gray-100">
                    {t.id} <span className={`ml-2 rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_CLASSES[t.status] ?? ''}`}>{t.status}</span>
                  </p>
                  <p className="text-sm text-gray-600 dark:text-gray-400">{t.summary}</p>
                </div>
                <div className="flex gap-1">
                  {t.riskTags.map((tag) => (
                    <span key={tag} className={`rounded-full px-2 py-0.5 text-xs font-medium ${RISK_TAG_CLASSES[tag]}`}>
                      {RISK_TAG_LABELS[tag]}
                    </span>
                  ))}
                </div>
              </li>
            ))}
        </ul>
      </Card>
    </div>
  )
}
