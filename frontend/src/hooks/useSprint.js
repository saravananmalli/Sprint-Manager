import { useCallback, useEffect, useRef, useState } from 'react'
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
  const loadedFor = useRef({})

  // Switching projects: drop the previous project's data so it never flashes.
  useEffect(() => {
    setSprint(null)
    setHealth(null)
  }, [projectId])

  const activeProject = useRef(projectId)
  activeProject.current = projectId

  const load = useCallback(async () => {
    if (!projectId) return
    const requested = projectId
    // Keep showing current data while refetching (e.g. after an agent run);
    // only show the loading state when there's nothing for this project yet.
    setLoading((prev) => prev || !loadedFor.current[projectId])
    setError(null)
    try {
      const [sprintRes, healthRes] = await Promise.all([
        client.get(`/api/projects/${requested}/sprint`),
        client.get(`/api/projects/${requested}/health`),
      ])
      if (activeProject.current !== requested) return // switched projects mid-request
      setSprint(sprintRes.data)
      setHealth(healthRes.data)
      loadedFor.current[requested] = true
    } catch (err) {
      if (activeProject.current === requested) setError(err)
    } finally {
      if (activeProject.current === requested) setLoading(false)
    }
  }, [projectId])

  useEffect(() => {
    load()
  }, [load, runVersion])

  return { sprint, health, loading, error, refetch: load }
}
