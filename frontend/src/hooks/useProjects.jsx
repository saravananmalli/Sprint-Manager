import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import client from '../api/client'

const ProjectContext = createContext(null)
const STORAGE_KEY = 'sprint-agent-project'

export function ProjectProvider({ children }) {
  const [projects, setProjects] = useState([])
  const [portfolio, setPortfolio] = useState(null)
  const [projectId, setProjectIdState] = useState(() => localStorage.getItem(STORAGE_KEY) || null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [backendUnreachable, setBackendUnreachable] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const { data } = await client.get('/api/projects')
      setProjects(data.projects)
      setPortfolio(data)
      setBackendUnreachable(false)
      setProjectIdState((current) => {
        if (current && data.projects.some((p) => p.id === current)) return current
        return data.projects[0]?.id ?? null
      })
    } catch (err) {
      setError(err)
      if (!err.status) setBackendUnreachable(true)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    load()
  }, [load])

  const setProjectId = useCallback((id) => {
    setProjectIdState(id)
    localStorage.setItem(STORAGE_KEY, id)
  }, [])

  const currentProject = useMemo(
    () => projects.find((p) => p.id === projectId) || null,
    [projects, projectId]
  )

  const value = useMemo(
    () => ({ projects, portfolio, projectId, setProjectId, currentProject, loading, error, backendUnreachable, refetch: load }),
    [projects, portfolio, projectId, setProjectId, currentProject, loading, error, backendUnreachable, load]
  )

  return <ProjectContext.Provider value={value}>{children}</ProjectContext.Provider>
}

export function useProjects() {
  const ctx = useContext(ProjectContext)
  if (!ctx) throw new Error('useProjects must be used within a ProjectProvider')
  return ctx
}
