import client from '../api/client'

// Shared with useAgentRun's interval-based poller (Header's "Run" button) —
// having AllProjectsPage.runAll() poll at a different cadence (it used to
// be 1500ms vs. this 2000ms) was an accidental inconsistency, not a
// deliberate choice.
export const RUN_POLL_INTERVAL_MS = 2000

// Sequentially await a single run's completion — used where the caller
// needs to run several projects one after another (AllProjectsPage), unlike
// useAgentRun's setInterval-based poller which tracks one global run's
// live status for UI display and needs start/stop lifecycle management.
export async function waitForRunStatus(runId, intervalMs = RUN_POLL_INTERVAL_MS) {
  for (;;) {
    const { data } = await client.get('/api/run/status', { params: { run_id: runId } })
    if (data.status !== 'running') return data
    await new Promise((resolve) => setTimeout(resolve, intervalMs))
  }
}
