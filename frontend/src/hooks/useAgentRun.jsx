import { createContext, useCallback, useContext, useRef, useState } from 'react'
import client from '../api/client'
import { useProjects } from './useProjects'
import { useToast } from './useToast'

const POLL_INTERVAL_MS = 2000
const AgentRunContext = createContext(null)

export function AgentRunProvider({ children }) {
  const [running, setRunning] = useState(false)
  const [step, setStep] = useState(null)
  const [lastRunAt, setLastRunAt] = useState(null)
  const [runVersion, setRunVersion] = useState(0)
  const [lastRunSummary, setLastRunSummary] = useState(null)
  const { showToast } = useToast()
  const { projectId } = useProjects()
  const pollRef = useRef(null)

  const stopPolling = useCallback(() => {
    if (pollRef.current) {
      clearInterval(pollRef.current)
      pollRef.current = null
    }
  }, [])

  const finish = useCallback((toastMessage, variant, summary) => {
    stopPolling()
    setRunning(false)
    setLastRunAt(new Date().toISOString())
    setRunVersion((v) => v + 1)
    if (summary) setLastRunSummary({ ...summary, seen: false, at: new Date().toISOString() })
    showToast(toastMessage, variant)
  }, [showToast, stopPolling])

  const poll = useCallback(
    (runId) => {
      pollRef.current = setInterval(async () => {
        try {
          const { data } = await client.get('/api/run/status', { params: { run_id: runId } })
          setStep(data.step)
          const nudgeText = data.nudgeCount
            ? ` ${data.nudgeCount} nudge${data.nudgeCount === 1 ? '' : 's'} generated — check Nudges on the Team page.`
            : ''
          if (data.status === 'done') {
            finish(`Agent run complete.${nudgeText}`, 'success', { status: 'done', nudgeCount: data.nudgeCount })
          } else if (data.status === 'partial') {
            const detail = data.errors?.length ? ' ' + data.errors.join(' ') : ''
            finish(`Agent partially completed.${detail}${nudgeText}`, 'warning', { status: 'partial', nudgeCount: data.nudgeCount, errors: data.errors })
          } else if (data.status === 'error') {
            finish(`Agent run failed: ${data.error}`, 'error')
          }
        } catch (err) {
          stopPolling()
          setRunning(false)
          showToast(err.message || 'Failed to check run status', 'error')
        }
      }, POLL_INTERVAL_MS)
    },
    [finish, showToast, stopPolling]
  )

  const runAgent = useCallback(async () => {
    if (running || !projectId) return
    setRunning(true)
    setStep('Starting…')
    try {
      const { data } = await client.post('/api/run', null, { params: { project: projectId } })
      showToast('Agent run started', 'info')
      poll(data.run_id)
    } catch (err) {
      setRunning(false)
      showToast(err.message || 'Failed to start agent run', 'error')
    }
  }, [poll, projectId, running, showToast])

  const markNotificationSeen = useCallback(() => {
    setLastRunSummary((current) => (current ? { ...current, seen: true } : current))
  }, [])

  return (
    <AgentRunContext.Provider
      value={{ running, step, runAgent, lastRunAt, runVersion, lastRunSummary, markNotificationSeen }}
    >
      {children}
    </AgentRunContext.Provider>
  )
}

export function useAgentRun() {
  const ctx = useContext(AgentRunContext)
  if (!ctx) throw new Error('useAgentRun must be used within an AgentRunProvider')
  return ctx
}
