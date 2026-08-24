import { ChatBubbleLeftIcon, ClockIcon, HashtagIcon, PaperAirplaneIcon, UserIcon, XMarkIcon } from '@heroicons/react/24/outline'
import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { avatarGradient } from '../../utils/avatarColor'
import { formatAbbrevDate, formatShortDate, initials } from '../../utils/formatters'
import { explainRiskTag, PRIORITY_CLASSES, RISK_TAG_CLASSES, RISK_TAG_LABELS, STATUS_CLASSES } from '../../utils/riskColors'

function Dot({ className }) {
  return <span className={`h-1.5 w-1.5 rounded-full bg-current ${className || ''}`} />
}

function SectionLabel({ children }) {
  return <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-400 dark:text-gray-500">{children}</h3>
}

function DetailRow({ icon: Icon, label, value }) {
  return (
    <div className="flex items-center justify-between border-b border-gray-100 dark:border-gray-800 py-3 last:border-0">
      <span className="flex items-center gap-2 text-sm text-gray-500 dark:text-gray-400">
        <Icon className="h-4 w-4" />
        {label}
      </span>
      <span className="text-sm font-medium text-gray-900 dark:text-gray-100">{value}</span>
    </div>
  )
}

const TIMELINE_DOT = {
  updated: 'bg-brand-500',
  tag: 'bg-amber-500',
  created: 'bg-gray-400',
}

export default function TicketDrawer({ ticket, onClose }) {
  const [comments, setComments] = useState([])
  const [draft, setDraft] = useState('')

  useEffect(() => {
    const onKey = (e) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  if (!ticket) return null

  const riskTags = ticket.riskTags || []

  const timeline = [
    { key: 'updated', label: 'Last updated', date: ticket.lastUpdated, dot: 'updated' },
    ...riskTags.map((tag) => ({ key: `tag-${tag}`, label: `Tagged ${tag}`, date: ticket.lastUpdated, dot: 'tag' })),
    { key: 'created', label: 'Created', date: ticket.createdAt, dot: 'created' },
  ]

  const submitComment = () => {
    if (!draft.trim()) return
    setComments((c) => [...c, { text: draft.trim(), at: new Date().toISOString() }])
    setDraft('')
  }

  return createPortal(
    <div className="fixed inset-0 z-50 flex justify-end" role="dialog" aria-modal="true" aria-label={`${ticket.id} details`}>
      <div className="absolute inset-0 bg-gray-900/40 backdrop-blur-sm" onClick={onClose} />
      <div className="relative flex h-full w-full max-w-xl flex-col overflow-hidden bg-white dark:bg-gray-900 shadow-2xl">
        <div className="shrink-0 border-b border-gray-100 dark:border-gray-800 px-6 py-5">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <h2 className="text-xl font-bold text-gray-900 dark:text-gray-100">{ticket.id}</h2>
              <p className="mt-0.5 text-sm text-gray-500 dark:text-gray-400">{ticket.summary}</p>
            </div>
            <button
              type="button"
              onClick={onClose}
              aria-label="Close"
              className="shrink-0 rounded-lg p-1.5 text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 focus:outline-none focus:ring-2 focus:ring-brand-500"
            >
              <XMarkIcon className="h-5 w-5" />
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-6">
          <div className="flex flex-wrap items-center gap-2">
            <span className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-medium ${STATUS_CLASSES[ticket.status] ?? ''}`}>
              {ticket.status}
            </span>
            {ticket.priority && (
              <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-medium ${PRIORITY_CLASSES[ticket.priority]}`}>
                <Dot />
                {ticket.priority} · {ticket.priorityLabel}
              </span>
            )}
            {riskTags.map((tag) => (
              <span key={tag} className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-medium ${RISK_TAG_CLASSES[tag]}`}>
                <Dot />
                {RISK_TAG_LABELS[tag]}
              </span>
            ))}
          </div>

          <section>
            <SectionLabel>Details</SectionLabel>
            <DetailRow
              icon={UserIcon}
              label="Assignee"
              value={
                ticket.assignee?.name ? (
                  <span className="flex items-center gap-2">
                    <span className={`flex h-6 w-6 items-center justify-center rounded-full ${avatarGradient(ticket.assignee?.email)} text-[10px] font-semibold text-white`}>
                      {initials(ticket.assignee?.name)}
                    </span>
                    {ticket.assignee.name}
                  </span>
                ) : (
                  'Unassigned'
                )
              }
            />
            <DetailRow icon={HashtagIcon} label="Story Points" value={ticket.storyPoints ?? '—'} />
            <DetailRow
              icon={ClockIcon}
              label="Last updated"
              value={
                <>
                  {formatShortDate(ticket.lastUpdated)} <span className="text-gray-400 dark:text-gray-500">· {formatAbbrevDate(ticket.lastUpdated)}</span>
                </>
              }
            />
            <DetailRow icon={ClockIcon} label="Created" value={formatAbbrevDate(ticket.createdAt)} />
          </section>

          {riskTags.length > 0 && (
            <section>
              <SectionLabel>Why is this at risk?</SectionLabel>
              <ul className="space-y-2">
                {riskTags.map((tag) => {
                  const text = explainRiskTag(tag, ticket)
                  if (!text) return null
                  return (
                    <li key={tag} className="flex gap-2 text-sm text-gray-700 dark:text-gray-300">
                      <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-amber-500" />
                      {text}
                    </li>
                  )
                })}
              </ul>
            </section>
          )}

          <section>
            <SectionLabel>Acceptance criteria</SectionLabel>
            <p className="text-sm text-gray-700 dark:text-gray-300">
              {ticket.acceptanceCriteria?.trim() || 'No acceptance criteria written yet.'}
            </p>
          </section>

          <section>
            <SectionLabel>Activity</SectionLabel>
            <ul>
              {timeline.map((entry, i) => (
                <li key={entry.key} className="relative flex gap-3 pb-5 last:pb-0">
                  {i < timeline.length - 1 && <span className="absolute left-[5px] top-3 h-full w-px bg-gray-200 dark:bg-gray-800" />}
                  <span className={`relative mt-1 h-3 w-3 shrink-0 rounded-full ${TIMELINE_DOT[entry.dot]}`} />
                  <span>
                    <span className="block text-sm font-medium text-gray-900 dark:text-gray-100">{entry.label}</span>
                    <span className="block text-xs text-gray-400 dark:text-gray-500">{formatShortDate(entry.date)}</span>
                  </span>
                </li>
              ))}
            </ul>
          </section>

          <section>
            <h3 className="mb-2 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-gray-400 dark:text-gray-500">
              <ChatBubbleLeftIcon className="h-4 w-4" />
              Comments ({comments.length})
            </h3>
            {comments.length === 0 ? (
              <p className="text-sm italic text-gray-400 dark:text-gray-500">No comments yet.</p>
            ) : (
              <ul className="space-y-3">
                {comments.map((c, i) => (
                  <li key={i} className="text-sm text-gray-700 dark:text-gray-300">
                    <p>{c.text}</p>
                    <p className="text-xs text-gray-400 dark:text-gray-500">{formatShortDate(c.at)}</p>
                  </li>
                ))}
              </ul>
            )}
            <div className="mt-3 flex items-end gap-2 rounded-xl border border-gray-200 dark:border-gray-700 p-2 focus-within:ring-2 focus-within:ring-brand-500">
              <textarea
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                onKeyDown={(e) => {
                  if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') submitComment()
                }}
                placeholder="Add a comment… (⌘⏎ to send)"
                rows={2}
                className="flex-1 resize-none bg-transparent px-1 text-sm text-gray-900 dark:text-gray-100 placeholder:text-gray-400 focus:outline-none"
              />
              <button
                type="button"
                onClick={submitComment}
                disabled={!draft.trim()}
                aria-label="Send comment"
                className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-brand-600 text-white hover:bg-brand-700 disabled:opacity-40 focus:outline-none focus:ring-2 focus:ring-brand-500"
              >
                <PaperAirplaneIcon className="h-4 w-4" />
              </button>
            </div>
          </section>
        </div>
      </div>
    </div>,
    document.body
  )
}
