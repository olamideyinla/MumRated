/**
 * Privacy-first analytics via Plausible.
 * No cookies, no PII — only named events with optional non-identifying props.
 *
 * Plausible is loaded via a <script> tag in index.html when VITE_PLAUSIBLE_DOMAIN is set.
 * In development or when the domain is unset, all calls are no-ops.
 */

declare global {
  interface Window {
    plausible?: (
      event: string,
      options?: { props?: Record<string, string | number | boolean> },
    ) => void
  }
}

export type AnalyticsEvent =
  | 'app_opened'
  | 'data_entered'
  | 'report_generated'
  | 'sync_completed'
  | 'sync_failed'
  | 'install_prompt_accepted'
  | 'install_prompt_dismissed'
  | 'offline_session_started'
  | 'entry_saved'
  | 'alert_triggered'
  | 'export_csv'
  | 'export_pdf'

export function trackEvent(
  event: AnalyticsEvent,
  props?: Record<string, string | number | boolean>,
) {
  if (typeof window !== 'undefined' && typeof window.plausible === 'function') {
    window.plausible(event, props ? { props } : undefined)
  }
}
