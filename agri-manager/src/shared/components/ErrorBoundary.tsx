import React from 'react'
import { AlertTriangle } from 'lucide-react'
import * as Sentry from '@sentry/react'

interface Props {
  children: React.ReactNode
}

interface State {
  error: Error | null
}

function ErrorFallback({ error, onReset }: { error: Error; onReset: () => void }) {
  return (
    <div className="min-h-dvh flex items-center justify-center p-6">
      <div className="card max-w-sm w-full text-center space-y-4">
        <div className="w-14 h-14 bg-red-50 rounded-full flex items-center justify-center mx-auto">
          <AlertTriangle className="w-7 h-7 text-red-500" />
        </div>
        <div>
          <h2 className="text-base font-bold text-gray-900">Something went wrong</h2>
          <p className="text-sm text-gray-500 mt-1 font-mono break-all">{error.message}</p>
        </div>
        <div className="flex flex-col gap-2">
          <button onClick={onReset} className="btn-primary w-full">
            Try Again
          </button>
          <a
            href="mailto:support@agrimanager.app"
            className="text-sm text-primary-600 underline"
          >
            Report Issue
          </a>
        </div>
      </div>
    </div>
  )
}

export class ErrorBoundary extends React.Component<Props, State> {
  state: State = { error: null }

  static getDerivedStateFromError(error: Error): State {
    return { error }
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error('[ErrorBoundary]', error, info)
    Sentry.captureException(error, {
      extra: { componentStack: info.componentStack },
    })
  }

  render() {
    if (this.state.error) {
      return (
        <ErrorFallback
          error={this.state.error}
          onReset={() => this.setState({ error: null })}
        />
      )
    }
    return this.props.children
  }
}
