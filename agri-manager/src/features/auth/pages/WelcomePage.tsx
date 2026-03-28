import { useNavigate } from 'react-router-dom'
import { Wheat, Users, HardHat } from 'lucide-react'

export default function WelcomePage() {
  const navigate = useNavigate()

  return (
    <div className="h-dvh flex flex-col bg-gradient-to-b from-primary-700 to-primary-900 px-6 safe-top safe-bottom">
      {/* Branding */}
      <div className="flex-1 flex flex-col items-center justify-center text-center">
        <div className="bg-white/10 rounded-3xl p-6 mb-6">
          <Wheat size={56} className="text-accent" />
        </div>
        <h1 className="text-4xl font-bold text-white mb-2">
          AgriManager<span
            className="font-black italic"
            style={{
              background: 'linear-gradient(135deg, #fde68a 0%, #f59e0b 40%, #f97316 75%, #ef4444 100%)',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
              backgroundClip: 'text',
              textShadow: 'none',
              display: 'inline-block',
              transform: 'scaleX(1.1)',
              transformOrigin: 'left',
            }}
          >X</span>
        </h1>
        <p className="text-primary-200 text-base">Your complete farm operations companion</p>

        <div className="mt-10 space-y-3 text-left w-full max-w-xs">
          {[
            { icon: '📊', text: 'Track daily production & health' },
            { icon: '💰', text: 'Monitor finances and inventory' },
            { icon: '📶', text: 'Works offline, syncs when connected' },
          ].map(f => (
            <div key={f.text} className="flex items-center gap-3 text-white/80 text-sm">
              <span className="text-xl">{f.icon}</span>
              <span>{f.text}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Role sections */}
      <div className="pb-8 space-y-3">

        {/* Farm Owner */}
        <div className="bg-white/10 rounded-2xl p-4 border border-white/20">
          <div className="flex items-center gap-2 mb-3">
            <div className="w-7 h-7 bg-accent/20 rounded-lg flex items-center justify-center">
              <Users size={15} className="text-accent" />
            </div>
            <p className="text-sm font-semibold text-white">Farm Owner</p>
          </div>
          <div className="flex gap-2">
            <button
              className="flex-1 bg-accent text-primary-900 font-semibold rounded-xl px-4 py-3 text-sm active:opacity-80 transition-opacity"
              onClick={() => navigate('/auth/signin')}
            >
              Sign In
            </button>
            <button
              className="flex-1 bg-white/15 text-white font-semibold rounded-xl px-4 py-3 text-sm border border-white/30 active:bg-white/25 transition-colors"
              onClick={() => navigate('/auth/signup')}
            >
              Create Account
            </button>
          </div>
        </div>

        {/* Divider */}
        <div className="flex items-center gap-3 px-2">
          <div className="flex-1 h-px bg-white/20" />
          <span className="text-white/40 text-xs font-medium">or</span>
          <div className="flex-1 h-px bg-white/20" />
        </div>

        {/* Farm Worker */}
        <div className="bg-white/10 rounded-2xl p-4 border border-white/20">
          <div className="flex items-center gap-2 mb-3">
            <div className="w-7 h-7 bg-white/20 rounded-lg flex items-center justify-center">
              <HardHat size={15} className="text-white/80" />
            </div>
            <p className="text-sm font-semibold text-white">Farm Worker</p>
          </div>
          <button
            className="w-full bg-white/15 text-white font-semibold rounded-xl px-4 py-3 text-sm border border-white/30 active:bg-white/25 transition-colors"
            onClick={() => navigate('/auth/accept-invite')}
          >
            Worker Sign In
          </button>
        </div>

      </div>
    </div>
  )
}
