import { useCallback, useEffect, useState } from 'react'
import client from '../api/client'
import { useAgentRun } from './useAgentRun'
import { useProjects } from './useProjects'

export function useSprint() {
  const [sprint, setSprint] = useState(null)
  const [health, setHealth] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const { runVersion } = useAgentRun()
  const { projectId } = useProjects()

  const load = useCallback(async () => {
    if (!projectId) return
    setLoading(true)
    setError(null)
    try {
      const [sprintRes, healthRes] = await Promise.all([
        client.get(`/api/projects/${projectId}/sprint`),
        client.get(`/api/projects/${projectId}/health`),
      ])
      setSprint(sprintRes.data)
      setHealth(healthRes.data)
    } catch (err) {
      setError(err)
    } finally {
      setLoading(false)
    }
  }, [projectId])

  useEffect(() => {
    load()
  }, [load, runVersion])

  return { sprint, health, loading, error, refetch: load }
}
