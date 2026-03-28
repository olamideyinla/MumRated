interface StepIndicatorProps {
  currentStep: number
  steps: string[]
}

export function StepIndicator({ currentStep, steps }: StepIndicatorProps) {
  return (
    <div className="px-4 pt-3 pb-2 bg-white border-b border-gray-100">
      {/* Progress bar */}
      <div className="flex items-center gap-1 mb-2">
        {steps.map((_, i) => (
          <div
            key={i}
            className={`h-1.5 flex-1 rounded-full transition-all duration-300 ${
              i < currentStep
                ? 'bg-primary-500'
                : i === currentStep
                ? 'bg-primary-400'
                : 'bg-gray-200'
            }`}
          />
        ))}
      </div>

      {/* Step label */}
      <div className="flex items-center justify-between">
        <p className="text-xs font-medium text-primary-700">{steps[currentStep]}</p>
        <p className="text-xs text-gray-400">Step {currentStep + 1} of {steps.length}</p>
      </div>
    </div>
  )
}
