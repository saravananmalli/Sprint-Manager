import {
  ArrowPathIcon,
  CalendarDaysIcon,
  ExclamationTriangleIcon,
  MegaphoneIcon,
  PaperAirplaneIcon,
  PlayIcon,
} from '@heroicons/react/24/outline'
import { useEffect, useState } from 'react'
import client from '../api/client'
import Card from '../components/common/Card'
import { SlackSkeleton } from '../components/common/PageSkeletons'
import { useProjects } from '../hooks/useProjects'
import { useToast } from '../hooks/useToast'
import { formatRelativeTime } from '../utils/formatters'

export default function SlackPage() {
  const { currentProject } = useProjects()
  const { showToast } = useToast()
  const [overview, setOverview] = useState(null)
  const [loading, setLoading] = useState(true)
  const [sendingId, setSendingId] = useState(null)

  const load = () => {
    client
      .get('/api/slack/overview')
      .then(({ data }) => setOverview(data))
      .finally(() => setLoading(false))
  }

  useEffect(load, [])

  const runAndPostAll = async () => {
    for (const ch of overview.channels) {
      await sendChannel(ch.projectId, false)
    }
    showToast('Ran + posted all projects', 'success')
    load()
  }

  const sendChannel = async (projectId, notify = true) => {
    setSendingId(projectId)
    try {
      await client.post(`/api/slack/send/${projectId}`)
      if (notify) showToast('Sent to Slack (or logged if webhook not configured)', 'success')
    } catch (err) {
      if (notify) showToast(err.message || 'Send failed', 'error')
    } finally {
      setSendingId(null)
      if (notify) load()
    }
  }

  if (loading || !overview) {
    return <SlackSkeleton />
  }

  const webhookConfigured = overview.channels[0]?.webhookConfigured

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900 dark:text-gray-100">Slack</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400">Per-project channels, daily 9 AM auto-posts, pinned accountability, and cross-day escalations.</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={load}
            className="inline-flex items-center gap-1.5 rounded-lg border border-gray-200 dark:border-gray-700 px-3 py-1.5 text-sm font-medium text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-800 focus:outline-none focus:ring-2 focus:ring-brand-500"
          >
            <ArrowPathIcon className="w-4 h-4" />
            Refresh
          </button>
          <button
            type="button"
            onClick={runAndPostAll}
            className="inline-flex items-center gap-1.5 rounded-lg bg-brand-600 px-3 py-1.5 text-sm font-semibold text-white hover:bg-brand-700 focus:outline-none focus:ring-2 focus:ring-brand-500"
          >
            <PlayIcon className="w-4 h-4" />
            Run + post all
          </button>
        </div>
      </div>

      {!webhookConfigured && (
        <Card className="p-4 bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-900/40 flex items-start gap-2">
          <ExclamationTriangleIcon className="w-5 h-5 text-red-600 dark:text-red-400 shrink-0 mt-0.5" />
          <div className="text-sm">
            <p className="font-semibold text-red-700 dark:text-red-300">No Slack auth configured — posts go to backend console only</p>
            <p className="text-red-600 dark:text-red-400">Set SLACK_WEBHOOK_URL in backend/.env to wire up Slack.</p>
          </div>
        </Card>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card className="p-6">
          <div className="flex items-center gap-2 mb-4">
            <CalendarDaysIcon className="w-5 h-5 text-gray-400" />
            <h2 className="text-sm font-semibold text-gray-900 dark:text-gray-100">Daily scheduler</h2>
            <span className={`ml-auto text-xs font-medium ${overview.scheduler.enabled ? 'text-emerald-600' : 'text-gray-400'}`}>
              {overview.scheduler.enabled ? 'ON' : 'OFF'}
            </span>
          </div>
          <dl className="space-y-2 text-sm">
            <div className="flex justify-between">
              <dt className="text-gray-500 dark:text-gray-400">Daily time</dt>
              <dd className="text-gray-900 dark:text-gray-100">{overview.scheduler.dailyTimeUtc} UTC</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-gray-500 dark:text-gray-400">Status</dt>
              <dd className="text-gray-900 dark:text-gray-100">{overview.scheduler.status}</dd>
            </div>
          </dl>
          <p className="mt-4 text-xs text-gray-400">Set SCHEDULER_ENABLED=true in backend/.env to run the pipeline daily across every project.</p>
        </Card>

        <Card className="p-6">
          <div className="flex items-center gap-2 mb-4">
            <MegaphoneIcon className="w-5 h-5 text-gray-400" />
            <h2 className="text-sm font-semibold text-gray-900 dark:text-gray-100">Daily flow per project</h2>
          </div>
          <ol className="space-y-2 text-sm">
            {overview.dailyFlow.map((step) => (
              <li key={step.step} className="flex gap-2">
                <span className="text-brand-600 dark:text-brand-400 font-semibold">{step.step}.</span>
                <div>
                  <p className="text-gray-900 dark:text-gray-100">{step.title}</p>
                  <p className="text-xs text-gray-400">{step.detail}</p>
                </div>
              </li>
            ))}
          </ol>
        </Card>

        <Card className="p-6">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <ExclamationTriangleIcon className="w-5 h-5 text-amber-500" />
              <h2 className="text-sm font-semibold text-gray-900 dark:text-gray-100">Escalations</h2>
            </div>
            <span className="text-xs text-gray-400">{overview.escalations.reduce((s, e) => s + e.highRiskCount, 0)} active</span>
          </div>
          <p className="text-xs text-gray-400 mb-3">Members in HIGH_RISK for 2+ consecutive days trigger a Slack alert.</p>
          <p className="text-xs font-semibold uppercase text-gray-500 dark:text-gray-400 mb-1.5">High risk across portfolio</p>
          <ul className="space-y-1.5 text-sm">
            {overview.escalations.map((e) => (
              <li key={e.projectId} className="flex items-center justify-between">
                <span className="flex items-center gap-1.5 text-gray-700 dark:text-gray-300">
                  <span className="h-1.5 w-1.5 rounded-full bg-brand-500" />
                  {e.projectName}
                </span>
                <span className="font-semibold text-red-600 dark:text-red-400">{e.highRiskCount}</span>
              </li>
            ))}
          </ul>
        </Card>
      </div>

      <Card className="p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-medium text-gray-900 dark:text-gray-100">Project channels</h2>
          <span className="text-xs text-gray-400">{overview.channels.length}/{overview.channels.length} mapped · click &quot;Send now&quot; to fire the full flow</span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs font-semibold uppercase text-gray-500 dark:text-gray-400 border-b border-gray-100 dark:border-gray-800">
                <th className="py-2 pr-4">Project</th>
                <th className="py-2 pr-4">Channel</th>
                <th className="py-2 pr-4">Webhook</th>
                <th className="py-2 pr-4">Last run</th>
                <th className="py-2 pr-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {overview.channels.map((ch) => (
                <tr key={ch.projectId} className="border-b border-gray-50 dark:border-gray-800/60">
                  <td className="py-3 pr-4">
                    <p className="font-medium text-gray-900 dark:text-gray-100">
                      {ch.projectName} {ch.projectId === currentProject?.id && <span className="text-brand-600 dark:text-brand-400 text-xs">CURRENT</span>}
                    </p>
                    <p className="text-xs text-gray-400">{ch.projectId}</p>
                  </td>
                  <td className="py-3 pr-4 text-gray-600 dark:text-gray-400">#{ch.channel}</td>
                  <td className="py-3 pr-4">
                    <span className={ch.webhookConfigured ? 'text-emerald-600 dark:text-emerald-400' : 'text-gray-400'}>
                      {ch.webhookConfigured ? 'Configured' : 'Missing'}
                    </span>
                  </td>
                  <td className="py-3 pr-4 text-gray-500 dark:text-gray-400">{ch.lastRun ? formatRelativeTime(ch.lastRun) : 'No run cached'}</td>
                  <td className="py-3 pr-4 text-right">
                    <button
                      type="button"
                      onClick={() => sendChannel(ch.projectId)}
                      disabled={sendingId === ch.projectId}
                      className="inline-flex items-center gap-1.5 rounded-lg bg-gray-100 dark:bg-gray-800 px-3 py-1.5 text-xs font-medium text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700 disabled:opacity-60"
                    >
                      <PaperAirplaneIcon className="w-3.5 h-3.5" />
                      {sendingId === ch.projectId ? 'Sending…' : 'Send now'}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  )
}
