import { useProjects } from '../../hooks/useProjects'

export default function BackendBanner() {
  const { backendUnreachable, refetch } = useProjects()

  if (!backendUnreachable) return null

  return (
    <div className="flex items-center justify-between gap-4 border-b border-red-100 dark:border-red-900/40 bg-red-50 dark:bg-red-900/20 px-4 sm:px-6 py-2 text-sm">
      <p className="text-red-700 dark:text-red-300">
        <span className="font-semibold">Backend unreachable.</span>{' '}
        <code className="rounded bg-red-100 dark:bg-red-900/40 px-1.5 py-0.5 text-xs">
          cd backend &amp;&amp; source .venv/bin/activate &amp;&amp; uvicorn main:app --reload --port 8000
        </code>
      </p>
      <button
        type="button"
        onClick={refetch}
        className="shrink-0 rounded-lg bg-red-600 px-3 py-1 text-xs font-semibold text-white hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2"
      >
        Retry
      </button>
    </div>
  )
}
