import { memo } from 'react'
import { ArrowTrendingDownIcon, ArrowTrendingUpIcon, MinusIcon } from '@heroicons/react/24/solid'
import Card from '../common/Card'
import { healthScoreClasses } from '../../utils/riskColors'

const TREND_ICON = { Improving: ArrowTrendingUpIcon, Stable: MinusIcon, Declining: ArrowTrendingDownIcon }

const RADIUS = 70
const STROKE = 14
const CIRCUMFERENCE = 2 * Math.PI * RADIUS

const ROWS = [
  { key: 'velocityScore', label: 'Velocity' },
  { key: 'blockerScore', label: 'Blockers' },
  { key: 'stalenessScore', label: 'Staleness' },
  { key: 'completionScore', label: 'Completion' },
]

function SprintHealthPanel({ score, trend, components }) {
  const TrendIcon = TREND_ICON[trend] ?? MinusIcon
  const { stroke, text } = healthScoreClasses(score)
  const pct = score ?? 0
  const offset = CIRCUMFERENCE - (pct / 100) * CIRCUMFERENCE

  return (
    <Card className="p-6">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-medium text-gray-900 dark:text-gray-100">Sprint Health</h2>
        <div className="inline-flex items-center gap-1.5 text-sm text-gray-500 dark:text-gray-400">
          <TrendIcon className="w-4 h-4" />
          {trend}
        </div>
      </div>
      <div className="flex flex-col sm:flex-row items-center gap-8">
        <div className="relative w-40 h-40 shrink-0">
          <svg viewBox="0 0 160 160" className="w-full h-full -rotate-90">
            <circle cx="80" cy="80" r={RADIUS} strokeWidth={STROKE} className="stroke-gray-100 dark:stroke-gray-800" fill="none" />
            <circle
              cx="80"
              cy="80"
              r={RADIUS}
              strokeWidth={STROKE}
              strokeLinecap="round"
              fill="none"
              className={`${stroke} transition-all duration-150`}
              strokeDasharray={CIRCUMFERENCE}
              strokeDashoffset={offset}
            />
          </svg>
          <div className={`absolute inset-0 flex flex-col items-center justify-center ${text}`}>
            <span className="text-4xl font-bold">{score ?? '—'}</span>
            <span className="text-xs text-gray-500 dark:text-gray-400">out of 100</span>
          </div>
        </div>
        <div className="flex-1 w-full space-y-3">
          {ROWS.map(({ key, label }) => {
            const value = components?.[key] ?? null
            return (
              <div key={key}>
                <div className="flex items-center justify-between text-sm mb-1">
                  <span className="text-gray-600 dark:text-gray-400">{label}</span>
                  <span className="font-medium text-gray-900 dark:text-gray-100">{value ?? '—'}</span>
                </div>
                <div className="h-1.5 w-full rounded-full bg-gray-100 dark:bg-gray-800 overflow-hidden">
                  <div className="h-full rounded-full bg-brand-500 transition-all duration-150" style={{ width: `${value ?? 0}%` }} />
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </Card>
  )
}

export default memo(SprintHealthPanel)
