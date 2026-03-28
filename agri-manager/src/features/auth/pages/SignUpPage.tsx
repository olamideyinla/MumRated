import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { ChevronLeft, Eye, EyeOff, Loader2 } from 'lucide-react'
import { useAuthStore } from '../../../stores/auth-store'

// ── Schemas ───────────────────────────────────────────────────────────────────

const step1Schema = z.object({
  fullName: z.string().min(2, 'Full name is required'),
  phone: z.string().min(7, 'Enter a valid phone number'),
  email: z.string().refine(
    v => v === '' || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v),
    'Enter a valid email',
  ),
})

const step2Schema = z.object({
  farmName: z.string().min(2, 'Farm name is required'),
  currency: z.string().min(1, 'Select a currency'),
})

const step3Schema = z.object({
  password: z.string().min(6, 'Password must be at least 6 characters'),
  confirmPassword: z.string().min(1, 'Please confirm your password'),
}).refine(d => d.password === d.confirmPassword, {
  message: 'Passwords do not match',
  path: ['confirmPassword'],
})

type Step1Form = z.infer<typeof step1Schema>
type Step2Form = z.infer<typeof step2Schema>
type Step3Form = z.infer<typeof step3Schema>

// ── Currency list ─────────────────────────────────────────────────────────────

const CURRENCIES = [
  { code: 'USD', name: 'US Dollar' },
  { code: 'EUR', name: 'Euro' },
  { code: 'GBP', name: 'British Pound' },
  { code: 'NGN', name: 'Nigerian Naira' },
  { code: 'KES', name: 'Kenyan Shilling' },
  { code: 'GHS', name: 'Ghanaian Cedi' },
  { code: 'ZAR', name: 'South African Rand' },
  { code: 'UGX', name: 'Ugandan Shilling' },
  { code: 'TZS', name: 'Tanzanian Shilling' },
  { code: 'ETB', name: 'Ethiopian Birr' },
  { code: 'XOF', name: 'West African CFA Franc' },
  { code: 'INR', name: 'Indian Rupee' },
  { code: 'PHP', name: 'Philippine Peso' },
  { code: 'BRL', name: 'Brazilian Real' },
  { code: 'MXN', name: 'Mexican Peso' },
  { code: 'CAD', name: 'Canadian Dollar' },
  { code: 'AUD', name: 'Australian Dollar' },
]

// ── Step indicator ────────────────────────────────────────────────────────────

function StepIndicator({ current, total }: { current: number; total: number }) {
  return (
    <div className="flex items-center gap-1.5">
      {Array.from({ length: total }, (_, i) => (
        <div
          key={i}
          className={`h-2 rounded-full transition-all duration-300 ${
            i < current
              ? 'bg-primary-500 flex-1'
              : i === current
              ? 'bg-primary-400 flex-[2]'
              : 'bg-gray-200 flex-1'
          }`}
        />
      ))}
    </div>
  )
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function SignUpPage() {
  const navigate = useNavigate()
  const { signUp, isLoading, error, clearError } = useAuthStore()

  const [step, setStep] = useState(0)
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirm, setShowConfirm] = useState(false)
  const [step1Data, setStep1Data] = useState<Step1Form | null>(null)
  const [step2Data, setStep2Data] = useState<Step2Form | null>(null)

  const step1Form = useForm<Step1Form>({ resolver: zodResolver(step1Schema) })
  const step2Form = useForm<Step2Form>({
    resolver: zodResolver(step2Schema),
    defaultValues: { currency: 'USD' },
  })
  const step3Form = useForm<Step3Form>({ resolver: zodResolver(step3Schema) })

  const handleBack = () => {
    clearError()
    if (step > 0) setStep(s => s - 1)
    else navigate('/auth/welcome')
  }

  const onStep1Submit = (data: Step1Form) => {
    clearError()
    setStep1Data(data)
    setStep(1)
  }

  const onStep2Submit = (data: Step2Form) => {
    clearError()
    setStep2Data(data)
    setStep(2)
  }

  const onStep3Submit = async (data: Step3Form) => {
    if (!step1Data || !step2Data) return
    const phone = step1Data.phone.startsWith('+')
      ? step1Data.phone
      : `+${step1Data.phone}`

    await signUp({
      fullName: step1Data.fullName,
      phone,
      email: step1Data.email || undefined,
      farmName: step2Data.farmName,
      currency: step2Data.currency,
      password: data.password,
    })

    // If no error but not authenticated — email confirmation required
    const state = useAuthStore.getState()
    if (!state.error && !state.isAuthenticated) {
      navigate('/auth/signin')
    }
    // If authenticated, GuestRoute auto-redirects to /dashboard
  }

  const stepTitles = ['Your Details', 'Your Farm', 'Set Password']

  return (
    <div className="h-dvh flex flex-col bg-white safe-top safe-bottom">
      {/* Header */}
      <div className="flex items-center gap-2 px-4 pt-4 pb-3">
        <button onClick={handleBack} className="touch-target text-gray-600 rounded-lg">
          <ChevronLeft size={24} />
        </button>
        <div className="flex-1">
          <h1 className="text-xl font-bold text-gray-900">Create Account</h1>
          <p className="text-xs text-gray-500">{stepTitles[step]}</p>
        </div>
      </div>

      {/* Step indicator */}
      <div className="px-6 pb-4">
        <StepIndicator current={step} total={3} />
        <p className="text-xs text-gray-400 mt-1.5">Step {step + 1} of 3</p>
      </div>

      <div className="flex-1 overflow-y-auto px-6">
        {/* Error banner */}
        {error && (
          <div className="mb-4 px-4 py-3 bg-red-50 border border-red-200 rounded-xl text-sm text-red-700">
            {error}
          </div>
        )}

        {/* ── Step 1: Personal details ── */}
        {step === 0 && (
          <form onSubmit={step1Form.handleSubmit(onStep1Submit)} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Full Name</label>
              <input
                {...step1Form.register('fullName')}
                type="text"
                autoComplete="name"
                placeholder="John Farmer"
                className="input-base"
              />
              {step1Form.formState.errors.fullName && (
                <p className="mt-1 text-xs text-red-600">{step1Form.formState.errors.fullName.message}</p>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Phone Number <span className="text-red-500">*</span>
              </label>
              <input
                {...step1Form.register('phone')}
                type="tel"
                inputMode="tel"
                autoComplete="tel"
                placeholder="+234 800 000 0000"
                className="input-base"
              />
              {step1Form.formState.errors.phone && (
                <p className="mt-1 text-xs text-red-600">{step1Form.formState.errors.phone.message}</p>
              )}
              <p className="mt-1 text-xs text-gray-500">Include country code, e.g. +234</p>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Email <span className="text-gray-400 font-normal">(optional)</span>
              </label>
              <input
                {...step1Form.register('email')}
                type="email"
                inputMode="email"
                autoComplete="email"
                placeholder="you@example.com"
                className="input-base"
              />
              {step1Form.formState.errors.email && (
                <p className="mt-1 text-xs text-red-600">{step1Form.formState.errors.email.message}</p>
              )}
            </div>

            <button type="submit" className="btn-primary w-full mt-2">Next</button>
          </form>
        )}

        {/* ── Step 2: Farm details ── */}
        {step === 1 && (
          <form onSubmit={step2Form.handleSubmit(onStep2Submit)} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Farm Name</label>
              <input
                {...step2Form.register('farmName')}
                type="text"
                placeholder="My Farm"
                className="input-base"
              />
              {step2Form.formState.errors.farmName && (
                <p className="mt-1 text-xs text-red-600">{step2Form.formState.errors.farmName.message}</p>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Currency</label>
              <select {...step2Form.register('currency')} className="input-base">
                {CURRENCIES.map(c => (
                  <option key={c.code} value={c.code}>{c.code} — {c.name}</option>
                ))}
              </select>
              {step2Form.formState.errors.currency && (
                <p className="mt-1 text-xs text-red-600">{step2Form.formState.errors.currency.message}</p>
              )}
            </div>

            <button type="submit" className="btn-primary w-full mt-2">Next</button>
          </form>
        )}

        {/* ── Step 3: Password ── */}
        {step === 2 && (
          <form onSubmit={step3Form.handleSubmit(onStep3Submit)} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Password</label>
              <div className="relative">
                <input
                  {...step3Form.register('password')}
                  type={showPassword ? 'text' : 'password'}
                  autoComplete="new-password"
                  placeholder="At least 6 characters"
                  className="input-base pr-10"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(v => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400"
                >
                  {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
              {step3Form.formState.errors.password && (
                <p className="mt-1 text-xs text-red-600">{step3Form.formState.errors.password.message}</p>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Confirm Password</label>
              <div className="relative">
                <input
                  {...step3Form.register('confirmPassword')}
                  type={showConfirm ? 'text' : 'password'}
                  autoComplete="new-password"
                  placeholder="Re-enter password"
                  className="input-base pr-10"
                />
                <button
                  type="button"
                  onClick={() => setShowConfirm(v => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400"
                >
                  {showConfirm ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
              {step3Form.formState.errors.confirmPassword && (
                <p className="mt-1 text-xs text-red-600">{step3Form.formState.errors.confirmPassword.message}</p>
              )}
            </div>

            <button type="submit" disabled={isLoading} className="btn-primary w-full mt-2">
              {isLoading
                ? <Loader2 size={20} className="mx-auto animate-spin" />
                : 'Create Account'}
            </button>
          </form>
        )}

        {/* Sign in link */}
        <div className="mt-8 text-center pb-6">
          <span className="text-sm text-gray-500">Already have an account? </span>
          <button
            onClick={() => navigate('/auth/signin')}
            className="text-sm text-primary-600 font-medium"
          >
            Sign In
          </button>
        </div>
      </div>
    </div>
  )
}
