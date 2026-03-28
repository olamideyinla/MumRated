export const env = {
  supabaseUrl:     import.meta.env.VITE_SUPABASE_URL    as string,
  supabaseAnonKey: import.meta.env.VITE_SUPABASE_ANON_KEY as string,
  environment: (import.meta.env.VITE_ENV ?? 'development') as 'development' | 'staging' | 'production',
  isDevelopment: import.meta.env.DEV,
  isProduction:  import.meta.env.PROD,
  appVersion:    (import.meta.env.VITE_APP_VERSION ?? '0.1.0') as string,
  sentryDsn:     (import.meta.env.VITE_SENTRY_DSN || undefined) as string | undefined,
  plausibleDomain: (import.meta.env.VITE_PLAUSIBLE_DOMAIN || undefined) as string | undefined,
}
