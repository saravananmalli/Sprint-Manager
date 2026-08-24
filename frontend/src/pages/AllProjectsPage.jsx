import {
  ArrowPathIcon,
  ArrowRightIcon,
  ExclamationTriangleIcon,
  PlayIcon,
  PlusIcon,
  TrashIcon,
  UserGroupIcon,
} from '@heroicons/react/24/outline'
import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import client from '../api/client'
import Card from '../components/common/Card'
import Skeleton from '../components/common/Skeleton'
import StatTile from '../components/common/StatTile'
import NewProjectModal from '../components/projects/NewProjectModal'
import { useProjects } from '../hooks/useProjects'
import { useToast } from '../hooks/useToast'
import { projectDot } from '../utils/projectColor'
import { healthScoreClasses, SPRINT_STATUS_CLASSES } from '../utils/riskColors'

async function waitForRun(runId) {
  for (;;) {
    const { data } = await client.get('/api/run/status', { params: { run_id: runId } })
    if (data.status !== 'running') return data
    await new Promise((r) => setTimeout(r, 1500))
  }
}

export default function AllProjectsPage() {
  const { projects, portfolio, loading, error, refetch, setProjectId } = useProjects()
  const [runningAll, setRunningAll] = useState(false)
  const [showNewProject, setShowNewProject] = useState(false)
  const [deletingId, setDeletingId] = useState(null)
  const { showToast } = useToast()
  const navigate = useNavigate()

  const handleCreated = async (project) => {
    setShowNewProject(false)
    await refetch()
    setProjectId(project.id)
    showToast(`${project.name} created`, 'success')
    navigate('/')
  }

  const handleDelete = async (e, project) => {
    e.stopPropagation()
    if (!window.confirm(`Delete "${project.name}"? This cannot be undone.`)) return
    setDeletingId(project.id)
    try {
      await client.delete(`/api/projects/${project.id}`)
      showToast(`${project.name} deleted`, 'info')
      await refetch()
    } catch (err) {
      showToast(err.message || 'Could not delete project', 'error')
    } finally {
      setDeletingId(null)
    }
  }

  const runAll = async () => {
    setRunningAll(true)
    try {
      for (const project of projects) {
        const { data } = await client.post('/api/run', null, { params: { project: project.id } })
        await waitForRun(data.run_id)
      }
      showToast('Ran the agent across all projects', 'success')
      refetch()
    } catch (err) {
      showToast(err.message || 'Run all failed partway through', 'error')
    } finally {
      setRunningAll(false)
    }
  }

  if (error) {
    return (
      <div className="rounded-2xl border border-red-100 dark:border-red-900/40 bg-red-50 dark:bg-red-900/20 p-8 text-center">
        <p className="text-red-700 dark:text-red-300">{error.message || 'Failed to load projects'}</p>
      </div>
    )
  }

  if (loading || !portfolio) {
    return (
      <div className="space-y-6">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-32" />
          ))}
        </div>
        <Skeleton className="h-96" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900 dark:text-gray-100">All projects</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            {portfolio.totalProjects} projects · {portfolio.totalAtRisk} at-risk tickets · {portfolio.totalAtRiskMembers} at-risk members
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={refetch}
            className="inline-flex items-center gap-1.5 rounded-lg border border-gray-200 dark:border-gray-700 px-3 py-1.5 text-sm font-medium text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-800 focus:outline-none focus:ring-2 focus:ring-brand-500"
          >
            <ArrowPathIcon className="w-4 h-4" />
            Refresh
          </button>
          <button
            type="button"
            onClick={runAll}
            disabled={runningAll}
            className="inline-flex items-center gap-1.5 rounded-lg bg-brand-600 px-3 py-1.5 text-sm font-semibold text-white hover:bg-brand-700 disabled:opacity-60 focus:outline-none focus:ring-2 focus:ring-brand-500 focus:ring-offset-2"
          >
            <PlayIcon className="w-4 h-4" />
            {runningAll ? 'Running…' : 'Run all'}
          </button>
          <button
            type="button"
            onClick={() => setShowNewProject(true)}
            className="inline-flex items-center gap-1.5 rounded-lg border border-gray-200 dark:border-gray-700 px-3 py-1.5 text-sm font-medium text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-800 focus:outline-none focus:ring-2 focus:ring-brand-500"
          >
            <PlusIcon className="w-4 h-4" />
            New project
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        <StatTile label="Portfolio velocity" value={portfolio.portfolioVelocity} suffix="%" />
        <StatTile label="Points done" value={portfolio.totalPointsDone} suffix={`/ ${portfolio.totalPointsCommitted}`} />
        <StatTile label="At-risk tickets" value={portfolio.totalAtRisk} valueClass="text-amber-600 dark:text-amber-400" />
        <StatTile label="At-risk members" value={portfolio.totalAtRiskMembers} valueClass="text-red-600 dark:text-red-400" />
      </div>

      <Card className="p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-medium text-gray-900 dark:text-gray-100">Project portfolio</h2>
          <span className="text-xs text-gray-400">Live snapshot</span>
        </div>
        <ul className="divide-y divide-gray-100 dark:divide-gray-800">
          {projects.map((p) => {
            const pct = p.totalCommitted ? Math.min((p.pointsDone / p.totalCommitted) * 100, 100) : 0
            return (
              <li key={p.id} className="py-4 group/row relative">
                {p.custom && (
                  <button
                    type="button"
                    onClick={(e) => handleDelete(e, p)}
                    disabled={deletingId === p.id}
                    aria-label={`Delete ${p.name}`}
                    className="absolute right-0 top-4 rounded-lg p-1.5 text-gray-300 hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-900/20 dark:hover:text-red-400 opacity-0 group-hover/row:opacity-100 focus:opacity-100 disabled:opacity-60"
                  >
                    <TrashIcon className="w-4 h-4" />
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => {
                    setProjectId(p.id)
                    navigate('/')
                  }}
                  className="w-full text-left group pr-8"
                >
                  <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
                    <div className="flex items-start gap-2.5">
                      <span className={`mt-1.5 h-2.5 w-2.5 shrink-0 rounded-full ${projectDot(p.id)}`} />
                      <div>
                      <p className="font-medium text-gray-900 dark:text-gray-100 group-hover:text-brand-600 dark:group-hover:text-brand-400">
                        {p.name}
                        {p.custom && (
                          <span className="ml-2 inline-flex items-center rounded-full bg-gray-100 dark:bg-gray-800 px-1.5 py-0.5 text-[10px] font-medium text-gray-500 dark:text-gray-400 align-middle">
                            custom
                          </span>
                        )}
                      </p>
                      <p className="text-xs text-gray-400">
                        {p.sprintName} · #{p.teamSlug}
                      </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-10 text-sm">
                      <div className="flex items-center gap-16">
                        <div>
                          <p className="text-xs text-gray-400 uppercase">Health</p>
                          <p className="font-semibold">
                            <span className={healthScoreClasses(p.health).text}>{p.health ?? '—'}</span>
                            <span className="text-gray-400 dark:text-gray-500">/100</span>
                          </p>
                        </div>
                        <div>
                          <p className="text-xs text-gray-400 uppercase">Velocity</p>
                          <p className="font-semibold text-amber-600 dark:text-amber-400">{p.velocity}%</p>
                        </div>
                        <div>
                          <p className="text-xs text-gray-400 uppercase"># pts</p>
                          <p className="font-semibold text-gray-900 dark:text-gray-100">
                            {p.pointsDone}/{p.totalCommitted}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="inline-flex items-center gap-1 rounded-full border border-amber-300 bg-amber-100 dark:border-amber-500/30 dark:bg-amber-500/15 px-2 py-0.5 text-xs font-medium text-amber-800 dark:text-amber-400">
                          <ExclamationTriangleIcon className="w-3.5 h-3.5" />
                          {p.atRiskCount}
                        </span>
                        <span className="inline-flex items-center gap-1 rounded-full border border-red-300 bg-red-100 dark:border-red-500/30 dark:bg-red-500/15 px-2 py-0.5 text-xs font-medium text-red-800 dark:text-red-400">
                          <UserGroupIcon className="w-3.5 h-3.5" />
                          {p.atRiskMembers}
                        </span>
                        <span className={`inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-xs font-medium ${SPRINT_STATUS_CLASSES[p.sprintStatus]}`}>
                          <span className="h-1.5 w-1.5 rounded-full bg-current" />
                          {p.sprintStatus}
                        </span>
                      </div>
                      <ArrowRightIcon className="w-4 h-4 text-gray-300 dark:text-gray-600 group-hover:text-brand-500 dark:group-hover:text-brand-400 transition-colors" />
                    </div>
                  </div>
                  <div className="mt-3 h-1.5 w-full rounded-full bg-gray-100 dark:bg-gray-800 overflow-hidden">
                    <div className={`h-full rounded-full ${projectDot(p.id)}`} style={{ width: `${pct}%` }} />
                  </div>
                </button>
              </li>
            )
          })}
        </ul>
      </Card>

      {showNewProject && <NewProjectModal onClose={() => setShowNewProject(false)} onCreated={handleCreated} />}
    </div>
  )
}
