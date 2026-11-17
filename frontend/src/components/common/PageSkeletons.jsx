import Card from './Card'
import Skeleton from './Skeleton'

// Layout-matching loading placeholders, one per page, so content doesn't
// jump when data arrives.

function Shell({ label, children }) {
  return (
    <div className="space-y-6" role="status" aria-busy="true" aria-label={label}>
      {children}
      <span className="sr-only">Loading</span>
    </div>
  )
}

function PageHeader() {
  return (
    <div className="flex items-center justify-between" aria-hidden="true">
      <div className="space-y-2">
        <Skeleton className="h-7 w-52" />
        <Skeleton className="h-4 w-72" />
      </div>
      <Skeleton className="h-9 w-28" />
    </div>
  )
}

function Tiles({ count = 4 }) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6" aria-hidden="true">
      {Array.from({ length: count }).map((_, i) => (
        <Card key={i} className="p-5">
          <Skeleton className="h-3.5 w-24 mb-3" />
          <Skeleton className="h-8 w-20 mb-3" />
          <Skeleton className="h-3 w-32" />
        </Card>
      ))}
    </div>
  )
}

function Rows({ count = 4, avatar = true }) {
  return (
    <div className="space-y-4">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="flex items-center gap-3">
          {avatar && <Skeleton className="h-9 w-9 shrink-0 rounded-full" />}
          <div className="flex-1 space-y-2">
            <Skeleton className="h-3.5 w-3/4" />
            <Skeleton className="h-3 w-1/2" />
          </div>
          <Skeleton className="h-6 w-14 rounded-full" />
        </div>
      ))}
    </div>
  )
}

function Panel({ children, className = '' }) {
  return (
    <Card className={`p-6 ${className}`} aria-hidden="true">
      <div className="flex items-center justify-between mb-5">
        <Skeleton className="h-5 w-40" />
        <Skeleton className="h-4 w-16" />
      </div>
      {children}
    </Card>
  )
}

export function KanbanSkeleton() {
  return (
    <Shell label="Loading board">
      <PageHeader />
      <div className="grid grid-cols-1 md:grid-cols-5 gap-4" aria-hidden="true">
        {Array.from({ length: 5 }).map((_, col) => (
          <div key={col} className="rounded-2xl bg-gray-100/70 dark:bg-gray-900/60 p-3 space-y-3">
            <div className="flex items-center justify-between px-1">
              <Skeleton className="h-4 w-20" />
              <Skeleton className="h-4 w-6 rounded-full" />
            </div>
            {Array.from({ length: 4 - (col % 3) }).map((_, i) => (
              <Card key={i} className="p-3 space-y-2">
                <Skeleton className="h-3 w-16" />
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-4 w-2/3" />
                <div className="flex items-center justify-between pt-1">
                  <Skeleton className="h-5 w-5 rounded-full" />
                  <Skeleton className="h-4 w-10" />
                </div>
              </Card>
            ))}
          </div>
        ))}
      </div>
    </Shell>
  )
}

export function TeamSkeleton() {
  return (
    <Shell label="Loading team">
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6" aria-hidden="true">
        <Panel className="lg:col-span-1">
          <Skeleton className="h-10 w-full mb-5" />
          <Rows count={7} />
        </Panel>
        <div className="lg:col-span-2 space-y-6">
          <Card className="p-6">
            <div className="flex items-center gap-4 mb-6">
              <Skeleton className="h-16 w-16 rounded-full" />
              <div className="space-y-2">
                <Skeleton className="h-6 w-48" />
                <Skeleton className="h-4 w-32" />
              </div>
            </div>
            <div className="grid grid-cols-3 gap-4">
              <Skeleton className="h-20" />
              <Skeleton className="h-20" />
              <Skeleton className="h-20" />
            </div>
          </Card>
          <Panel>
            <Rows count={4} avatar={false} />
          </Panel>
        </div>
      </div>
    </Shell>
  )
}

export function PortfolioSkeleton() {
  return (
    <Shell label="Loading projects">
      <Tiles />
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6" aria-hidden="true">
        {Array.from({ length: 3 }).map((_, i) => (
          <Card key={i} className="p-6 space-y-4">
            <div className="flex items-center gap-3">
              <Skeleton className="h-10 w-10 rounded-xl" />
              <div className="space-y-2 flex-1">
                <Skeleton className="h-4 w-2/3" />
                <Skeleton className="h-3 w-1/2" />
              </div>
            </div>
            <Skeleton className="h-2 w-full rounded-full" />
            <div className="flex justify-between">
              <Skeleton className="h-4 w-16" />
              <Skeleton className="h-4 w-16" />
            </div>
          </Card>
        ))}
      </div>
    </Shell>
  )
}

export function SlackSkeleton() {
  return (
    <Shell label="Loading Slack">
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6" aria-hidden="true">
        {Array.from({ length: 3 }).map((_, i) => (
          <Card key={i} className="p-6 space-y-4">
            <div className="flex items-center justify-between">
              <Skeleton className="h-5 w-32" />
              <Skeleton className="h-6 w-16 rounded-full" />
            </div>
            <Skeleton className="h-3.5 w-full" />
            <Skeleton className="h-3.5 w-5/6" />
            <Skeleton className="h-9 w-full" />
          </Card>
        ))}
      </div>
      <Panel>
        <Rows count={4} avatar={false} />
      </Panel>
    </Shell>
  )
}

export function AnalyticsSkeleton() {
  return (
    <Shell label="Loading analytics">
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6" aria-hidden="true">
        {Array.from({ length: 3 }).map((_, i) => (
          <Panel key={i}>
            <Skeleton className="h-44" />
          </Panel>
        ))}
      </div>
      <Panel>
        <Skeleton className="h-10 w-full mb-4" />
        <Rows count={5} avatar={false} />
      </Panel>
    </Shell>
  )
}

export function ReportsSkeleton() {
  return (
    <Shell label="Loading reports">
      <PageHeader />
      <Panel>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-20" />
          ))}
        </div>
        <Skeleton className="h-40" />
      </Panel>
      <Panel>
        <Rows count={3} avatar={false} />
      </Panel>
    </Shell>
  )
}

export function SettingsFieldsSkeleton() {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4" role="status" aria-busy="true" aria-label="Loading settings">
      {Array.from({ length: 4 }).map((_, i) => (
        <div key={i} className="rounded-xl border border-gray-100 dark:border-gray-800 p-4 space-y-3">
          <Skeleton className="h-4 w-40" />
          <Skeleton className="h-9 w-full" />
          <Skeleton className="h-3 w-3/4" />
        </div>
      ))}
      <span className="sr-only">Loading</span>
    </div>
  )
}
