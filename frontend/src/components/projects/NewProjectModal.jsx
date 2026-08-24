import { DocumentArrowUpIcon, PencilSquareIcon, XMarkIcon } from '@heroicons/react/24/outline'
import clsx from 'clsx'
import { useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import client from '../../api/client'
import Spinner from '../common/Spinner'

const TODAY = new Date().toISOString().slice(0, 10)
const IN_TEN_DAYS = new Date(Date.now() + 10 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10)

const FIELD_CLASS =
  'w-full rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 px-3 py-2 text-sm text-gray-900 dark:text-gray-100 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-brand-500'

function Field({ label, children }) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-medium text-gray-500 dark:text-gray-400">{label}</span>
      {children}
    </label>
  )
}

const EMPTY_FORM = {
  name: '', teamSlug: '', sprintName: '', startDate: TODAY, endDate: IN_TEN_DAYS, prefix: '',
}

export default function NewProjectModal({ onClose, onCreated, initialMode = 'manual' }) {
  const [mode, setMode] = useState(initialMode)
  const [form, setForm] = useState(EMPTY_FORM)
  const [file, setFile] = useState(null)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState(null)
  const fileInputRef = useRef(null)

  const update = (key) => (e) => setForm((f) => ({ ...f, [key]: e.target.value }))

  const submit = async (e) => {
    e.preventDefault()
    setError(null)

    if (!form.name.trim() || !form.teamSlug.trim() || !form.sprintName.trim() || !form.prefix.trim()) {
      setError('Name, team slug, sprint name, and prefix are all required.')
      return
    }
    if (mode === 'import' && !file) {
      setError('Choose a CSV file to import.')
      return
    }

    setSubmitting(true)
    try {
      if (mode === 'manual') {
        const { data } = await client.post('/api/projects', {
          name: form.name.trim(),
          teamSlug: form.teamSlug.trim(),
          sprintName: form.sprintName.trim(),
          startDate: form.startDate,
          endDate: form.endDate,
          prefix: form.prefix.trim(),
          tickets: [],
        })
        onCreated(data)
      } else {
        const body = new FormData()
        body.append('name', form.name.trim())
        body.append('teamSlug', form.teamSlug.trim())
        body.append('sprintName', form.sprintName.trim())
        body.append('startDate', form.startDate)
        body.append('endDate', form.endDate)
        body.append('prefix', form.prefix.trim())
        body.append('file', file)
        const { data } = await client.post('/api/projects/import', body, {
          headers: { 'Content-Type': 'multipart/form-data' },
        })
        onCreated(data)
      }
    } catch (err) {
      setError(err.message || 'Could not create the project')
    } finally {
      setSubmitting(false)
    }
  }

  return createPortal(
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-gray-900/50 backdrop-blur-sm p-4"
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label="New project"
        onClick={(e) => e.stopPropagation()}
        className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-2xl border border-gray-100 dark:border-gray-800 bg-white dark:bg-gray-900 shadow-lg"
      >
        <div className="flex items-center justify-between border-b border-gray-100 dark:border-gray-800 px-6 py-4">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">New project</h2>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1 text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800"
            aria-label="Close"
          >
            <XMarkIcon className="w-5 h-5" />
          </button>
        </div>

        <div className="flex gap-2 px-6 pt-4">
          {[
            { id: 'manual', label: 'Manual', icon: PencilSquareIcon },
            { id: 'import', label: 'Import CSV', icon: DocumentArrowUpIcon },
          ].map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setMode(tab.id)}
              className={clsx(
                'inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium',
                mode === tab.id
                  ? 'bg-brand-600 text-white'
                  : 'border border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800'
              )}
            >
              <tab.icon className="w-4 h-4" />
              {tab.label}
            </button>
          ))}
        </div>

        <form onSubmit={submit} className="space-y-4 px-6 py-5">
          <Field label="Project name">
            <input className={FIELD_CLASS} value={form.name} onChange={update('name')} placeholder="Growth Experiments" />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Team slug">
              <input className={FIELD_CLASS} value={form.teamSlug} onChange={update('teamSlug')} placeholder="growth-team" />
            </Field>
            <Field label="Ticket prefix">
              <input className={FIELD_CLASS} value={form.prefix} onChange={update('prefix')} placeholder="GRW" />
            </Field>
          </div>
          <Field label="Sprint name">
            <input className={FIELD_CLASS} value={form.sprintName} onChange={update('sprintName')} placeholder="Sprint 1 — Growth Experiments" />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Start date">
              <input type="date" className={FIELD_CLASS} value={form.startDate} onChange={update('startDate')} />
            </Field>
            <Field label="End date">
              <input type="date" className={FIELD_CLASS} value={form.endDate} onChange={update('endDate')} />
            </Field>
          </div>

          {mode === 'manual' ? (
            <p className="text-xs text-gray-400">
              Creates the project with one starter ticket — add or edit tickets afterward from the Kanban board.
            </p>
          ) : (
            <Field label="Tickets CSV">
              <input
                ref={fileInputRef}
                type="file"
                accept=".csv,text/csv"
                onChange={(e) => setFile(e.target.files?.[0] ?? null)}
                className="block w-full text-sm text-gray-600 dark:text-gray-300 file:mr-3 file:rounded-lg file:border-0 file:bg-brand-50 dark:file:bg-brand-500/10 file:px-3 file:py-1.5 file:text-sm file:font-medium file:text-brand-700 dark:file:text-brand-300 hover:file:bg-brand-100"
              />
              <p className="mt-1.5 text-xs text-gray-400">
                Required columns: <code className="text-gray-500 dark:text-gray-400">id, summary</code>. Optional:
                status, assigneeName, assigneeEmail, storyPoints, blockers (;-separated), acceptanceCriteria, priority.
              </p>
            </Field>
          )}

          {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}

          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg border border-gray-200 dark:border-gray-700 px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-800"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="inline-flex items-center gap-1.5 rounded-lg bg-brand-600 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-700 disabled:opacity-60"
            >
              {submitting && <Spinner className="w-4 h-4" />}
              {submitting ? 'Creating…' : 'Create project'}
            </button>
          </div>
        </form>
      </div>
    </div>,
    document.body
  )
}
