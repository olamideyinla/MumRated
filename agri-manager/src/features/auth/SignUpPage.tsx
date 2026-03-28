import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { supabase } from '../../core/config/supabase'
import { seedInitialData } from '../../core/database/seed'
import { useAuthStore } from '../../stores/auth-store'

export default function SignUpPage() {
  const navigate = useNavigate()
  const setSession = useAuthStore(s => s.setSession)
  const [form, setForm] = useState({ fullName: '', farmName: '', email: '', password: '' })
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError(null)
    const { data, error } = await supabase.auth.signUp({ email: form.email, password: form.password })
    if (error) { setError(error.message); setLoading(false); return }
    if (data.session && data.user) {
      await seedInitialData({ userId: data.user.id, email: form.email, fullName: form.fullName, orgName: form.farmName })
      setSession(data.session)
      navigate('/farm-setup')
    }
  }

  return (
    <div className="min-h-dvh bg-primary-500 flex flex-col items-center justify-center p-6">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <div className="text-5xl mb-3">🌾</div>
          <h1 className="text-2xl font-bold text-white">Create Account</h1>
          <p className="text-primary-200 text-sm mt-1">Set up your farm management</p>
        </div>
        <div className="bg-white rounded-2xl p-6 shadow-lg">
          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 rounded-xl px-4 py-3 text-sm mb-4">{error}</div>
          )}
          <form onSubmit={handleSubmit} className="space-y-4">
            {(['fullName', 'farmName', 'email', 'password'] as const).map(field => (
              <div key={field}>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  {field === 'fullName' ? 'Full Name' : field === 'farmName' ? 'Farm Name' : field === 'email' ? 'Email' : 'Password'}
                </label>
                <input
                  type={field === 'password' ? 'password' : field === 'email' ? 'email' : 'text'}
                  value={form[field]}
                  onChange={e => setForm(f => ({ ...f, [field]: e.target.value }))}
                  className="input-base"
                  required
                />
              </div>
            ))}
            <button type="submit" disabled={loading} className="btn-primary w-full mt-2">
              {loading ? 'Creating account…' : 'Create Account'}
            </button>
          </form>
          <p className="text-center text-sm text-gray-500 mt-4">
            Have an account?{' '}
            <Link to="/sign-in" className="text-primary-600 font-medium">Sign in</Link>
          </p>
        </div>
      </div>
    </div>
  )
}
