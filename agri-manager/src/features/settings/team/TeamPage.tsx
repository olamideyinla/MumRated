import { useLiveQuery } from 'dexie-react-hooks'
import { useNavigate } from 'react-router-dom'
import { ChevronLeft, UserPlus, Crown, ShieldCheck, Hammer, Eye, Users, ScanEye } from 'lucide-react'
import { useAuthStore } from '../../../stores/auth-store'
import { db } from '../../../core/database/db'
import type { AppUser, UserRole } from '../../../shared/types'

// ── Role display helpers ──────────────────────────────────────────────────────

const ROLE_META: Record<UserRole, { label: string; color: string; Icon: typeof Crown }> = {
  owner:      { label: 'Owner',      color: 'bg-amber-100 text-amber-800',   Icon: Crown },
  manager:    { label: 'Manager',    color: 'bg-blue-100 text-blue-800',     Icon: ShieldCheck },
  supervisor: { label: 'Supervisor', color: 'bg-purple-100 text-purple-800', Icon: Hammer },
  worker:     { label: 'Worker',     color: 'bg-green-100 text-green-800',   Icon: Users },
  viewer:     { label: 'Viewer',     color: 'bg-gray-100 text-gray-700',     Icon: Eye },
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function TeamPage() {
  const navigate     = useNavigate()
  const appUser      = useAuthStore(s => s.appUser)
  const setViewingAs = useAuthStore(s => s.setViewingAs)
  const isOwner      = appUser?.role === 'owner'

  const handleViewAs = (member: AppUser) => {
    setViewingAs(member)
    navigate('/dashboard')
  }

  const members = useLiveQuery(async () => {
    if (!appUser) return []
    return db.appUsers
      .where('organizationId').equals(appUser.organizationId)
      .sortBy('fullName')
  }, [appUser?.organizationId])

  return (
    <div className="min-h-dvh bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 px-4 pt-safe-top">
        <div className="flex items-center gap-3 py-3">
          <button onClick={() => navigate(-1)} className="touch-target -ml-2">
            <ChevronLeft className="w-5 h-5 text-gray-500" />
          </button>
          <h1 className="text-lg font-semibold text-gray-900 flex-1">Team</h1>
          <button
            onClick={() => navigate('/team/invite')}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-primary-600 text-white rounded-lg text-sm font-medium"
          >
            <UserPlus className="w-4 h-4" />
            Invite
          </button>
        </div>
      </div>

      <div className="px-4 py-4">
        {!members || members.length === 0 ? (
          <div className="text-center py-16">
            <p className="text-4xl mb-3">👥</p>
            <p className="text-gray-500 text-sm">No team members yet</p>
          </div>
        ) : (
          <div className="card divide-y divide-gray-100">
            {members.map(member => {
              const meta = ROLE_META[member.role]
              const Icon = meta.Icon

              const isSelf = member.id === appUser?.id

              return (
                <div key={member.id} className="flex items-center">
                  <button
                    onClick={() => navigate(`/team/${member.id}`)}
                    className="flex-1 flex items-center gap-3 p-4 text-left hover:bg-gray-50 transition-colors"
                  >
                    {/* Avatar */}
                    <div className="w-10 h-10 rounded-full bg-primary-100 flex items-center justify-center shrink-0">
                      <span className="text-primary-700 font-bold text-sm">
                        {member.fullName.charAt(0).toUpperCase()}
                      </span>
                    </div>

                    {/* Info */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="text-sm font-semibold text-gray-900 truncate">{member.fullName}</p>
                        {!member.isActive && (
                          <span className="text-xs text-gray-400 bg-gray-100 px-1.5 py-0.5 rounded-full">
                            Inactive
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-gray-400 truncate mt-0.5">
                        {member.phone ?? member.email ?? 'No contact'}
                      </p>
                    </div>

                    {/* Role badge */}
                    <span className={`flex items-center gap-1 text-xs font-medium px-2 py-1 rounded-full ${meta.color} shrink-0`}>
                      <Icon className="w-3 h-3" />
                      {meta.label}
                    </span>
                  </button>

                  {/* View As button — owners only, not self */}
                  {isOwner && !isSelf && (
                    <button
                      onClick={() => handleViewAs(member)}
                      title={`View as ${member.fullName}`}
                      className="p-3 mr-1 text-gray-400 hover:text-primary-600 active:text-primary-700 transition-colors"
                    >
                      <ScanEye size={18} />
                    </button>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
