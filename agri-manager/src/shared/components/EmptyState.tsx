import { Link } from 'react-router-dom'
import { Sprout, Package, TrendingUp, FileText, type LucideIcon } from 'lucide-react'

interface EmptyStateProps {
  icon: LucideIcon
  title: string
  description?: string
  action?: { label: string; href: string }
}

export function EmptyState({ icon: Icon, title, description, action }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center py-16 px-6 text-center">
      <div className="w-16 h-16 bg-primary-100 dark:bg-primary-900/30 rounded-full flex items-center justify-center mb-4">
        <Icon className="w-8 h-8 text-primary-600 dark:text-primary-400" />
      </div>
      <h3 className="text-base font-semibold text-gray-800 dark:text-gray-200">{title}</h3>
      {description && (
        <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">{description}</p>
      )}
      {action && (
        <Link
          to={action.href}
          className="mt-4 btn-primary inline-block text-center"
        >
          {action.label}
        </Link>
      )}
    </div>
  )
}

export function EmptyStateDashboard() {
  return (
    <EmptyState
      icon={Sprout}
      title="No active batches yet"
      description="Set up your farm and add your first enterprise to see your dashboard."
      action={{ label: 'Set Up Farm', href: '/farm-setup' }}
    />
  )
}

export function EmptyStateInventory() {
  return (
    <EmptyState
      icon={Package}
      title="No inventory items"
      description="Add items to track stock levels, consumption and reorder points."
    />
  )
}

export function EmptyStateFinancials() {
  return (
    <EmptyState
      icon={TrendingUp}
      title="No transactions yet"
      description="Record income and expenses to see your financial summary."
    />
  )
}

export function EmptyStateReports() {
  return (
    <EmptyState
      icon={FileText}
      title="No data to report"
      description="Start recording daily entries to generate meaningful reports."
    />
  )
}
