import { memo } from 'react'
import { ChartBarIcon, CheckCircleIcon as CheckOutline, ClipboardDocumentCheckIcon, ExclamationTriangleIcon } from '@heroicons/react/24/outline'
import StatTile from '../common/StatTile'

function MetricsSummary({ sprint, onSelect }) {
  const { tickets, pointsDone, totalCommitted, velocity, projectedCompletion } = sprint
  const done = tickets.filter((t) => t.status === 'Done')
  const stale = tickets.filter((t) => t.riskTags?.includes('STALE')).length
  const blocked = tickets.filter((t) => t.riskTags?.includes('BLOCKED')).length
  const atRisk = tickets.filter((t) => t.riskTags?.length > 0).length
  const completePct = totalCommitted ? Math.round((pointsDone / totalCommitted) * 100) : 0

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
      <StatTile
        label="Story points"
        icon={ClipboardDocumentCheckIcon}
        value={pointsDone}
        suffix={`/ ${totalCommitted}`}
        sublabel={`${completePct}% complete`}
        sublabelClass={completePct >= 90 ? 'text-emerald-600 dark:text-emerald-400' : 'text-amber-600 dark:text-amber-400'}
        iconBg="bg-brand-50 dark:bg-brand-500/10"
        iconClass="text-brand-600 dark:text-brand-400"
        onClick={onSelect && (() => onSelect('storyPoints'))}
      />
      <StatTile
        label="Tickets done"
        icon={CheckOutline}
        value={done.length}
        suffix={`/ ${tickets.length}`}
        sublabel="closed this sprint"
        sublabelClass="text-emerald-600 dark:text-emerald-400"
        iconBg="bg-emerald-50 dark:bg-emerald-500/10"
        iconClass="text-emerald-600 dark:text-emerald-400"
        onClick={onSelect && (() => onSelect('ticketsDone'))}
      />
      <StatTile
        label="At risk"
        icon={ExclamationTriangleIcon}
        value={atRisk}
        sublabel={`${blocked} blocked · ${stale} stale`}
        iconBg={atRisk > 0 ? 'bg-amber-50 dark:bg-amber-500/10' : 'bg-gray-100 dark:bg-gray-800'}
        iconClass={atRisk > 0 ? 'text-amber-600 dark:text-amber-400' : 'text-gray-400 dark:text-gray-500'}
        onClick={onSelect && (() => onSelect('atRisk'))}
      />
      <StatTile
        label="Velocity"
        icon={ChartBarIcon}
        value={velocity}
        suffix="%"
        sublabel={`projected ${projectedCompletion} pts`}
        sublabelClass={projectedCompletion >= totalCommitted * 0.9 ? 'text-emerald-600 dark:text-emerald-400' : 'text-amber-600 dark:text-amber-400'}
        iconBg="bg-amber-50 dark:bg-amber-500/10"
        iconClass="text-amber-600 dark:text-amber-400"
        onClick={onSelect && (() => onSelect('velocity'))}
      />
    </div>
  )
}

export default memo(MetricsSummary)
