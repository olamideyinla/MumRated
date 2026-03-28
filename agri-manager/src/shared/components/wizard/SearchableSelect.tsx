import { useState, useRef, useEffect } from 'react'
import { ChevronDown, Check } from 'lucide-react'

interface SearchableSelectProps {
  options: string[]
  value: string          // selected option or 'other'
  customValue: string    // text when value === 'other'
  onChange: (value: string, isCustom: boolean, customText: string) => void
  placeholder?: string
  customPlaceholder?: string
  label?: string
  error?: string
}

export function SearchableSelect({
  options,
  value,
  customValue,
  onChange,
  placeholder = 'Select or type…',
  customPlaceholder = 'Enter custom value',
  label,
  error,
}: SearchableSelectProps) {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const containerRef = useRef<HTMLDivElement>(null)

  const displayValue = value === 'other' ? '' : value

  const filtered = query
    ? options.filter(o => o.toLowerCase().includes(query.toLowerCase()))
    : options

  // Close on outside click
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false)
        setQuery('')
      }
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [])

  const handleSelect = (option: string) => {
    const isOther = option === 'Other'
    onChange(isOther ? 'other' : option, isOther, '')
    setOpen(false)
    setQuery('')
  }

  const handleInputFocus = () => {
    setQuery('')
    setOpen(true)
  }

  const handleInputChange = (q: string) => {
    setQuery(q)
    setOpen(true)
    // If user types, clear the selected value so it's a fresh search
    if (value && value !== 'other') onChange('', false, '')
  }

  return (
    <div ref={containerRef}>
      {label && (
        <label className="block text-sm font-medium text-gray-700 mb-1">{label}</label>
      )}

      {/* Main select input */}
      <div className="relative">
        <input
          type="text"
          className="input-base pr-8"
          placeholder={placeholder}
          value={open ? query : displayValue}
          onFocus={handleInputFocus}
          onChange={(e) => handleInputChange(e.target.value)}
          autoComplete="off"
        />
        <ChevronDown
          size={16}
          className={`absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none transition-transform ${open ? 'rotate-180' : ''}`}
        />

        {/* Dropdown */}
        {open && (
          <div className="absolute z-20 left-0 right-0 top-full mt-1 bg-white border border-gray-200 rounded-xl shadow-lg max-h-52 overflow-y-auto">
            {filtered.map(opt => (
              <button
                key={opt}
                type="button"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => handleSelect(opt)}
                className="w-full text-left px-4 py-2.5 text-sm hover:bg-primary-50 flex items-center justify-between"
              >
                <span>{opt}</span>
                {value === opt && <Check size={14} className="text-primary-600 flex-shrink-0" />}
              </button>
            ))}
            {/* Other option */}
            <button
              type="button"
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => handleSelect('Other')}
              className="w-full text-left px-4 py-2.5 text-sm hover:bg-primary-50 border-t border-gray-100 flex items-center justify-between text-gray-500 italic"
            >
              <span>Other (type your own)</span>
              {value === 'other' && <Check size={14} className="text-primary-600" />}
            </button>
          </div>
        )}
      </div>

      {/* Custom text input */}
      {value === 'other' && (
        <input
          type="text"
          className="input-base mt-2"
          placeholder={customPlaceholder}
          value={customValue}
          onChange={(e) => onChange('other', true, e.target.value)}
          autoFocus
        />
      )}

      {error && <p className="mt-1 text-xs text-red-600">{error}</p>}
    </div>
  )
}
