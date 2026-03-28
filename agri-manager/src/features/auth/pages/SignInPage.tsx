import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { ChevronLeft, Eye, EyeOff, Loader2 } from 'lucide-react'
import { useAuthStore } from '../../../stores/auth-store'

// ── Schemas ───────────────────────────────────────────────────────────────────

const emailSchema = z.object({
  email: z.string().min(1, 'Email is required').email('Enter a valid email'),
  password: z.string().min(1, 'Password is required'),
})

const phoneSchema = z.object({
  phone: z.string().min(7, 'Enter a valid phone number'),
})

const otpSchema = z.object({
  otp: z.string().length(6, 'Enter the 6-digit code'),
})

type EmailForm = z.infer<typeof emailSchema>
type PhoneForm = z.infer<typeof phoneSchema>
type OtpForm = z.infer<typeof otpSchema>

// ── Component ─────────────────────────────────────────────────────────────────

export default function SignInPage() {
  const navigate = useNavigate()
  const { signInWithEmail, signInWithPhone, verifyOtp, isLoading, error, clearError } = useAuthStore()

  const [tab, setTab] = useState<'phone' | 'email'>('phone')
  const [phoneStep, setPhoneStep] = useState<'enter' | 'otp'>('enter')
  const [submittedPhone, setSubmittedPhone] = useState('')
  const [showPassword, setShowPassword] = useState(false)

  const emailForm = useForm<EmailForm>({ resolver: zodResolver(emailSchema) })
  const phoneForm = useForm<PhoneForm>({ resolver: zodResolver(phoneSchema) })
  const otpForm = useForm<OtpForm>({ resolver: zodResolver(otpSchema) })

  const handleTabChange = (t: 'phone' | 'email') => {
    clearError()
    setTab(t)
    setPhoneStep('enter')
  }

  const onEmailSubmit = async (data: EmailForm) => {
    await signInWithEmail(data.email, data.password)
    // On success GuestRoute auto-redirects to /dashboard
  }

  const onPhoneSubmit = async (data: PhoneForm) => {
    const phone = data.phone.startsWith('+') ? data.phone : `+${data.phone}`
    await signInWithPhone(phone)
    if (!useAuthStore.getState().error) {
      setSubmittedPhone(phone)
      setPhoneStep('otp')
    }
  }

  const onOtpSubmit = async (data: OtpForm) => {
    await verifyOtp(submittedPhone, data.otp)
    // On success GuestRoute auto-redirects to /dashboard
  }

  const handleResend = () => {
    clearError()
    otpForm.reset()
    phoneForm.setValue('phone', submittedPhone.replace(/^\+/, ''))
    setPhoneStep('enter')
  }

  return (
    <div className="h-dvh flex flex-col bg-white safe-top safe-bottom">
      {/* Header */}
      <div className="flex items-center gap-2 px-4 pt-4 pb-2">
        <button
          onClick={() => navigate('/auth/welcome')}
          className="touch-target text-gray-600 rounded-lg"
        >
          <ChevronLeft size={24} />
        </button>
        <div>
          <h1 className="text-xl font-bold text-gray-900">Owner Sign In</h1>
          <p className="text-xs text-gray-400">Farm owner account</p>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-6 pt-4">
        {/* Tab toggle */}
        <div className="flex bg-gray-100 rounded-xl p-1 mb-6">
          {(['phone', 'email'] as const).map(t => (
            <button
              key={t}
              onClick={() => handleTabChange(t)}
              className={`flex-1 py-2 rounded-lg text-sm font-medium transition-colors ${
                tab === t
                  ? 'bg-white text-primary-700 shadow-sm'
                  : 'text-gray-500'
              }`}
            >
              {t === 'phone' ? 'Phone Number' : 'Email'}
            </button>
          ))}
        </div>

        {/* Error banner */}
        {error && (
          <div className="mb-4 px-4 py-3 bg-red-50 border border-red-200 rounded-xl text-sm text-red-700">
            {error}
          </div>
        )}

        {/* Email form */}
        {tab === 'email' && (
          <form onSubmit={emailForm.handleSubmit(onEmailSubmit)} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
              <input
                {...emailForm.register('email')}
                type="email"
                inputMode="email"
                autoComplete="email"
                placeholder="you@example.com"
                className="input-base"
              />
              {emailForm.formState.errors.email && (
                <p className="mt-1 text-xs text-red-600">{emailForm.formState.errors.email.message}</p>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Password</label>
              <div className="relative">
                <input
                  {...emailForm.register('password')}
                  type={showPassword ? 'text' : 'password'}
                  autoComplete="current-password"
                  placeholder="••••••"
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
              {emailForm.formState.errors.password && (
                <p className="mt-1 text-xs text-red-600">{emailForm.formState.errors.password.message}</p>
              )}
            </div>

            <button
              type="button"
              onClick={() => navigate('/auth/forgot-password')}
              className="text-sm text-primary-600 font-medium"
            >
              Forgot password?
            </button>

            <button type="submit" disabled={isLoading} className="btn-primary w-full">
              {isLoading
                ? <Loader2 size={20} className="mx-auto animate-spin" />
                : 'Sign In'}
            </button>
          </form>
        )}

        {/* Phone — enter number */}
        {tab === 'phone' && phoneStep === 'enter' && (
          <form onSubmit={phoneForm.handleSubmit(onPhoneSubmit)} className="space-y-4">
            <div>
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

            <button type="submit" disabled={isLoading} className="btn-primary w-full">
              {isLoading
                ? <Loader2 size={20} className="mx-auto animate-spin" />
                : 'Send Code'}
            </button>
          </form>
        )}

        {/* Phone — enter OTP */}
        {tab === 'phone' && phoneStep === 'otp' && (
          <form onSubmit={otpForm.handleSubmit(onOtpSubmit)} className="space-y-4">
            <p className="text-sm text-gray-600">
              Enter the 6-digit code sent to{' '}
              <span className="font-medium text-gray-900">{submittedPhone}</span>
            </p>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Verification Code</label>
              <input
                {...otpForm.register('otp')}
                type="text"
                inputMode="numeric"
                autoComplete="one-time-code"
                maxLength={6}
                placeholder="000000"
                className="input-base text-center text-2xl tracking-widest"
              />
              {otpForm.formState.errors.otp && (
                <p className="mt-1 text-xs text-red-600">{otpForm.formState.errors.otp.message}</p>
              )}
            </div>

            <button type="submit" disabled={isLoading} className="btn-primary w-full">
              {isLoading
                ? <Loader2 size={20} className="mx-auto animate-spin" />
                : 'Verify'}
            </button>

            <button
              type="button"
              onClick={handleResend}
              className="w-full text-sm text-primary-600 font-medium py-2"
            >
              Resend code
            </button>
          </form>
        )}

        {/* Sign up link */}
        <div className="mt-8 text-center pb-6">
          <span className="text-sm text-gray-500">Don't have an account? </span>
          <button
            onClick={() => navigate('/auth/signup')}
            className="text-sm text-primary-600 font-medium"
          >
            Create one
          </button>
        </div>
      </div>
    </div>
  )
}
