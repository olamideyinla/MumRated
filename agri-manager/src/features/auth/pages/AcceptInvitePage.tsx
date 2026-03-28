import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { ChevronLeft, Loader2, KeyRound } from 'lucide-react'
import { useAuthStore } from '../../../stores/auth-store'

// ── Schemas ───────────────────────────────────────────────────────────────────

const phoneSchema = z.object({
  phone: z.string().min(7, 'Enter a valid phone number'),
})

const codeSchema = z.object({
  inviteCode: z.string().min(4, 'Enter the invite code').max(10),
})

type PhoneForm = z.infer<typeof phoneSchema>
type CodeForm  = z.infer<typeof codeSchema>

// ── Component ─────────────────────────────────────────────────────────────────

export default function AcceptInvitePage() {
  const navigate = useNavigate()
  const { acceptInvite, isLoading, error, clearError } = useAuthStore()

  const [step, setStep]         = useState<'phone' | 'code'>('phone')
  const [submittedPhone, setPhone] = useState('')

  // Clear any stale error from a previous attempt whenever this page mounts
  useEffect(() => { clearError() }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const phoneForm = useForm<PhoneForm>({ resolver: zodResolver(phoneSchema) })
  const codeForm  = useForm<CodeForm> ({ resolver: zodResolver(codeSchema)  })

  const onPhoneSubmit = (data: PhoneForm) => {
    const phone = data.phone.startsWith('+') ? data.phone : `+${data.phone}`
    setPhone(phone)
    clearError()
    setStep('code')
  }

  const onCodeSubmit = async (data: CodeForm) => {
    await acceptInvite(submittedPhone, data.inviteCode)
    // isAuthenticated becomes true → GuestRoute auto-redirects to /dashboard
  }

  const stepNumber = step === 'phone' ? 1 : 2

  return (
    <div className="h-dvh flex flex-col bg-white safe-top safe-bottom">
      {/* Header */}
      <div className="flex items-center gap-2 px-4 pt-4 pb-2">
        <button
          onClick={() => {
            if (step === 'phone') {
              navigate('/auth/welcome')
            } else {
              clearError()
              setStep('phone')
            }
          }}
          className="touch-target text-gray-600 rounded-lg"
        >
          <ChevronLeft size={24} />
        </button>
        <div>
          <h1 className="text-xl font-bold text-gray-900">Worker Sign In</h1>
          <p className="text-xs text-gray-400">Step {stepNumber} of 2</p>
        </div>
      </div>

      {/* Step progress */}
      <div className="flex gap-1.5 px-6 mb-6">
        {[1, 2].map(n => (
          <div
            key={n}
            className={`h-1 flex-1 rounded-full transition-colors ${
              n <= stepNumber ? 'bg-primary-600' : 'bg-gray-200'
            }`}
          />
        ))}
      </div>

      <div className="flex-1 overflow-y-auto px-6">
        {/* Error banner */}
        {error && (
          <div className="mb-4 px-4 py-3 bg-red-50 border border-red-200 rounded-xl text-sm text-red-700">
            {error}
          </div>
        )}

        {/* ── Step 1: Phone number ─────────────────────────────────────────── */}
        {step === 'phone' && (
          <form onSubmit={phoneForm.handleSubmit(onPhoneSubmit)} className="space-y-5">
            <div>
              <h2 className="text-base font-semibold text-gray-800 mb-0.5">Enter your phone number</h2>
              <p className="text-sm text-gray-500 mb-4">
                Use the phone number your farm owner registered you with.
              </p>
              <label className="block text-sm font-medium text-gray-700 mb-1">Phone Number</label>
              <input
                {...phoneForm.register('phone')}
                type="tel"
                inputMode="tel"
                autoComplete="tel"
                placeholder="+1 555 000 0000"
                className="input-base"
              />
              {phoneForm.formState.errors.phone && (
                <p className="mt-1 text-xs text-red-600">{phoneForm.formState.errors.phone.message}</p>
              )}
              <p className="mt-1 text-xs text-gray-500">Include country code, e.g. +1, +44, +234</p>
            </div>

            <button type="submit" className="btn-primary w-full">
              Next
            </button>
          </form>
        )}

        {/* ── Step 2: Invite code ───────────────────────────────────────────── */}
        {step === 'code' && (
          <form onSubmit={codeForm.handleSubmit(onCodeSubmit)} className="space-y-5">
            <div className="flex flex-col items-center text-center mb-6">
              <div className="w-16 h-16 bg-primary-50 rounded-2xl flex items-center justify-center mb-3">
                <KeyRound size={28} className="text-primary-600" />
              </div>
              <h2 className="text-base font-semibold text-gray-800">Enter your access code</h2>
              <p className="text-sm text-gray-500 mt-1">
                New workers: use the code from your invitation message.
                Returning workers: use the same code you joined with.
              </p>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Access Code</label>
              <input
                {...codeForm.register('inviteCode')}
                type="text"
                autoCapitalize="characters"
                autoComplete="off"
                maxLength={10}
                placeholder="e.g. XK7R4M"
                className="input-base text-center text-2xl tracking-widest uppercase"
                onChange={e => codeForm.setValue('inviteCode', e.target.value.toUpperCase())}
              />
              {codeForm.formState.errors.inviteCode && (
                <p className="mt-1 text-xs text-red-600">{codeForm.formState.errors.inviteCode.message}</p>
              )}
            </div>

            <button type="submit" disabled={isLoading} className="btn-primary w-full">
              {isLoading ? <Loader2 size={20} className="mx-auto animate-spin" /> : 'Join Farm'}
            </button>
          </form>
        )}
      </div>
    </div>
  )
}
