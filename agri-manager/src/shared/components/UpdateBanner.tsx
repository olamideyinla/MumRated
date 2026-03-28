import { useRegisterSW } from 'virtual:pwa-register/react'

export function UpdateBanner() {
  const {
    needRefresh: [needRefresh],
    updateServiceWorker,
  } = useRegisterSW()

  if (!needRefresh) return null

  return (
    <div className="bg-primary-600 text-white px-4 py-2 flex items-center justify-between gap-3 animate-slide-down">
      <span className="text-sm font-medium">Update available</span>
      <button
        onClick={() => updateServiceWorker(true)}
        className="text-sm font-semibold text-accent shrink-0 underline"
      >
        Refresh
      </button>
    </div>
  )
}
