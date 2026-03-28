import { useState, type ReactNode } from 'react'
import { ChevronDown } from 'lucide-react'

interface SectionCollapsibleProps {
  title: string
  defaultOpen?: boolean
  children: ReactNode
  badge?: string
}

export function SectionCollapsible({
  title,
  defaultOpen = false,
  children,
  badge,
}: SectionCollapsibleProps) {
  const [open, setOpen] = useState(defaultOpen)

  return (
    <div className="border border-gray-200 rounded-2xl overflow-hidden">
      <button
        type="button"
        onClick={() => setOpen(v => !v)}
        className="w-full flex items-center justify-between px-4 py-3.5 bg-white active:bg-gray-50"
      >
        <div className="flex items-center gap-2">
          <span className="text-sm font-semibold text-gray-700">{title}</span>
          {badge && (
            <span className="text-xs bg-primary-100 text-primary-700 px-2 py-0.5 rounded-full font-medium">
              {badge}
            </span>
          )}
        </div>
        <ChevronDown
          size={18}
          className={`text-gray-400 transition-transform duration-200 ${open ? 'rotate-180' : ''}`}
        />
      </button>

      {open && (
        <div className="px-4 pb-4 pt-1 border-t border-gray-100 space-y-4 bg-white">
          {children}
        </div>
      )}
    </div>
  )
}
