import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { supabase } from '../../core/config/supabase'
import { useAuthStore } from '../../stores/auth-store'

export default function SignInPage() {
  const navigate = useNavigate()
  const setSession = useAuthStore(s => s.setSession)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError(null)
    const { data, error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) { setError(error.message); setLoading(false); return }
    if (data.session) setSession(data.session)
    navigate('/dashboard')
  }

  return (
    <div className="min-h-dvh bg-primary-500 flex flex-col items-center justify-center p-6">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <div className="text-5xl mb-3">🌾</div>
          <h1 className="text-2xl font-bold text-white">
            AgriManager<span
              className="font-black italic"
              style={{
                background: 'linear-gradient(135deg, #fde68a 0%, #f59e0b 45%, #f97316 80%, #ef4444 100%)',
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
                backgroundClip: 'text',
                display: 'inline-block',
                transform: 'scaleX(1.1)',
                transformOrigin: 'left',
              }}
            >X</span>
          </h1>
          <p className="text-primary-200 text-sm mt-1">Sign in to your farm</p>
        </div>
        <div className="bg-white rounded-2xl p-6 shadow-lg">
          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 rounded-xl px-4 py-3 text-sm mb-4">
              {error}
            </div>
          )}
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
              <input type="email" value={email} onChange={e => setEmail(e.target.value)}
                className="input-base" placeholder="you@example.com" required />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Password</label>
              <input type="password" value={password} onChange={e => setPassword(e.target.value)}
                className="input-base" placeholder="••••••••" required />
            </div>
            <button type="submit" disabled={loading} className="btn-primary w-full mt-2">
              {loading ? 'Signing in…' : 'Sign In'}
            </button>
          </form>
          <p className="text-center text-sm text-gray-500 mt-4">
            No account?{' '}
            <Link to="/sign-up" className="text-primary-600 font-medium">Create one</Link>
          </p>
        </div>
      </div>
    </div>
  )
}
