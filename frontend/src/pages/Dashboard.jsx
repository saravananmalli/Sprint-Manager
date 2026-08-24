import { useEffect, useState } from 'react'
import client from '../api/client'
import ActivityPanel from '../components/dashboard/ActivityPanel'
import BurndownChart from '../components/dashboard/BurndownChart'
import HealthTrendPanel from '../components/dashboard/HealthTrendPanel'
import KPIDrilldownModal from '../components/dashboard/KPIDrilldownModal'
import MetricsSummary from '../components/dashboard/MetricsSummary'
import RiskTicketsPanel from '../components/dashboard/RiskTicketsPanel'
import SprintHealthPanel from '../components/dashboard/SprintHealthPanel'
import TeamWorkloadPanel from '../components/dashboard/TeamWorkloadPanel'
import Skeleton from '../components/common/Skeleton'
import { useAgentRun } from '../hooks/useAgentRun'
import { useProjects } from '../hooks/useProjects'
import { useSprint } from '../hooks/useSprint'
import { projectDot, projectIconBg } from '../utils/projectColor'
import { SPRINT_STATUS_CLASSES } from '../utils/riskColors'

export default function Dashboard() {
  const { sprint, health, loading, error, refetch } = useSprint()
  const { projectId, currentProject } = useProjects()
  const { runVersion } = useAgentRun()
  const [members, setMembers] = useState([])
  const [drilldownKpi, setDrilldownKpi] = useState(null)

  useEffect(() => {
    if (!projectId) return
    client.get('/api/team', { params: { project: projectId } }).then(({ data }) => setMembers(data.members))
  }, [projectId, runVersion])

  if (error) {
    return (
      <div className="rounded-2xl border border-red-100 dark:border-red-900/40 bg-red-50 dark:bg-red-900/20 p-8 text-center">
        <p className="text-red-700 dark:text-red-300 mb-4">{error.message || 'Failed to load dashboard'}</p>
        <button
          type="button"
          onClick={refetch}
          className="rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-brand-500 focus:ring-offset-2"
        >
          Retry
        </button>
      </div>
    )
  }

  if (loading || !sprint || !health) {
    return (
      <div className="space-y-6">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-32" />
          ))}
        </div>
        <Skeleton className="h-64" />
        <Skeleton className="h-80" />
      </div>
    )
  }

  const statusClass = SPRINT_STATUS_CLASSES[sprint.sprintStatus] ?? 'bg-gray-100 text-gray-700'

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <span className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl ${projectIconBg(currentProject?.id)}`}>
            <span className={`h-2.5 w-2.5 rounded-full ${projectDot(currentProject?.id)}`} />
          </span>
          <div>
            <h1 className="text-2xl font-semibold text-gray-900 dark:text-gray-100">{currentProject?.name ?? 'Dashboard'}</h1>
            <p className="text-sm text-gray-500 dark:text-gray-400">{currentProject?.sprintName ?? 'No sprint loaded'}</p>
          </div>
        </div>
        <span className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold ${statusClass}`}>
          <span className="h-1.5 w-1.5 rounded-full bg-current" />
          {sprint.sprintStatus}
        </span>
      </div>

      <MetricsSummary sprint={sprint} onSelect={setDrilldownKpi} />

      <div className="grid grid-cols-1 md:grid-cols-12 gap-6 items-start">
        <div className="md:col-span-8 space-y-6">
          <SprintHealthPanel score={health.score} trend={health.trend} components={health.components} />
          <BurndownChart sprint={sprint} />
          <RiskTicketsPanel tickets={sprint.tickets} />
        </div>
        <div className="md:col-span-4 space-y-6">
          <TeamWorkloadPanel members={members} projectName={currentProject?.name ?? 'this project'} />
          <HealthTrendPanel history={health.history} />
          <ActivityPanel tickets={sprint.tickets} />
        </div>
      </div>

      {drilldownKpi && <KPIDrilldownModal kpi={drilldownKpi} sprint={sprint} onClose={() => setDrilldownKpi(null)} />}
    </div>
  )
}
