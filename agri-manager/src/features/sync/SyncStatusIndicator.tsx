import { useNavigate } from 'react-router-dom'
import { useSyncStore } from '../../stores/sync-store'

export function SyncStatusIndicator() {
  const navigate = useNavigate()
  const status = useSyncStore((s) => s.status)
  const pendingCount = useSyncStore((s) => s.pendingCount)

  const { dot, label } = getDisplayProps(status, pendingCount)

  return (
    <button
      onClick={() => navigate('/sync')}
      className="flex items-center gap-1.5 px-3 py-1 text-xs text-gray-600 hover:text-gray-900 transition-colors"
      aria-label={`Sync status: ${label}`}
    >
      {dot}
      <span>{label}</span>
    </button>
  )
}

function getDisplayProps(status: string, pendingCount: number) {
  if (status === 'syncing') {
    return {
      dot: (
        <span className="w-2 h-2 rounded-full bg-blue-500 animate-pulse" />
      ),
      label: 'Syncing…',
    }
  }
  if (status === 'error') {
    return {
      dot: <span className="w-2 h-2 rounded-full bg-red-500" />,
      label: 'Sync error',
    }
  }
  if (status === 'offline') {
    return {
      dot: <span className="w-2 h-2 rounded-full bg-gray-400" />,
      label: 'Offline',
    }
  }
  // idle
  if (pendingCount > 0) {
    return {
      dot: <span className="w-2 h-2 rounded-full bg-yellow-500" />,
      label: `${pendingCount} pending`,
    }
  }
  return {
    dot: <span className="w-2 h-2 rounded-full bg-green-500" />,
    label: 'Synced',
  }
}
