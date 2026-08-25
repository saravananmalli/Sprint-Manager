import { memo } from 'react'
import { CheckCircleIcon, ClockIcon, LockClosedIcon, SparklesIcon } from '@heroicons/react/24/solid'
import Card from '../common/Card'

const ICON = {
  sync: { Icon: SparklesIcon, wrap: 'bg-brand-100 text-brand-600 dark:bg-brand-500/20 dark:text-brand-400' },
  closed: { Icon: CheckCircleIcon, wrap: 'bg-emerald-100 text-emerald-600 dark:bg-emerald-500/20 dark:text-emerald-400' },
  blocked: { Icon: LockClosedIcon, wrap: 'bg-red-100 text-red-600 dark:bg-red-500/20 dark:text-red-400' },
  stale: { Icon: ClockIcon, wrap: 'bg-amber-100 text-amber-600 dark:bg-amber-500/20 dark:text-amber-400' },
}

function formatDate(iso) {
  return new Date(iso).toLocaleDateString('en-US')
}

function eventFor(ticket) {
  if (ticket.status === 'Done') {
    return { type: 'closed', title: `${ticket.id} closed`, sub: formatDate(ticket.lastUpdated), date: ticket.lastUpdated }
  }
  if (ticket.riskTags?.includes('BLOCKED') && ticket.blockers?.length) {
    return { type: 'blocked', title: `${ticket.id} blocked`, sub: ticket.blockers[0], date: ticket.lastUpdated }
  }
  if (ticket.riskTags?.includes('STALE')) {
    return { type: 'stale', title: `${ticket.id} hasn't moved`, sub: `Updated ${formatDate(ticket.lastUpdated)}`, date: ticket.lastUpdated }
  }
  return null
}

function ActivityPanel({ tickets = [] }) {
  const events = tickets
    .map(eventFor)
    .filter(Boolean)
    .sort((a, b) => new Date(b.date) - new Date(a.date))
    .slice(0, 8)

  const all = [{ type: 'sync', title: 'Dashboard synced', sub: 'just now', date: null }, ...events]

  return (
    <Card className="p-6">
      <div className="flex items-center justify-between mb-1">
        <h2 className="text-lg font-medium text-gray-900 dark:text-gray-100">Activity</h2>
        <span className="text-xs text-gray-400">{events.length} events</span>
      </div>
      <ul className="mt-3 space-y-3">
        {all.map((e, i) => {
          const { Icon, wrap } = ICON[e.type]
          return (
            <li key={i} className="flex items-start gap-3">
              <span className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full ${wrap}`}>
                <Icon className="w-3.5 h-3.5" />
              </span>
              <span className="min-w-0">
                <span className="block text-sm font-medium text-gray-900 dark:text-gray-100 truncate">{e.title}</span>
                {e.sub && <span className="block text-xs text-gray-400 truncate">{e.sub}</span>}
              </span>
            </li>
          )
        })}
      </ul>
    </Card>
  )
}

export default memo(ActivityPanel)
