import { ChevronLeft, ChevronRight, Calendar } from 'lucide-react'
import { useRef } from 'react'

interface QuickDateBarProps {
  date: string            // YYYY-MM-DD
  onChange: (date: string) => void
  maxDate?: string        // defaults to today
}

function addDays(dateStr: string, days: number): string {
  const d = new Date(dateStr)
  d.setDate(d.getDate() + days)
  return d.toISOString().split('T')[0]
}

function formatDate(dateStr: string): string {
  const today = new Date().toISOString().split('T')[0]
  const yesterday = addDays(today, -1)
  if (dateStr === today) return 'Today'
  if (dateStr === yesterday) return 'Yesterday'
  return new Date(dateStr + 'T12:00:00').toLocaleDateString(undefined, {
    weekday: 'short', month: 'short', day: 'numeric',
  })
}

export function QuickDateBar({ date, onChange, maxDate }: QuickDateBarProps) {
  const max = maxDate ?? new Date().toISOString().split('T')[0]
  const canGoForward = date < max
  const pickerRef = useRef<HTMLInputElement>(null)

  return (
    <div className="flex items-center gap-1 bg-white/10 rounded-xl px-1 py-1">
      <button
        type="button"
        onClick={() => onChange(addDays(date, -1))}
        className="touch-target text-white rounded-lg active:bg-white/20"
        aria-label="Previous day"
      >
        <ChevronLeft size={20} />
      </button>

      <button
        type="button"
        onClick={() => pickerRef.current?.showPicker()}
        className="flex items-center gap-1.5 px-3 py-1.5 text-white text-sm font-semibold rounded-lg active:bg-white/20"
      >
        <Calendar size={14} />
        {formatDate(date)}
      </button>

      {/* Hidden native date picker */}
      <input
        ref={pickerRef}
        type="date"
        value={date}
        max={max}
        onChange={(e) => e.target.value && onChange(e.target.value)}
        className="sr-only"
        aria-hidden
      />

      <button
        type="button"
        onClick={() => canGoForward && onChange(addDays(date, 1))}
        disabled={!canGoForward}
        className="touch-target text-white rounded-lg active:bg-white/20 disabled:opacity-30"
        aria-label="Next day"
      >
        <ChevronRight size={20} />
      </button>
    </div>
  )
}
