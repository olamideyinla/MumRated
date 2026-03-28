interface SkeletonProps {
  variant: 'card' | 'list-item' | 'chart' | 'kpi-row'
  count?: number
}

function CardSkeleton() {
  return (
    <div className="card animate-pulse space-y-3">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 bg-gray-200 dark:bg-gray-700 rounded-xl" />
        <div className="flex-1 space-y-2">
          <div className="h-3 bg-gray-200 dark:bg-gray-700 rounded w-3/4" />
          <div className="h-2 bg-gray-200 dark:bg-gray-700 rounded w-1/2" />
        </div>
      </div>
      <div className="h-2 bg-gray-200 dark:bg-gray-700 rounded" />
      <div className="h-2 bg-gray-200 dark:bg-gray-700 rounded w-5/6" />
    </div>
  )
}

function ListItemSkeleton() {
  return (
    <div className="flex items-center gap-3 py-3 px-4 animate-pulse">
      <div className="w-8 h-8 bg-gray-200 dark:bg-gray-700 rounded-lg shrink-0" />
      <div className="flex-1 space-y-1.5">
        <div className="h-3 bg-gray-200 dark:bg-gray-700 rounded w-2/3" />
        <div className="h-2 bg-gray-200 dark:bg-gray-700 rounded w-1/3" />
      </div>
      <div className="w-12 h-4 bg-gray-200 dark:bg-gray-700 rounded-full" />
    </div>
  )
}

function ChartSkeleton() {
  return (
    <div className="card animate-pulse">
      <div className="h-3 bg-gray-200 dark:bg-gray-700 rounded w-40 mb-4" />
      <div className="flex items-end gap-2 h-32">
        {[60, 80, 45, 90, 55, 75].map((h, i) => (
          <div
            key={i}
            className="flex-1 bg-gray-200 dark:bg-gray-700 rounded-t"
            style={{ height: `${h}%` }}
          />
        ))}
      </div>
    </div>
  )
}

function KpiRowSkeleton() {
  return (
    <div className="flex gap-3 overflow-x-auto pb-1 animate-pulse">
      {[1, 2, 3, 4].map(i => (
        <div key={i} className="shrink-0 w-32 h-20 bg-gray-200 dark:bg-gray-700 rounded-2xl" />
      ))}
    </div>
  )
}

export function Skeleton({ variant, count = 1 }: SkeletonProps) {
  const Component = {
    card: CardSkeleton,
    'list-item': ListItemSkeleton,
    chart: ChartSkeleton,
    'kpi-row': KpiRowSkeleton,
  }[variant]

  return (
    <>
      {Array.from({ length: count }, (_, i) => (
        <Component key={i} />
      ))}
    </>
  )
}
