import Card from '../common/Card'
import Skeleton from '../common/Skeleton'

function PanelSkeleton({ height, rows = 0 }) {
  return (
    <Card className="p-6" aria-hidden="true">
      <div className="flex items-center justify-between mb-4">
        <Skeleton className="h-5 w-36" />
        <Skeleton className="h-4 w-16" />
      </div>
      {rows > 0 ? (
        <div className="space-y-4">
          {Array.from({ length: rows }).map((_, i) => (
            <div key={i} className="flex items-center gap-3">
              <Skeleton className="h-9 w-9 shrink-0 rounded-full" />
              <div className="flex-1 space-y-2">
                <Skeleton className="h-3.5 w-3/4" />
                <Skeleton className="h-3 w-1/2" />
              </div>
            </div>
          ))}
        </div>
      ) : (
        <Skeleton className={height} />
      )}
    </Card>
  )
}

// Mirrors the real Dashboard layout (header, 4 KPI tiles, 8/4 column grid)
// so content doesn't jump when data arrives.
export default function DashboardSkeleton() {
  return (
    <div className="space-y-6" role="status" aria-busy="true" aria-label="Loading dashboard">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Skeleton className="h-11 w-11 rounded-xl" />
          <div className="space-y-2">
            <Skeleton className="h-6 w-48" />
            <Skeleton className="h-4 w-64" />
          </div>
        </div>
        <Skeleton className="h-7 w-24 rounded-full" />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        {Array.from({ length: 4 }).map((_, i) => (
          <Card key={i} className="p-5" aria-hidden="true">
            <Skeleton className="h-3.5 w-24 mb-3" />
            <Skeleton className="h-8 w-20 mb-3" />
            <Skeleton className="h-3 w-32" />
          </Card>
        ))}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-12 gap-6 items-start">
        <div className="md:col-span-8 space-y-6">
          <PanelSkeleton height="h-28" />
          <PanelSkeleton height="h-64" />
          <PanelSkeleton rows={4} />
        </div>
        <div className="md:col-span-4 space-y-6">
          <PanelSkeleton rows={4} />
          <PanelSkeleton height="h-32" />
          <PanelSkeleton rows={3} />
        </div>
      </div>
      <span className="sr-only">Loading</span>
    </div>
  )
}
