import { BoltIcon } from '@heroicons/react/24/outline'
import { useEffect, useRef, useState } from 'react'
import client from '../api/client'
import Card from '../components/common/Card'
import Skeleton from '../components/common/Skeleton'
import TicketDrawer from '../components/tickets/TicketDrawer'
import { useProjects } from '../hooks/useProjects'
import { useToast } from '../hooks/useToast'
import { avatarGradient } from '../utils/avatarColor'
import { formatRelativeTime, formatShortDate, initials } from '../utils/formatters'
import { PRIORITY_CLASSES, RISK_TAG_CLASSES, RISK_TAG_LABELS } from '../utils/riskColors'

const COLUMN_DOT = {
  Backlog: 'bg-gray-400',
  'In Progress': 'bg-brand-500',
  Testing: 'bg-amber-500',
  'In Review': 'bg-purple-500',
  Done: 'bg-emerald-500',
}

function GitBranchIcon(props) {
  return (
    <svg viewBox="0 0 16 16" fill="currentColor" {...props}>
      <path
        fillRule="evenodd"
        d="M11.75 2.5a.75.75 0 100 1.5.75.75 0 000-1.5zm-2.25.75a2.25 2.25 0 113 2.122V6A2.5 2.5 0 0110 8.5H6a1 1 0 00-1 1v1.128a2.251 2.251 0 11-1.5 0V5.372a2.25 2.25 0 111.5 0v1.836A2.492 2.492 0 016 7h4a1 1 0 001-1v-.628A2.25 2.25 0 019.5 3.25zM4.25 12a.75.75 0 100 1.5.75.75 0 000-1.5zM3.5 3.25a.75.75 0 111.5 0 .75.75 0 01-1.5 0z"
      />
    </svg>
  )
}

function GitPullRequestIcon(props) {
  return (
    <svg viewBox="0 0 16 16" fill="currentColor" {...props}>
      <path
        fillRule="evenodd"
        d="M7.177 3.073L9.573.677A.25.25 0 0110 .854v4.792a.25.25 0 01-.427.177L7.177 3.427a.25.25 0 010-.354zM3.75 2.5a.75.75 0 100 1.5.75.75 0 000-1.5zm-2.25.75a2.25 2.25 0 113 2.122v5.256a2.251 2.251 0 11-1.5 0V5.372A2.25 2.25 0 011.5 3.25zM11 2.5h-1V4h1a1 1 0 011 1v5.628a2.251 2.251 0 101.5 0V5A2.5 2.5 0 0011 2.5zm1 10.25a.75.75 0 111.5 0 .75.75 0 01-1.5 0zM3.75 12a.75.75 0 100 1.5.75.75 0 000-1.5z"
      />
    </svg>
  )
}

function GitMergeIcon(props) {
  return (
    <svg viewBox="0 0 16 16" fill="currentColor" {...props}>
      <path
        fillRule="evenodd"
        d="M5 3.254V3.25v.005a.75.75 0 110-.005v.004zm.45 1.9a2.25 2.25 0 10-1.95.218v5.256a2.25 2.25 0 101.5 0V7.123A5.735 5.735 0 009.25 9h1.378a2.251 2.251 0 100-1.5H9.25a4.25 4.25 0 01-3.8-2.346zM12.75 6a.75.75 0 100 1.5.75.75 0 000-1.5zm-8.5 6.75a.75.75 0 111.5 0 .75.75 0 01-1.5 0z"
      />
    </svg>
  )
}

function TicketCard({ ticket, onDragStart, onOpen }) {
  const draggedRef = useRef(false)
  return (
    <div
      draggable
      onDragStart={(e) => {
        draggedRef.current = true
        onDragStart(e, ticket.id)
      }}
      onClick={() => {
        if (draggedRef.current) {
          draggedRef.current = false
          return
        }
        onOpen(ticket)
      }}
      className="cursor-grab rounded-xl border border-gray-100 dark:border-gray-800 bg-white dark:bg-gray-900 p-3 shadow-sm hover:border-brand-200 dark:hover:border-brand-800 active:cursor-grabbing"
    >
      <div className="mb-1.5 flex items-center gap-2">
        <span className="font-mono text-sm font-bold text-gray-900 dark:text-gray-100">{ticket.id}</span>
        {ticket.priority && (
          <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium ${PRIORITY_CLASSES[ticket.priority]}`}>
            <span className="h-1 w-1 rounded-full bg-current" />
            {ticket.priority} · {ticket.priorityLabel}
          </span>
        )}
        <span className="ml-auto text-xs text-gray-400">#{ticket.storyPoints}</span>
      </div>
      <p className="text-sm text-gray-900 dark:text-gray-100 mb-2">{ticket.summary}</p>
      <div className="flex items-center gap-1.5 text-xs text-gray-500 dark:text-gray-400">
        <span className={`flex h-7 w-7 items-center justify-center rounded-full ${avatarGradient(ticket.assignee?.email)} text-[10px] font-semibold text-white`}>
          {initials(ticket.assignee?.name)}
        </span>
        {ticket.assignee?.name || 'Unassigned'} · {formatShortDate(ticket.lastUpdated)}
      </div>
      {ticket.riskTags?.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-1">
          {ticket.riskTags.map((tag) => (
            <span key={tag} className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium ${RISK_TAG_CLASSES[tag]}`}>
              <span className="h-1 w-1 rounded-full bg-current" />
              {RISK_TAG_LABELS[tag]}
            </span>
          ))}
        </div>
      )}
    </div>
  )
}

export default function KanbanPage() {
  const { projectId, currentProject } = useProjects()
  const [board, setBoard] = useState(null)
  const [loading, setLoading] = useState(true)
  const [dragTicket, setDragTicket] = useState(null)
  const [openTicket, setOpenTicket] = useState(null)
  const { showToast } = useToast()

  const load = () => {
    if (!projectId) return
    setLoading(true)
    client
      .get(`/api/projects/${projectId}/kanban`)
      .then(({ data }) => setBoard(data))
      .finally(() => setLoading(false))
  }

  useEffect(load, [projectId])

  const simulate = async (event) => {
    try {
      const { data } = await client.post(`/api/projects/${projectId}/kanban/simulate`, { event })
      showToast(`${data.activity.ticketId} moved ${data.activity.from} → ${data.activity.to}`, 'success')
      load()
    } catch (err) {
      showToast(err.message || 'Nothing eligible for that event', 'warning')
    }
  }

  const reset = async () => {
    await client.post(`/api/projects/${projectId}/kanban/reset`)
    showToast('Board reset', 'info')
    load()
  }

  const handleDrop = async (toColumn) => {
    if (!dragTicket) return
    try {
      await client.post(`/api/projects/${projectId}/kanban/move`, { ticketId: dragTicket, toColumn })
      load()
    } catch (err) {
      showToast(err.message || 'Could not move ticket', 'error')
    }
    setDragTicket(null)
  }

  if (loading || !board) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-24" />
        <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-96" />
          ))}
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900 dark:text-gray-100">Kanban</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            {currentProject?.sprintName} · drag to move manually, or simulate a git event below
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => simulate('git.push')}
            className="inline-flex items-center gap-1.5 rounded-lg bg-brand-600 px-3 py-1.5 text-sm font-semibold text-white hover:bg-brand-700 focus:outline-none focus:ring-2 focus:ring-brand-500"
          >
            <GitBranchIcon className="w-4 h-4" />
            Simulate push → Testing
          </button>
          <button
            type="button"
            onClick={() => simulate('git.pr_opened')}
            className="inline-flex items-center gap-1.5 rounded-lg border border-gray-200 dark:border-gray-700 px-3 py-1.5 text-sm font-medium text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-800 focus:outline-none focus:ring-2 focus:ring-brand-500"
          >
            <GitPullRequestIcon className="w-4 h-4" />
            Simulate PR open
          </button>
          <button
            type="button"
            onClick={() => simulate('git.pr_merged')}
            className="inline-flex items-center gap-1.5 rounded-lg border border-gray-200 dark:border-gray-700 px-3 py-1.5 text-sm font-medium text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-800 focus:outline-none focus:ring-2 focus:ring-brand-500"
          >
            <GitMergeIcon className="w-4 h-4" />
            Simulate PR merge
          </button>
          <button
            type="button"
            onClick={reset}
            className="rounded-lg border border-gray-200 dark:border-gray-700 px-3 py-1.5 text-sm font-medium text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-800 focus:outline-none focus:ring-2 focus:ring-brand-500"
          >
            Reset board
          </button>
        </div>
      </div>

      <Card className="p-5">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <BoltIcon className="w-5 h-5 text-brand-500" />
            <h2 className="text-sm font-semibold text-gray-900 dark:text-gray-100">Automation rules</h2>
          </div>
          <span className="text-xs text-gray-400">{board.automationRules.length} active · server-side, applied on every webhook</span>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-1.5 text-sm">
          {board.automationRules.map((rule) => (
            <div key={rule.event} className="flex items-center gap-2 text-gray-600 dark:text-gray-400">
              <code className="rounded bg-gray-100 dark:bg-gray-800 px-1.5 py-0.5 text-xs text-gray-700 dark:text-gray-300">{rule.event}</code>
              <span>→ {rule.description}</span>
            </div>
          ))}
        </div>
      </Card>

      <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
        {board.columns.map((col) => (
          <div
            key={col.name}
            onDragOver={(e) => e.preventDefault()}
            onDrop={() => handleDrop(col.name)}
            className="rounded-2xl border border-gray-100 dark:border-gray-800 bg-gray-50/50 dark:bg-gray-900/50 p-3 min-h-[200px]"
          >
            <div className="flex items-center gap-2 mb-3 px-1">
              <span className={`h-2 w-2 rounded-full ${COLUMN_DOT[col.name]}`} />
              <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100">{col.name}</h3>
              <span className="ml-auto text-xs text-gray-400">{col.tickets.length}</span>
            </div>
            <div className="space-y-3">
              {col.tickets.map((ticket) => (
                <TicketCard key={ticket.id} ticket={ticket} onDragStart={(e, id) => setDragTicket(id)} onOpen={setOpenTicket} />
              ))}
            </div>
          </div>
        ))}
      </div>

      <Card className="p-6">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-semibold text-gray-900 dark:text-gray-100">Automation activity</h2>
          <span className="text-xs text-gray-400">{board.activity.length} recent firings</span>
        </div>
        {board.activity.length === 0 ? (
          <p className="text-sm text-gray-400">No automation events yet — try one of the simulate buttons above.</p>
        ) : (
          <ul className="space-y-3">
            {board.activity.map((a, i) => (
              <li key={i} className="text-sm">
                <p className="text-gray-900 dark:text-gray-100">
                  <span className="font-medium">{a.ticketId}</span> {a.from} → <span className="font-medium">{a.to}</span> ·{' '}
                  <span className="text-gray-500 dark:text-gray-400">{a.event}</span>
                </p>
                {a.branch && <p className="text-xs text-gray-400">branch {a.branch} · by {a.actor} · {formatRelativeTime(a.at)}</p>}
              </li>
            ))}
          </ul>
        )}
      </Card>

      {openTicket && <TicketDrawer ticket={openTicket} onClose={() => setOpenTicket(null)} />}
    </div>
  )
}
