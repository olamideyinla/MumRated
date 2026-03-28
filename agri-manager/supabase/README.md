# AgriManagerX — Supabase Setup

## Prerequisites
- Supabase project created (free tier or Pro)
- Supabase CLI installed: `npm install -g supabase`

## Run Migrations (in order)
```bash
supabase db push
# or manually via the SQL editor:
# 001_initial_schema.sql
# 002_rls_policies.sql
# 002_seed_data.sql
# 003_functions.sql
```

---

## Storage — `farm-photos` Bucket

### 1. Create the bucket

Run in the Supabase SQL editor:

```sql
-- Create bucket (private by default)
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'farm-photos',
  'farm-photos',
  FALSE,                          -- private; served via signed URLs
  5242880,                        -- 5 MB per file
  ARRAY['image/jpeg', 'image/png', 'image/webp']
);
```

### 2. Storage RLS policies

Users may **upload** and **read** files only within their own organisation's folder.
The path convention is: `farm-photos/{organizationId}/{filename}`.

```sql
-- ── Upload (INSERT) ──────────────────────────────────────────────────────────
CREATE POLICY "org members can upload farm photos"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'farm-photos'
  AND (storage.foldername(name))[1] = get_user_org_id()::text
);

-- ── Download (SELECT) ────────────────────────────────────────────────────────
CREATE POLICY "org members can read farm photos"
ON storage.objects FOR SELECT
TO authenticated
USING (
  bucket_id = 'farm-photos'
  AND (storage.foldername(name))[1] = get_user_org_id()::text
);

-- ── Update ───────────────────────────────────────────────────────────────────
CREATE POLICY "org members can update farm photos"
ON storage.objects FOR UPDATE
TO authenticated
USING (
  bucket_id = 'farm-photos'
  AND (storage.foldername(name))[1] = get_user_org_id()::text
);

-- ── Delete ───────────────────────────────────────────────────────────────────
CREATE POLICY "org members can delete farm photos"
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = 'farm-photos'
  AND (storage.foldername(name))[1] = get_user_org_id()::text
);
```

### 3. Client-side upload example

```typescript
import { supabase } from '../core/config/supabase'
import { useAuthStore } from '../stores/auth-store'

async function uploadPhoto(file: File, filename: string): Promise<string | null> {
  const orgId = useAuthStore.getState().appUser?.organizationId
  if (!orgId) return null

  const path = `${orgId}/${Date.now()}-${filename}`
  const { error } = await supabase.storage.from('farm-photos').upload(path, file, {
    contentType: file.type,
    upsert: false,
  })
  if (error) throw error
  return path
}

async function getPhotoUrl(path: string): Promise<string> {
  const { data } = await supabase.storage
    .from('farm-photos')
    .createSignedUrl(path, 3600)   // 1 hour
  return data?.signedUrl ?? ''
}
```

---

## Edge Functions

### Deploy
```bash
supabase functions deploy weekly-report
supabase functions deploy alert-check
```

### Secrets required
Set via Supabase dashboard → Project Settings → Edge Functions → Secrets, or:

```bash
supabase secrets set RESEND_API_KEY=re_xxxx
supabase secrets set APP_URL=https://your-app.vercel.app
```

| Secret | Used by | Description |
|--------|---------|-------------|
| `RESEND_API_KEY` | weekly-report | Resend.com API key for sending emails |
| `APP_URL` | weekly-report | Public URL of the deployed PWA |
| `SUPABASE_URL` | both | Auto-set by Supabase runtime |
| `SUPABASE_SERVICE_ROLE_KEY` | both | Auto-set by Supabase runtime |

### Schedule (pg_cron)

Run in the SQL editor after functions are deployed:

```sql
-- Weekly report — every Monday at 06:00 UTC
SELECT cron.schedule(
  'weekly-farm-report',
  '0 6 * * 1',
  $$
    SELECT net.http_post(
      url      := current_setting('app.supabase_url') || '/functions/v1/weekly-report',
      headers  := jsonb_build_object(
                    'Content-Type',  'application/json',
                    'Authorization', 'Bearer ' || current_setting('app.service_role_key')
                  ),
      body     := '{}'::jsonb
    );
  $$
);

-- Alert check — every hour at :05
SELECT cron.schedule(
  'hourly-alert-check',
  '5 * * * *',
  $$
    SELECT net.http_post(
      url      := current_setting('app.supabase_url') || '/functions/v1/alert-check',
      headers  := jsonb_build_object(
                    'Content-Type',  'application/json',
                    'Authorization', 'Bearer ' || current_setting('app.service_role_key')
                  ),
      body     := '{}'::jsonb
    );
  $$
);
```

> **Note**: `pg_cron` and `pg_net` must be enabled in your Supabase project (Database → Extensions).

---

## Environment Variables (PWA)

Create `.env.local` in the project root:

```
VITE_SUPABASE_URL=https://xxxx.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

These are read by `src/core/config/supabase.ts`.
