import { memo } from 'react'
import { ArrowUpRightIcon, Square2StackIcon, UserGroupIcon } from '@heroicons/react/24/outline'
import { Link } from 'react-router-dom'
import Card from '../common/Card'
import { avatarGradient } from '../../utils/avatarColor'
import { initials } from '../../utils/formatters'
import { RISK_LEVEL_CLASSES } from '../../utils/riskColors'

const RISK_RANK = { HIGH: 0, MEDIUM: 1, LOW: 2 }

function TeamWorkloadPanel({ members, projectName }) {
  const top = [...members]
    .sort((a, b) => RISK_RANK[a.riskLevel] - RISK_RANK[b.riskLevel] || b.ticketsTotal - a.ticketsTotal)
    .slice(0, 5)

  return (
    <Card className="p-6">
      <div className="flex items-center justify-between mb-1">
        <div className="flex items-center gap-2">
          <UserGroupIcon className="w-5 h-5 text-gray-400" />
          <h2 className="text-lg font-medium text-gray-900 dark:text-gray-100">Team workload</h2>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-xs text-gray-400">{members.length} on this project</span>
          <Link
            to="/team"
            className="inline-flex items-center gap-0.5 text-xs font-medium text-brand-600 dark:text-brand-400 hover:underline"
          >
            View all
            <ArrowUpRightIcon className="w-3 h-3" />
          </Link>
        </div>
      </div>
      {top.length === 0 ? (
        <p className="text-sm text-gray-500 dark:text-gray-400 mt-3">Run the agent to compute per-assignee velocity and risk levels.</p>
      ) : (
        <ul className="mt-3 space-y-3">
          {top.map((m) => (
            <li key={m.email} className="text-sm">
              <div className="flex items-center justify-between gap-2">
                <span className="flex items-center gap-2 min-w-0">
                  <span className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full ${avatarGradient(m.email)} text-[10px] font-semibold text-white`}>
                    {initials(m.name)}
                  </span>
                  <span className="text-gray-700 dark:text-gray-200 truncate">{m.name}</span>
                  {m.projects?.length > 1 && (
                    <span
                      title={m.projects.join(', ')}
                      className="inline-flex items-center gap-0.5 rounded-full bg-gray-100 dark:bg-gray-800 px-1.5 py-0.5 text-[10px] text-gray-500 dark:text-gray-400"
                    >
                      <Square2StackIcon className="w-3 h-3" />+{m.projects.length - 1}
                    </span>
                  )}
                </span>
                <span className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold ${RISK_LEVEL_CLASSES[m.riskLevel]}`}>
                  {m.riskLevel}
                </span>
              </div>
              <p className="mt-1 pl-9 text-xs text-gray-400">
                {m.pointsDone}/{m.pointsTotal} pts · {m.velocity}% velocity
                {m.staleCount > 0 && ` · ${m.staleCount} stale`}
              </p>
              <div className="mt-1.5 ml-9 h-1.5 rounded-full bg-gray-100 dark:bg-gray-800 overflow-hidden">
                <div className="h-full rounded-full bg-amber-500" style={{ width: `${Math.min(m.velocity, 100)}%` }} />
              </div>
            </li>
          ))}
        </ul>
      )}
      <p className="mt-3 text-xs text-gray-400">
        Numbers reflect {projectName}&apos;s sprint only.{' '}
        <Link to="/team" className="text-brand-600 dark:text-brand-400 hover:underline">
          See full per-person breakdown →
        </Link>
      </p>
    </Card>
  )
}

export default memo(TeamWorkloadPanel)
