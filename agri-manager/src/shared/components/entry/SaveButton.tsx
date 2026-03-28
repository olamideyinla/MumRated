import { Check, Loader2 } from 'lucide-react'

interface SaveButtonProps {
  isLoading?: boolean
  isSuccess?: boolean
  onClick?: () => void
  label?: string
  type?: 'button' | 'submit'
}

export function SaveButton({
  isLoading,
  isSuccess,
  onClick,
  label = 'SAVE',
  type = 'submit',
}: SaveButtonProps) {
  return (
    <div className="sticky bottom-0 bg-white border-t border-gray-100 px-4 py-3 safe-bottom">
      <button
        type={type}
        onClick={onClick}
        disabled={isLoading || isSuccess}
        className={`w-full py-4 rounded-2xl font-bold text-lg transition-all duration-200 ${
          isSuccess
            ? 'bg-emerald-500 text-white'
            : 'bg-primary-600 text-white active:bg-primary-800 disabled:opacity-60'
        }`}
      >
        {isLoading ? (
          <Loader2 size={24} className="mx-auto animate-spin" />
        ) : isSuccess ? (
          <div className="flex items-center justify-center gap-2">
            <Check size={22} />
            Saved!
          </div>
        ) : (
          label
        )}
      </button>
    </div>
  )
}
