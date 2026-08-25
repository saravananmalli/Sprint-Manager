import { memo } from 'react'
import { ArrowUpRightIcon, ExclamationTriangleIcon } from '@heroicons/react/24/outline'
import { Link } from 'react-router-dom'
import Card from '../common/Card'
import RiskBadge from '../tickets/RiskBadge'
import { avatarGradient } from '../../utils/avatarColor'
import { initials } from '../../utils/formatters'

function topRiskyTickets(tickets, limit = 5) {
  return [...tickets]
    .filter((t) => t.riskTags?.length > 0)
    .sort((a, b) => b.riskTags.length - a.riskTags.length || new Date(a.lastUpdated) - new Date(b.lastUpdated))
    .slice(0, limit)
}

function RiskTicketsPanel({ tickets = [] }) {
  const risky = topRiskyTickets(tickets)

  return (
    <Card className="p-6">
      <div className="flex items-center justify-between mb-1">
        <div className="flex items-center gap-2">
          <ExclamationTriangleIcon className="w-5 h-5 text-gray-400" />
          <h2 className="text-lg font-medium text-gray-900 dark:text-gray-100">Top at-risk tickets</h2>
        </div>
        <Link
          to="/kanban"
          className="inline-flex items-center gap-0.5 text-xs font-medium text-brand-600 dark:text-brand-400 hover:underline"
        >
          View board
          <ArrowUpRightIcon className="w-3 h-3" />
        </Link>
      </div>
      {risky.length === 0 ? (
        <p className="text-sm text-gray-500 dark:text-gray-400 mt-3">Nothing at risk right now — every ticket is on track.</p>
      ) : (
        <ul className="mt-3 divide-y divide-gray-100 dark:divide-gray-800">
          {risky.map((t) => (
            <li key={t.id} className="flex items-center justify-between gap-3 py-3 first:pt-0 last:pb-0">
              <span className="flex items-center gap-3 min-w-0">
                <span
                  className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full ${avatarGradient(t.assignee?.email)} text-[10px] font-semibold text-white`}
                >
                  {t.assignee?.name ? initials(t.assignee.name) : '?'}
                </span>
                <span className="min-w-0">
                  <span className="flex items-center gap-1.5">
                    <span className="text-sm font-semibold text-gray-900 dark:text-gray-100">{t.id}</span>
                    <span className="text-xs text-gray-400">{t.storyPoints} pts</span>
                  </span>
                  <span className="block text-sm text-gray-500 dark:text-gray-400 truncate">{t.summary}</span>
                </span>
              </span>
              <span className="flex shrink-0 flex-wrap justify-end gap-1">
                {t.riskTags.map((tag) => (
                  <RiskBadge key={tag} tag={tag} />
                ))}
              </span>
            </li>
          ))}
        </ul>
      )}
    </Card>
  )
}

export default memo(RiskTicketsPanel)
