import { useNavigate } from 'react-router-dom'
import { ArrowLeft, ChevronRight } from 'lucide-react'

const TOOLS = [
  {
    to: '/decision/broiler-sell',
    emoji: '🐔',
    title: 'Sell or Wait?',
    subtitle: 'Broiler scenario calculator',
    desc: 'Compare selling now vs waiting to target weight — see exact $ difference.',
    color: 'bg-orange-50 border-orange-200',
    accent: 'text-orange-700',
  },
  {
    to: '/decision/layer-depletion',
    emoji: '🥚',
    title: 'When to Deplete?',
    subtitle: 'Layer flock analysis',
    desc: 'Find the optimal week to replace your flock before margins go negative.',
    color: 'bg-amber-50 border-amber-200',
    accent: 'text-amber-700',
  },
  {
    to: '/decision/batch-planner',
    emoji: '📋',
    title: 'Plan a New Batch',
    subtitle: 'Week-by-week projections',
    desc: 'Project feed, costs, revenue and ROI before you start a new cycle.',
    color: 'bg-green-50 border-green-200',
    accent: 'text-green-700',
  },
  {
    to: '/decision/benchmark',
    emoji: '📊',
    title: 'Compare Performance',
    subtitle: 'Benchmarking tool',
    desc: 'Radar chart showing how your batches stack up vs breed standards.',
    color: 'bg-blue-50 border-blue-200',
    accent: 'text-blue-700',
  },
  {
    to: '/decision/calendar',
    emoji: '📅',
    title: 'Farm Calendar',
    subtitle: 'Planning calendar',
    desc: 'Visual timeline of all batches, scheduled events, and conflicts.',
    color: 'bg-purple-50 border-purple-200',
    accent: 'text-purple-700',
  },
]

export default function DecisionToolsPage() {
  const navigate = useNavigate()

  return (
    <div className="min-h-dvh bg-gray-50">
      <div className="bg-primary-600 px-4 pt-safe-top pb-5">
        <div className="flex items-center gap-3 mt-2">
          <button onClick={() => navigate(-1)} className="w-10 h-10 flex items-center justify-center text-white/80 hover:text-white -ml-2">
            <ArrowLeft size={22} />
          </button>
          <div>
            <h1 className="text-white text-xl font-bold leading-tight">Decision Tools</h1>
            <p className="text-white/70 text-sm">Data-driven insights, offline ready</p>
          </div>
        </div>
      </div>

      <div className="px-4 py-4 space-y-3">
        {TOOLS.map(({ to, emoji, title, subtitle, desc, color, accent }) => (
          <button
            key={to}
            onClick={() => navigate(to)}
            className={`w-full text-left rounded-2xl border p-4 flex items-start gap-3 active:scale-[0.98] transition-transform ${color}`}
          >
            <span className="text-3xl mt-0.5 shrink-0">{emoji}</span>
            <div className="flex-1 min-w-0">
              <p className={`font-bold text-base leading-tight ${accent}`}>{title}</p>
              <p className="text-xs font-medium text-gray-500 mt-0.5">{subtitle}</p>
              <p className="text-sm text-gray-600 mt-1 leading-snug">{desc}</p>
            </div>
            <ChevronRight className="w-4 h-4 text-gray-400 mt-1 shrink-0" />
          </button>
        ))}
      </div>
    </div>
  )
}
