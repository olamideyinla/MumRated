import { Loader2 } from 'lucide-react'

interface WizardNavButtonsProps {
  currentStep: number
  totalSteps: number
  onBack: () => void
  onNext: () => void
  onSkip?: () => void
  canSkip?: boolean
  isLoading?: boolean
  nextLabel?: string
}

export function WizardNavButtons({
  currentStep,
  totalSteps,
  onBack,
  onNext,
  onSkip,
  canSkip,
  isLoading,
  nextLabel,
}: WizardNavButtonsProps) {
  const isLastStep = currentStep === totalSteps - 2  // one before the complete screen

  return (
    <div className="sticky bottom-0 bg-white border-t border-gray-100 px-4 py-3 safe-bottom">
      {canSkip && onSkip && (
        <button
          type="button"
          onClick={onSkip}
          className="w-full text-center text-sm text-gray-400 py-1 mb-2"
        >
          Skip for now
        </button>
      )}
      <div className="flex gap-3">
        {currentStep > 0 && (
          <button
            type="button"
            onClick={onBack}
            disabled={isLoading}
            className="btn-secondary flex-shrink-0 px-5"
          >
            Back
          </button>
        )}
        <button
          type="button"
          onClick={onNext}
          disabled={isLoading}
          className="btn-primary flex-1"
        >
          {isLoading ? (
            <Loader2 size={20} className="mx-auto animate-spin" />
          ) : (
            nextLabel ?? (isLastStep ? 'Save & Finish' : 'Next →')
          )}
        </button>
      </div>
    </div>
  )
}
