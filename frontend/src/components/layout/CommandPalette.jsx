import { ArrowRightIcon, FolderIcon, MagnifyingGlassIcon } from '@heroicons/react/24/outline'
import clsx from 'clsx'
import { useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { useNavigate } from 'react-router-dom'
import client from '../../api/client'
import { useProjects } from '../../hooks/useProjects'
import { STATUS_CLASSES } from '../../utils/riskColors'
import { NAV_ITEMS } from '../../utils/navItems'

export default function CommandPalette({ onClose }) {
  const [query, setQuery] = useState('')
  const [selected, setSelected] = useState(0)
  const [tickets, setTickets] = useState([])
  const inputRef = useRef(null)
  const navigate = useNavigate()
  const { projects, projectId, currentProject, setProjectId } = useProjects()

  useEffect(() => {
    inputRef.current?.focus()
    const onKey = (e) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  useEffect(() => {
    if (!projectId) return
    client.get(`/api/projects/${projectId}/sprint`).then(({ data }) => setTickets(data.tickets))
  }, [projectId])

  const sections = useMemo(() => {
    const needle = query.trim().toLowerCase()

    const navigation = NAV_ITEMS.filter((n) => n.label.toLowerCase().includes(needle)).map((n) => ({
      kind: 'nav',
      key: `nav-${n.to}`,
      icon: n.icon,
      label: n.label,
      keys: ['G', n.key.toUpperCase()],
      action: () => navigate(n.to),
    }))

    const switchProject = projects
      .filter((p) => p.id !== currentProject?.id && p.name.toLowerCase().includes(needle))
      .map((p) => ({
        kind: 'project',
        key: `project-${p.id}`,
        icon: FolderIcon,
        label: `Switch to ${p.name}`,
        meta: `#${p.teamSlug}`,
        action: () => setProjectId(p.id),
      }))

    const ticketMatches = needle
      ? tickets
          .filter((t) => t.id.toLowerCase().includes(needle) || t.summary.toLowerCase().includes(needle))
          .slice(0, 8)
          .map((t) => ({
            kind: 'ticket',
            key: `ticket-${t.id}`,
            ticket: t,
            action: () => navigate('/analytics'),
          }))
      : []

    return { navigation, switchProject, ticketMatches }
  }, [query, projects, currentProject, tickets, navigate, setProjectId])

  const flat = [...sections.navigation, ...sections.switchProject, ...sections.ticketMatches]

  useEffect(() => setSelected(0), [query])

  const runResult = (result) => {
    result.action()
    onClose()
  }

  const onInputKeyDown = (e) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setSelected((s) => Math.min(s + 1, flat.length - 1))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setSelected((s) => Math.max(s - 1, 0))
    } else if (e.key === 'Enter' && flat[selected]) {
      runResult(flat[selected])
    }
  }

  let rowIndex = -1

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-24 bg-gray-900/50 backdrop-blur-sm" onClick={onClose}>
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Command palette"
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-xl rounded-2xl bg-white dark:bg-gray-900 shadow-lg border border-gray-100 dark:border-gray-800 overflow-hidden"
      >
        <div className="flex items-center gap-2 border-b border-gray-100 dark:border-gray-800 px-4 py-3">
          <MagnifyingGlassIcon className="w-5 h-5 text-gray-400" />
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={onInputKeyDown}
            placeholder="Type a command, search tickets, or navigate…"
            className="flex-1 bg-transparent text-sm text-gray-900 dark:text-gray-100 focus:outline-none"
          />
          <kbd className="rounded bg-gray-100 dark:bg-gray-800 px-1.5 py-0.5 text-xs text-gray-500 dark:text-gray-400">Esc</kbd>
        </div>

        <div className="max-h-96 overflow-y-auto py-2">
          {flat.length === 0 && <p className="px-4 py-6 text-center text-sm text-gray-400">No matches</p>}

          {sections.navigation.length > 0 && (
            <div className="mb-1">
              <p className="px-4 pb-1 text-[10px] font-semibold uppercase tracking-wide text-gray-400">Navigation</p>
              {sections.navigation.map((r) => {
                rowIndex += 1
                const isSelected = rowIndex === selected
                return (
                  <button
                    key={r.key}
                    type="button"
                    onClick={() => runResult(r)}
                    onMouseEnter={() => setSelected(rowIndex)}
                    className={clsx(
                      'flex w-full items-center justify-between px-4 py-2 text-sm',
                      isSelected ? 'bg-gray-50 dark:bg-gray-800' : 'hover:bg-gray-50 dark:hover:bg-gray-800'
                    )}
                  >
                    <span className="flex items-center gap-2.5 text-gray-700 dark:text-gray-200">
                      <r.icon className="w-4 h-4 text-gray-400" />
                      {r.label}
                    </span>
                    <span className="flex gap-1">
                      {r.keys.map((k) => (
                        <kbd key={k} className="rounded bg-gray-100 dark:bg-gray-800 px-1.5 py-0.5 text-[10px] text-gray-500 dark:text-gray-400">
                          {k}
                        </kbd>
                      ))}
                    </span>
                  </button>
                )
              })}
            </div>
          )}

          {sections.switchProject.length > 0 && (
            <div className="mb-1">
              <p className="px-4 pb-1 text-[10px] font-semibold uppercase tracking-wide text-gray-400">Switch project</p>
              {sections.switchProject.map((r) => {
                rowIndex += 1
                const isSelected = rowIndex === selected
                return (
                  <button
                    key={r.key}
                    type="button"
                    onClick={() => runResult(r)}
                    onMouseEnter={() => setSelected(rowIndex)}
                    className={clsx(
                      'flex w-full items-center justify-between px-4 py-2 text-sm',
                      isSelected ? 'bg-brand-50 dark:bg-brand-500/10 text-brand-700 dark:text-brand-400' : 'text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-800'
                    )}
                  >
                    <span className="flex items-center gap-2.5 min-w-0">
                      <r.icon className="w-4 h-4 text-gray-400 shrink-0" />
                      <span className="truncate">{r.label}</span>
                    </span>
                    <span className="flex items-center gap-2 shrink-0 text-xs text-gray-400">
                      {r.meta}
                      {isSelected && <ArrowRightIcon className="w-3.5 h-3.5" />}
                    </span>
                  </button>
                )
              })}
            </div>
          )}

          {sections.ticketMatches.length > 0 && (
            <div>
              <p className="px-4 pb-1 text-[10px] font-semibold uppercase tracking-wide text-gray-400">Tickets</p>
              {sections.ticketMatches.map((r) => {
                rowIndex += 1
                const isSelected = rowIndex === selected
                return (
                  <button
                    key={r.key}
                    type="button"
                    onClick={() => runResult(r)}
                    onMouseEnter={() => setSelected(rowIndex)}
                    className={clsx(
                      'flex w-full items-center gap-2.5 px-4 py-2 text-sm',
                      isSelected ? 'bg-gray-50 dark:bg-gray-800' : 'hover:bg-gray-50 dark:hover:bg-gray-800'
                    )}
                  >
                    <span className="font-mono text-xs font-semibold text-gray-500 dark:text-gray-400 shrink-0">{r.ticket.id}</span>
                    <span className="flex-1 truncate text-left text-gray-700 dark:text-gray-200">{r.ticket.summary}</span>
                    <span className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-medium ${STATUS_CLASSES[r.ticket.status] ?? ''}`}>
                      {r.ticket.status}
                    </span>
                  </button>
                )
              })}
            </div>
          )}
        </div>

        <div className="flex items-center justify-between border-t border-gray-100 dark:border-gray-800 px-4 py-2 text-xs text-gray-400">
          <span className="flex items-center gap-3">
            <span className="flex items-center gap-1">
              <kbd className="rounded bg-gray-100 dark:bg-gray-800 px-1.5 py-0.5">↑</kbd>
              <kbd className="rounded bg-gray-100 dark:bg-gray-800 px-1.5 py-0.5">↓</kbd>
              navigate
            </span>
            <span className="flex items-center gap-1">
              <kbd className="rounded bg-gray-100 dark:bg-gray-800 px-1.5 py-0.5">⏎</kbd>
              select
            </span>
          </span>
          <span>{flat.length} results</span>
        </div>
      </div>
    </div>,
    document.body
  )
}
