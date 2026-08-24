import { ChevronDownIcon, ChevronUpDownIcon, ChevronUpIcon } from '@heroicons/react/24/outline'
import { useMemo, useState } from 'react'
import { avatarGradient } from '../../utils/avatarColor'
import { formatShortDate, initials, truncate } from '../../utils/formatters'
import { PRIORITY_CLASSES, STATUS_CLASSES } from '../../utils/riskColors'
import RiskBadge from './RiskBadge'

const PRIORITY_ORDER = { P0: 0, P1: 1, P2: 2, P3: 3 }

const COLUMNS = [
  { key: 'id', label: 'Ticket', sort: (t) => t.id },
  { key: 'status', label: 'Status', sort: (t) => t.status },
  { key: 'priority', label: 'Pri', sort: (t) => PRIORITY_ORDER[t.priority] ?? 99 },
  { key: 'owner', label: 'Owner', sort: (t) => t.assignee?.name ?? '' },
  { key: 'pts', label: 'Pts', sort: (t) => t.storyPoints ?? 0, align: 'right' },
  { key: 'updated', label: 'Updated', sort: (t) => t.lastUpdated ?? '' },
]

const GROUP_LABELS = {
  status: (t) => t.status,
  owner: (t) => t.assignee?.name || 'Unassigned',
  priority: (t) => (t.priority ? `${t.priority} · ${t.priorityLabel}` : 'No priority'),
}

function SortHeader({ column, sortKey, sortDir, onSort }) {
  const active = sortKey === column.key
  const Icon = active ? (sortDir === 'asc' ? ChevronUpIcon : ChevronDownIcon) : ChevronUpDownIcon
  return (
    <th scope="col" className={`px-3 py-3 ${column.align === 'right' ? 'text-right' : 'text-left'}`}>
      <button
        type="button"
        onClick={() => onSort(column.key)}
        className={`inline-flex items-center gap-1 hover:text-gray-700 dark:hover:text-gray-200 ${active ? 'text-gray-700 dark:text-gray-200' : ''}`}
      >
        {column.label}
        <Icon className="w-3.5 h-3.5" />
      </button>
    </th>
  )
}

function TicketRow({ ticket }) {
  return (
    <tr className="border-b border-gray-100 dark:border-gray-800 transition-colors hover:bg-gray-50 dark:hover:bg-gray-800/60">
      <td className="px-3 py-3 align-top">
        <p className="font-mono text-sm font-semibold text-gray-900 dark:text-gray-100 whitespace-nowrap">{ticket.id}</p>
        <p className="text-xs text-gray-500 dark:text-gray-400 max-w-[260px]" title={ticket.summary}>
          {truncate(ticket.summary, 60)}
        </p>
      </td>
      <td className="px-3 py-3 align-top">
        <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_CLASSES[ticket.status] ?? 'bg-gray-100 text-gray-700'}`}>
          {ticket.status}
        </span>
      </td>
      <td className="px-3 py-3 align-top">
        {ticket.priority && (
          <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ${PRIORITY_CLASSES[ticket.priority] ?? 'bg-gray-100 text-gray-700'}`}>
            <span className="h-1 w-1 rounded-full bg-current" />
            {ticket.priority} · {ticket.priorityLabel}
          </span>
        )}
      </td>
      <td className="px-3 py-3 align-top text-sm text-gray-700 dark:text-gray-300">
        <span className="inline-flex items-center gap-2">
          <span className={`flex h-7 w-7 items-center justify-center rounded-full ${avatarGradient(ticket.assignee?.email)} text-xs font-semibold text-white`}>
            {ticket.assignee?.name ? initials(ticket.assignee.name) : '?'}
          </span>
          {ticket.assignee?.name || 'Unassigned'}
        </span>
      </td>
      <td className="px-3 py-3 align-top text-right text-sm text-gray-700 dark:text-gray-300">{ticket.storyPoints}</td>
      <td className="px-3 py-3 align-top text-sm text-gray-500 dark:text-gray-400" title={ticket.lastUpdated}>
        {formatShortDate(ticket.lastUpdated)}
      </td>
      <td className="px-3 py-3 align-top">
        <div className="flex flex-wrap gap-1">
          {ticket.riskTags?.length ? ticket.riskTags.map((tag) => <RiskBadge key={tag} tag={tag} />) : <span className="text-gray-300 dark:text-gray-600">—</span>}
        </div>
      </td>
    </tr>
  )
}

export default function TicketTable({ tickets, groupBy = 'none' }) {
  const [sortKey, setSortKey] = useState('updated')
  const [sortDir, setSortDir] = useState('desc')

  const sortColumn = COLUMNS.find((c) => c.key === sortKey)

  const sorted = useMemo(() => {
    if (!sortColumn) return tickets
    const dir = sortDir === 'asc' ? 1 : -1
    return [...tickets].sort((a, b) => {
      const av = sortColumn.sort(a)
      const bv = sortColumn.sort(b)
      if (av < bv) return -1 * dir
      if (av > bv) return 1 * dir
      return 0
    })
  }, [tickets, sortColumn, sortDir])

  const handleSort = (key) => {
    if (key === sortKey) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'))
    } else {
      setSortKey(key)
      setSortDir('asc')
    }
  }

  if (tickets.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center rounded-2xl border border-gray-100 dark:border-gray-800 bg-white dark:bg-gray-900 p-16 text-center">
        <p className="text-gray-500 dark:text-gray-400">No tickets match your filters.</p>
      </div>
    )
  }

  const groups =
    groupBy === 'none'
      ? [[null, sorted]]
      : Object.entries(
          sorted.reduce((acc, t) => {
            const label = GROUP_LABELS[groupBy](t)
            acc[label] = acc[label] || []
            acc[label].push(t)
            return acc
          }, {})
        )

  return (
    <div className="overflow-x-auto rounded-2xl border border-gray-100 dark:border-gray-800 bg-white dark:bg-gray-900">
      <table className="w-full min-w-[760px] border-collapse">
        <caption className="sr-only">Sprint ticket list with assignee, status, and risk tags</caption>
        <thead>
          <tr className="border-b border-gray-100 dark:border-gray-800 text-left text-xs font-semibold text-gray-500 dark:text-gray-400">
            {COLUMNS.map((column) => (
              <SortHeader key={column.key} column={column} sortKey={sortKey} sortDir={sortDir} onSort={handleSort} />
            ))}
            <th scope="col" className="px-3 py-3 text-left uppercase tracking-wide">
              Risk
            </th>
          </tr>
        </thead>
        {groups.map(([label, groupTickets]) => (
          <tbody key={label ?? 'all'}>
            {label && (
              <tr className="border-b border-gray-100 dark:border-gray-800 bg-gray-50/70 dark:bg-gray-800/40">
                <td colSpan={COLUMNS.length + 1} className="px-3 py-1.5 text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
                  {label} <span className="font-normal normal-case text-gray-400">· {groupTickets.length}</span>
                </td>
              </tr>
            )}
            {groupTickets.map((ticket) => (
              <TicketRow key={ticket.id} ticket={ticket} />
            ))}
          </tbody>
        ))}
      </table>
    </div>
  )
}
