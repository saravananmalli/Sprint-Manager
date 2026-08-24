import { Area, CartesianGrid, Line, ComposedChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import Card from '../common/Card'

const BAND_PCT = 0.15

function buildBurndownData(sprint) {
  const { totalCommitted, pointsDone, daysElapsed, daysRemaining } = sprint
  const totalDays = Math.max(daysElapsed + daysRemaining, 1)
  const dailyBurn = daysElapsed > 0 ? pointsDone / daysElapsed : 0

  return Array.from({ length: totalDays + 1 }, (_, day) => {
    const ideal = Math.max(totalCommitted - (totalCommitted / totalDays) * day, 0)
    const actual = day <= daysElapsed ? Math.max(totalCommitted - dailyBurn * day, 0) : null
    const bandLow = Math.max(ideal * (1 - BAND_PCT), 0)
    const bandHigh = ideal * (1 + BAND_PCT)
    return {
      day,
      ideal: Math.round(ideal * 10) / 10,
      actual: actual !== null ? Math.round(actual * 10) / 10 : null,
      band: [Math.round(bandLow * 10) / 10, Math.round(bandHigh * 10) / 10],
    }
  })
}

function niceYTicks(max) {
  const step = max / 4
  return Array.from({ length: 5 }, (_, i) => Math.round(step * i))
}

export default function BurndownChart({ sprint }) {
  const data = buildBurndownData(sprint)
  const totalDays = sprint.daysElapsed + sprint.daysRemaining
  const yTicks = niceYTicks(sprint.totalCommitted)

  return (
    <Card className="p-6">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100">Sprint burndown</h3>
        <span className="flex items-center gap-1.5 text-xs text-gray-400">
          Day {sprint.daysElapsed} of {totalDays} ·
          <span className="inline-block h-2.5 w-2.5 rounded-sm bg-indigo-200 dark:bg-indigo-500/40" />
          ±{BAND_PCT * 100}% deviation band
        </span>
      </div>
      <div
        role="img"
        aria-label={`Burndown chart showing ${sprint.pointsDone} of ${sprint.totalCommitted} points completed, trending toward ${sprint.sprintStatus}`}
      >
        <ResponsiveContainer width="100%" height={320}>
          <ComposedChart data={data} margin={{ top: 8, right: 16, left: 0, bottom: 8 }}>
            <CartesianGrid strokeDasharray="3 3" className="stroke-gray-100 dark:stroke-gray-800" />
            <XAxis dataKey="day" tick={{ fontSize: 12 }} tickLine={false} />
            <YAxis ticks={yTicks} tick={{ fontSize: 12 }} tickLine={false} axisLine={false} />
            <Tooltip labelFormatter={(day) => `Day ${day}`} />
            <Area dataKey="band" name="±15% band" fill="#c7d2fe" fillOpacity={0.35} stroke="none" />
            <Line type="monotone" dataKey="ideal" name="Ideal" stroke="#9ca3af" strokeDasharray="6 4" dot={false} />
            <Line
              type="monotone"
              dataKey="actual"
              name="Actual"
              stroke="#4f46e5"
              strokeWidth={2.5}
              dot={{ r: 4, fill: '#4f46e5', strokeWidth: 0 }}
              activeDot={{ r: 5 }}
              connectNulls={false}
            />
          </ComposedChart>
        </ResponsiveContainer>
      </div>
    </Card>
  )
}
