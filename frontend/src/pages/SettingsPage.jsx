import { CircleStackIcon, KeyIcon, MoonIcon, PaperAirplaneIcon, SunIcon } from '@heroicons/react/24/outline'
import clsx from 'clsx'
import { useEffect, useState } from 'react'
import client from '../api/client'
import Card from '../components/common/Card'
import Skeleton from '../components/common/Skeleton'
import { useProjects } from '../hooks/useProjects'
import { useTheme } from '../hooks/useTheme'
import { useToast } from '../hooks/useToast'

const SHORTCUTS = [
  { label: 'Open command palette', keys: ['Ctrl', 'K'] },
  { label: 'Run agent', keys: ['R'] },
  { label: 'Go to Dashboard', keys: ['G', 'D'] },
  { label: 'Go to Analytics', keys: ['G', 'A'] },
  { label: 'Go to Settings', keys: ['G', 'S'] },
  { label: 'Open command palette (help)', keys: ['?'] },
  { label: 'Close palette / modal / drawer', keys: ['Esc'] },
]

export default function SettingsPage() {
  const { theme, setTheme } = useTheme()
  const { projectId } = useProjects()
  const { showToast } = useToast()
  const [settings, setSettings] = useState(null)
  const [values, setValues] = useState({})
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    client.get('/api/settings/runtime').then(({ data }) => {
      setSettings(data)
      setValues(Object.fromEntries(Object.entries(data).map(([k, v]) => [k, v.value])))
      setLoading(false)
    })
  }, [])

  const save = async () => {
    setSaving(true)
    try {
      const { data } = await client.put('/api/settings/runtime', { values })
      setSettings(data)
      showToast('Runtime configuration saved — takes effect on the next agent run', 'success')
    } catch (err) {
      showToast(err.message || 'Failed to save settings', 'error')
    } finally {
      setSaving(false)
    }
  }

  const sendLatestToSlack = async () => {
    if (!projectId) return
    try {
      await client.post(`/api/slack/send/${projectId}`)
      showToast('Sent latest run to Slack', 'success')
    } catch (err) {
      showToast(err.message || 'Failed to send', 'error')
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-gray-900 dark:text-gray-100">Settings</h1>
        <p className="text-sm text-gray-500 dark:text-gray-400">Theme, integrations, keyboard shortcuts, and runtime configuration.</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card className="p-6">
          <div className="flex items-center gap-2 mb-4">
            <SunIcon className="w-5 h-5 text-gray-400" />
            <h2 className="text-sm font-semibold text-gray-900 dark:text-gray-100">Appearance</h2>
          </div>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setTheme('light')}
              className={clsx(
                'flex-1 inline-flex items-center justify-center gap-2 rounded-lg border px-3 py-2 text-sm font-medium',
                theme === 'light'
                  ? 'border-brand-500 bg-brand-50 text-brand-700 dark:bg-brand-500/10 dark:text-brand-400'
                  : 'border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-300'
              )}
            >
              <SunIcon className="w-4 h-4" />
              Light
            </button>
            <button
              type="button"
              onClick={() => setTheme('dark')}
              className={clsx(
                'flex-1 inline-flex items-center justify-center gap-2 rounded-lg border px-3 py-2 text-sm font-medium',
                theme === 'dark'
                  ? 'border-brand-500 bg-brand-50 text-brand-700 dark:bg-brand-500/10 dark:text-brand-400'
                  : 'border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-300'
              )}
            >
              <MoonIcon className="w-4 h-4" />
              Dark
            </button>
          </div>
          <p className="mt-3 text-xs text-gray-400">Saved to localStorage. Dark is the default.</p>
        </Card>

        <Card className="p-6">
          <div className="flex items-center gap-2 mb-4">
            <KeyIcon className="w-5 h-5 text-gray-400" />
            <h2 className="text-sm font-semibold text-gray-900 dark:text-gray-100">Keyboard shortcuts</h2>
          </div>
          <ul className="space-y-2 text-sm">
            {SHORTCUTS.map((s) => (
              <li key={s.label} className="flex items-center justify-between">
                <span className="text-gray-600 dark:text-gray-400">{s.label}</span>
                <span className="flex gap-1">
                  {s.keys.map((k) => (
                    <kbd key={k} className="rounded bg-gray-100 dark:bg-gray-800 px-1.5 py-0.5 text-xs text-gray-700 dark:text-gray-300">
                      {k}
                    </kbd>
                  ))}
                </span>
              </li>
            ))}
          </ul>
        </Card>
      </div>

      <Card className="p-6">
        <div className="flex items-center gap-2 mb-3">
          <PaperAirplaneIcon className="w-5 h-5 text-gray-400" />
          <h2 className="text-sm font-semibold text-gray-900 dark:text-gray-100">Slack integration</h2>
        </div>
        <p className="text-sm text-gray-600 dark:text-gray-400 mb-3">
          Posts the last agent run output to your configured Slack webhook in the spec order:{' '}
          <span className="font-medium text-gray-900 dark:text-gray-100">health card → standup digest → owner nudges</span>.
        </p>
        <button
          type="button"
          onClick={sendLatestToSlack}
          className="inline-flex items-center gap-1.5 rounded-lg bg-brand-600 px-3 py-1.5 text-sm font-semibold text-white hover:bg-brand-700 focus:outline-none focus:ring-2 focus:ring-brand-500"
        >
          <PaperAirplaneIcon className="w-4 h-4" />
          Send latest run to Slack
        </button>
        <p className="mt-3 text-xs text-gray-400">
          Configure SLACK_WEBHOOK_URL in backend/.env. If unset, the API responds OK and logs &quot;disabled&quot; to backend stdout.
        </p>
      </Card>

      <Card className="p-6">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <CircleStackIcon className="w-5 h-5 text-gray-400" />
            <h2 className="text-sm font-semibold text-gray-900 dark:text-gray-100">Runtime configuration</h2>
          </div>
          <button
            type="button"
            onClick={save}
            disabled={saving || loading}
            className="rounded-lg bg-brand-600 px-3 py-1.5 text-sm font-semibold text-white hover:bg-brand-700 disabled:opacity-60 focus:outline-none focus:ring-2 focus:ring-brand-500"
          >
            {saving ? 'Saving…' : 'Save'}
          </button>
        </div>
        <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
          These knobs live in backend/.env. Risk thresholds take effect on the next agent run — no server restart needed.
        </p>
        {loading ? (
          <Skeleton className="h-40" />
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {Object.entries(settings).map(([key, meta]) => (
              <div key={key} className="rounded-xl border border-gray-100 dark:border-gray-800 p-4">
                <label htmlFor={key} className="block text-xs font-mono font-semibold text-gray-500 dark:text-gray-400 mb-1">
                  {key}
                </label>
                {meta.type === 'bool' ? (
                  <select
                    id={key}
                    value={values[key]}
                    onChange={(e) => setValues((v) => ({ ...v, [key]: e.target.value }))}
                    className="w-full rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 px-2 py-1.5 text-sm text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-brand-500"
                  >
                    <option value="true">true</option>
                    <option value="false">false</option>
                  </select>
                ) : (
                  <input
                    id={key}
                    type="number"
                    value={values[key]}
                    onChange={(e) => setValues((v) => ({ ...v, [key]: e.target.value }))}
                    className="w-full rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 px-2 py-1.5 text-sm text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-brand-500"
                  />
                )}
                <p className="mt-1.5 text-xs text-gray-400">{meta.help}</p>
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  )
}
