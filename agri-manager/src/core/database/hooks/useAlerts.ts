import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../db'

export function useAlerts(onlyActive = true) {
  return useLiveQuery(() => {
    let query = db.alerts.orderBy('createdAt').reverse()
    if (onlyActive) {
      return query.filter(a => !a.isDismissed).toArray()
    }
    return query.toArray()
  }, [onlyActive])
}

export function useUnreadHighCriticalCount() {
  return useLiveQuery(() =>
    db.alerts
      .filter(a => !a.isDismissed && !a.isRead && (a.severity === 'critical' || a.severity === 'high'))
      .count()
  , [])
}
