import { memo } from 'react'
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import Card from '../common/Card'

function formatDate(iso) {
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

function HealthTrendPanel({ history }) {
  return (
    <Card className="p-6">
      <div className="flex items-center justify-between mb-1">
        <h2 className="text-lg font-medium text-gray-900 dark:text-gray-100">Health trend</h2>
        <span className="text-xs text-gray-400">{history.length}d</span>
      </div>
      {history.length < 2 ? (
        <p className="text-sm text-gray-500 dark:text-gray-400 mt-3">Run the agent on multiple days.</p>
      ) : (
        <div className="mt-3" role="img" aria-label={`Health score trend over ${history.length} days`}>
          <ResponsiveContainer width="100%" height={200}>
            <AreaChart data={history} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
              <defs>
                <linearGradient id="healthTrendFill" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#4f46e5" stopOpacity={0.35} />
                  <stop offset="95%" stopColor="#4f46e5" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid vertical={false} strokeDasharray="3 3" className="stroke-gray-100 dark:stroke-gray-800" />
              <XAxis
                dataKey="date"
                tickFormatter={formatDate}
                tick={{ fontSize: 12 }}
                tickLine={false}
                axisLine={false}
                minTickGap={40}
              />
              <YAxis domain={[0, 100]} ticks={[0, 25, 50, 75, 100]} tick={{ fontSize: 12 }} tickLine={false} axisLine={false} width={28} />
              <Tooltip labelFormatter={formatDate} />
              <Area type="monotone" dataKey="score" stroke="#4f46e5" strokeWidth={2.5} fill="url(#healthTrendFill)" />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      )}
    </Card>
  )
}

export default memo(HealthTrendPanel)
