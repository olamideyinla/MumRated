import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { ChevronLeft, CheckCircle, Loader2 } from 'lucide-react'
import { supabase } from '../../../core/config/supabase'

const schema = z.object({
  email: z.string().min(1, 'Email is required').email('Enter a valid email'),
})

type FormData = z.infer<typeof schema>

export default function ForgotPasswordPage() {
  const navigate = useNavigate()
  const [sent, setSent] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const { register, handleSubmit, formState: { errors } } = useForm<FormData>({
    resolver: zodResolver(schema),
  })

  const onSubmit = async (data: FormData) => {
    setIsLoading(true)
    setError(null)
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(data.email)
      if (error) { setError(error.message); return }
      setSent(true)
    } catch (e: unknown) {
      setError((e as Error)?.message ?? 'Something went wrong. Please try again.')
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="h-dvh flex flex-col bg-white safe-top safe-bottom">
      {/* Header */}
      <div className="flex items-center gap-2 px-4 pt-4 pb-2">
        <button
          onClick={() => navigate('/auth/signin')}
          className="touch-target text-gray-600 rounded-lg"
        >
          <ChevronLeft size={24} />
        </button>
        <h1 className="text-xl font-bold text-gray-900">Forgot Password</h1>
      </div>

      <div className="flex-1 px-6 pt-6">
        {sent ? (
          /* Success state */
          <div className="flex flex-col items-center text-center pt-8">
            <div className="bg-emerald-50 rounded-full p-4 mb-4">
              <CheckCircle size={48} className="text-emerald-500" />
            </div>
            <h2 className="text-xl font-bold text-gray-900 mb-2">Check your inbox</h2>
            <p className="text-gray-500 text-sm max-w-xs">
              We've sent a password reset link to your email. Follow the instructions to set a new password.
            </p>
            <button
              onClick={() => navigate('/auth/signin')}
              className="btn-primary mt-8 px-8"
            >
              Back to Sign In
            </button>
          </div>
        ) : (
          /* Form */
          <>
            <p className="text-gray-500 text-sm mb-6">
              Enter your email address and we'll send you a link to reset your password.
            </p>

            {error && (
              <div className="mb-4 px-4 py-3 bg-red-50 border border-red-200 rounded-xl text-sm text-red-700">
                {error}
              </div>
            )}

            <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
                <input
                  {...register('email')}
                  type="email"
                  inputMode="email"
                  autoComplete="email"
                  placeholder="you@example.com"
                  className="input-base"
                />
                {errors.email && (
                  <p className="mt-1 text-xs text-red-600">{errors.email.message}</p>
                )}
              </div>

              <button type="submit" disabled={isLoading} className="btn-primary w-full">
                {isLoading
                  ? <Loader2 size={20} className="mx-auto animate-spin" />
                  : 'Send Reset Link'}
              </button>
            </form>
          </>
        )}
      </div>
    </div>
  )
}
