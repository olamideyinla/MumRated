import { Plus } from 'lucide-react'

interface AddAnotherCardProps {
  label: string
  onClick: () => void
}

export function AddAnotherCard({ label, onClick }: AddAnotherCardProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="w-full border-2 border-dashed border-primary-300 rounded-xl py-3 flex items-center justify-center gap-2 text-primary-600 text-sm font-medium active:bg-primary-50 transition-colors"
    >
      <Plus size={18} />
      {label}
    </button>
  )
}
