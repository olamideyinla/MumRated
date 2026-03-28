/**
 * AgriManagerX — weekly-report Edge Function
 *
 * Runs every Monday at 06:00 UTC (scheduled via pg_cron).
 * For each organisation that has an active owner, generates a
 * plain-text + HTML weekly farm summary and sends it via Resend.
 *
 * Required secrets:
 *   RESEND_API_KEY   — Resend.com API key
 *   APP_URL          — Public URL of the deployed PWA
 *
 * Supabase injects SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY automatically.
 */

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

// ── Types ──────────────────────────────────────────────────────────────────────

interface OrgSummary {
  orgId: string
  orgName: string
  ownerEmail: string
  ownerName: string
  currency: string
}

interface WeeklyMetrics {
  activeEnterprises: number
  totalIncome: number
  totalExpenses: number
  netProfit: number
  pendingSyncCount: number
  lowStockCount: number
  activeAlerts: number
  enterprises: EnterpriseLine[]
}

interface EnterpriseLine {
  name: string
  type: string
  dayOrWeek: number
  keyMetric: string        // e.g. "HDP 82%", "FCR 1.72", "Yield 340 kg"
  mortalityPct: string     // e.g. "0.3%"
}

// ── Helper: Supabase admin client ─────────────────────────────────────────────

function adminClient() {
  return createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    { auth: { persistSession: false } }
  )
}

// ── Helper: fetch orgs with active owners ─────────────────────────────────────

async function getActiveOrgs(db: ReturnType<typeof adminClient>): Promise<OrgSummary[]> {
  const { data, error } = await db
    .from('app_users')
    .select('organization_id, full_name, email, organizations!inner(name, currency)')
    .eq('role', 'owner')
    .eq('is_active', true)
    .not('email', 'is', null)

  if (error) throw error

  return (data ?? []).map((row: any) => ({
    orgId:       row.organization_id,
    orgName:     row.organizations.name,
    ownerEmail:  row.email,
    ownerName:   row.full_name,
    currency:    row.organizations.currency ?? 'USD',
  }))
}

// ── Helper: gather weekly metrics for one org ─────────────────────────────────

async function getWeeklyMetrics(
  db: ReturnType<typeof adminClient>,
  orgId: string,
  weekStart: string,
  weekEnd: string,
  currency: string
): Promise<WeeklyMetrics> {
  // Active enterprises
  const { count: activeEnterprises } = await db
    .from('enterprise_instances')
    .select('id', { count: 'exact', head: true })
    .eq('status', 'active')
    .filter('infrastructures.farm_locations.organization_id', 'eq', orgId)

  // Financial summary for the week
  const { data: finData } = await db
    .from('financial_transactions')
    .select('type, amount')
    .eq('organization_id', orgId)
    .gte('date', weekStart)
    .lte('date', weekEnd)

  let totalIncome = 0
  let totalExpenses = 0
  for (const row of (finData ?? [])) {
    if (row.type === 'income')  totalIncome   += Number(row.amount)
    else                        totalExpenses += Number(row.amount)
  }

  // Low stock items
  const { count: lowStockCount } = await db
    .from('inventory_items')
    .select('id', { count: 'exact', head: true })
    .eq('organization_id', orgId)
    .filter('current_stock', 'lte', 'reorder_point')

  // Unread high/critical alerts
  const { count: activeAlerts } = await db
    .from('alerts')
    .select('id', { count: 'exact', head: true })
    .eq('organization_id', orgId)
    .eq('is_dismissed', false)
    .in('severity', ['critical', 'high'])

  // Per-enterprise headline metrics (layers + broilers)
  const enterprises = await getEnterpriseLines(db, orgId, weekEnd)

  return {
    activeEnterprises: activeEnterprises ?? 0,
    totalIncome,
    totalExpenses,
    netProfit: totalIncome - totalExpenses,
    pendingSyncCount: 0,     // server has no concept of pending sync
    lowStockCount: lowStockCount ?? 0,
    activeAlerts: activeAlerts ?? 0,
    enterprises,
  }
}

// ── Helper: per-enterprise headline lines ─────────────────────────────────────

async function getEnterpriseLines(
  db: ReturnType<typeof adminClient>,
  orgId: string,
  asOfDate: string
): Promise<EnterpriseLine[]> {
  const { data: ents } = await db
    .from('enterprise_instances')
    .select(`
      id, name, enterprise_type, start_date, current_stock_count,
      infrastructures!inner(farm_location_id, farm_locations!inner(organization_id))
    `)
    .eq('status', 'active')
    .eq('infrastructures.farm_locations.organization_id', orgId)
    .limit(10)

  if (!ents?.length) return []

  const lines: EnterpriseLine[] = []

  for (const ent of ents) {
    const startDate = new Date(ent.start_date)
    const asOf      = new Date(asOfDate)
    const dayOfBatch = Math.floor((asOf.getTime() - startDate.getTime()) / 86_400_000)
    const weekOfBatch = Math.floor(dayOfBatch / 7) + 1

    let keyMetric   = '—'
    let mortalityPct = '—'

    if (ent.enterprise_type === 'layers') {
      // Last 7-day HDP average
      const { data: recs } = await db
        .from('layer_daily_records')
        .select('total_eggs, mortality_count')
        .eq('enterprise_instance_id', ent.id)
        .gte('date', asOfDate)
        .lte('date', asOfDate)
        .order('date', { ascending: false })
        .limit(7)

      if (recs?.length) {
        const totalEggs  = recs.reduce((s: number, r: any) => s + (r.total_eggs ?? 0), 0)
        const deaths     = recs.reduce((s: number, r: any) => s + (r.mortality_count ?? 0), 0)
        const hdp        = ent.current_stock_count > 0
          ? (totalEggs / (recs.length * ent.current_stock_count) * 100).toFixed(1)
          : '—'
        keyMetric    = `HDP ${hdp}%`
        mortalityPct = ent.current_stock_count > 0
          ? `${(deaths / ent.current_stock_count * 100).toFixed(2)}%`
          : '—'
      }
    } else if (ent.enterprise_type === 'broilers') {
      // Last recorded body weight + FCR
      const { data: recs } = await db
        .from('broiler_daily_records')
        .select('feed_consumed_kg, mortality_count, body_weight_sample_avg')
        .eq('enterprise_instance_id', ent.id)
        .order('date', { ascending: false })
        .limit(7)

      if (recs?.length) {
        const totalFeed   = recs.reduce((s: number, r: any) => s + (r.feed_consumed_kg ?? 0), 0)
        const deaths      = recs.reduce((s: number, r: any) => s + (r.mortality_count ?? 0), 0)
        const latestWeight = recs[0]?.body_weight_sample_avg
        keyMetric    = latestWeight ? `Wt ${Number(latestWeight).toFixed(2)} kg` : `Day ${dayOfBatch}`
        mortalityPct = ent.current_stock_count > 0
          ? `${(deaths / ent.current_stock_count * 100).toFixed(2)}%`
          : '—'
      }
    }

    lines.push({
      name: ent.name,
      type: ent.enterprise_type,
      dayOrWeek: ent.enterprise_type === 'layers' ? weekOfBatch : dayOfBatch,
      keyMetric,
      mortalityPct,
    })
  }

  return lines
}

// ── Helper: format currency ───────────────────────────────────────────────────

function fmt(amount: number, currency: string): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency', currency, minimumFractionDigits: 2
  }).format(amount)
}

// ── Helper: build email HTML ──────────────────────────────────────────────────

function buildEmailHtml(
  org: OrgSummary,
  metrics: WeeklyMetrics,
  weekLabel: string,
  appUrl: string
): string {
  const green  = '#2D6A4F'
  const profit = metrics.netProfit >= 0

  const enterpriseRows = metrics.enterprises.length
    ? metrics.enterprises.map(e => `
      <tr>
        <td style="padding:6px 8px;border-bottom:1px solid #f0f0f0">${e.name}</td>
        <td style="padding:6px 8px;border-bottom:1px solid #f0f0f0;text-transform:capitalize">${e.type}</td>
        <td style="padding:6px 8px;border-bottom:1px solid #f0f0f0;text-align:center">${e.dayOrWeek}</td>
        <td style="padding:6px 8px;border-bottom:1px solid #f0f0f0;text-align:center">${e.keyMetric}</td>
        <td style="padding:6px 8px;border-bottom:1px solid #f0f0f0;text-align:center">${e.mortalityPct}</td>
      </tr>`).join('')
    : `<tr><td colspan="5" style="padding:12px;text-align:center;color:#999">No active enterprises</td></tr>`

  return `<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f5f5f5;font-family:Arial,sans-serif">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#f5f5f5;padding:24px 0">
<tr><td align="center">
<table width="600" cellpadding="0" cellspacing="0" style="background:#fff;border-radius:8px;overflow:hidden">

  <!-- Header -->
  <tr><td style="background:${green};padding:24px 32px">
    <h1 style="color:#fff;margin:0;font-size:22px">🌾 Weekly Farm Summary</h1>
    <p style="color:rgba(255,255,255,0.8);margin:4px 0 0">${org.orgName} — ${weekLabel}</p>
  </td></tr>

  <!-- Greeting -->
  <tr><td style="padding:24px 32px 0">
    <p style="margin:0;color:#333">Hi ${org.ownerName},</p>
    <p style="color:#555;margin:8px 0 0">Here is your farm's performance summary for the week.</p>
  </td></tr>

  <!-- KPI row -->
  <tr><td style="padding:24px 32px">
    <table width="100%" cellpadding="0" cellspacing="0">
    <tr>
      <td width="25%" align="center" style="background:#f8fdf9;border-radius:8px;padding:16px;margin:4px">
        <div style="font-size:11px;color:#666;text-transform:uppercase;letter-spacing:0.5px">Active Batches</div>
        <div style="font-size:28px;font-weight:bold;color:${green};margin-top:4px">${metrics.activeEnterprises}</div>
      </td>
      <td width="4%"></td>
      <td width="25%" align="center" style="background:#f8fdf9;border-radius:8px;padding:16px">
        <div style="font-size:11px;color:#666;text-transform:uppercase;letter-spacing:0.5px">Income</div>
        <div style="font-size:20px;font-weight:bold;color:${green};margin-top:4px">${fmt(metrics.totalIncome, org.currency)}</div>
      </td>
      <td width="4%"></td>
      <td width="25%" align="center" style="background:#f8fdf9;border-radius:8px;padding:16px">
        <div style="font-size:11px;color:#666;text-transform:uppercase;letter-spacing:0.5px">Expenses</div>
        <div style="font-size:20px;font-weight:bold;color:#e74c3c;margin-top:4px">${fmt(metrics.totalExpenses, org.currency)}</div>
      </td>
      <td width="4%"></td>
      <td width="25%" align="center" style="background:#f8fdf9;border-radius:8px;padding:16px">
        <div style="font-size:11px;color:#666;text-transform:uppercase;letter-spacing:0.5px">Net Profit</div>
        <div style="font-size:20px;font-weight:bold;color:${profit ? green : '#e74c3c'};margin-top:4px">${fmt(metrics.netProfit, org.currency)}</div>
      </td>
    </tr>
    </table>
  </td></tr>

  <!-- Enterprise table -->
  <tr><td style="padding:0 32px 24px">
    <h3 style="margin:0 0 12px;color:#333;font-size:14px">Enterprise Performance</h3>
    <table width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;font-size:13px">
      <thead>
        <tr style="background:#f0f7f4">
          <th style="padding:8px;text-align:left;color:#555;font-weight:600">Enterprise</th>
          <th style="padding:8px;text-align:left;color:#555;font-weight:600">Type</th>
          <th style="padding:8px;text-align:center;color:#555;font-weight:600">Day/Wk</th>
          <th style="padding:8px;text-align:center;color:#555;font-weight:600">Key Metric</th>
          <th style="padding:8px;text-align:center;color:#555;font-weight:600">Mortality</th>
        </tr>
      </thead>
      <tbody>${enterpriseRows}</tbody>
    </table>
  </td></tr>

  <!-- Alerts / stock -->
  ${(metrics.activeAlerts > 0 || metrics.lowStockCount > 0) ? `
  <tr><td style="padding:0 32px 24px">
    <table width="100%" cellpadding="0" cellspacing="0">
    ${metrics.activeAlerts > 0 ? `
      <tr><td style="background:#fff5f5;border-left:4px solid #e74c3c;padding:12px 16px;border-radius:4px;margin-bottom:8px">
        ⚠️ <strong>${metrics.activeAlerts}</strong> unread high/critical alert${metrics.activeAlerts > 1 ? 's' : ''} require your attention.
      </td></tr>` : ''}
    ${metrics.lowStockCount > 0 ? `
      <tr><td height="8"></td></tr>
      <tr><td style="background:#fffbf0;border-left:4px solid #f39c12;padding:12px 16px;border-radius:4px">
        📦 <strong>${metrics.lowStockCount}</strong> inventory item${metrics.lowStockCount > 1 ? 's' : ''} below reorder point.
      </td></tr>` : ''}
    </table>
  </td></tr>` : ''}

  <!-- CTA -->
  <tr><td style="padding:0 32px 32px;text-align:center">
    <a href="${appUrl}/dashboard"
       style="display:inline-block;background:${green};color:#fff;text-decoration:none;padding:12px 32px;border-radius:6px;font-weight:bold;font-size:14px">
      Open AgriManagerX →
    </a>
  </td></tr>

  <!-- Footer -->
  <tr><td style="background:#f9f9f9;padding:16px 32px;border-top:1px solid #eee;text-align:center">
    <p style="margin:0;font-size:11px;color:#999">
      AgriManagerX — automated weekly summary<br>
      You are receiving this because you are the owner of ${org.orgName}.
    </p>
  </td></tr>

</table>
</td></tr>
</table>
</body>
</html>`
}

// ── Helper: build plain-text email ────────────────────────────────────────────

function buildEmailText(org: OrgSummary, metrics: WeeklyMetrics, weekLabel: string): string {
  const lines = [
    `Weekly Farm Summary — ${org.orgName}`,
    `Week: ${weekLabel}`,
    `Hi ${org.ownerName},`,
    '',
    `Active batches : ${metrics.activeEnterprises}`,
    `Income         : ${fmt(metrics.totalIncome,  org.currency)}`,
    `Expenses       : ${fmt(metrics.totalExpenses, org.currency)}`,
    `Net Profit     : ${fmt(metrics.netProfit,    org.currency)}`,
    '',
  ]

  if (metrics.enterprises.length) {
    lines.push('ENTERPRISE PERFORMANCE')
    lines.push('Name | Type | Day/Wk | Key Metric | Mortality')
    for (const e of metrics.enterprises) {
      lines.push(`${e.name} | ${e.type} | ${e.dayOrWeek} | ${e.keyMetric} | ${e.mortalityPct}`)
    }
    lines.push('')
  }

  if (metrics.activeAlerts > 0) {
    lines.push(`⚠  ${metrics.activeAlerts} unread high/critical alert(s) require attention.`)
  }
  if (metrics.lowStockCount > 0) {
    lines.push(`📦 ${metrics.lowStockCount} inventory item(s) below reorder point.`)
  }

  return lines.join('\n')
}

// ── Helper: send email via Resend ─────────────────────────────────────────────

async function sendEmail(to: string, subject: string, html: string, text: string): Promise<void> {
  const apiKey = Deno.env.get('RESEND_API_KEY')
  if (!apiKey) throw new Error('RESEND_API_KEY not set')

  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      from:    'AgriManagerX <reports@mail.agrimanager.app>',
      to:      [to],
      subject,
      html,
      text,
    }),
  })

  if (!res.ok) {
    const body = await res.text()
    throw new Error(`Resend error ${res.status}: ${body}`)
  }
}

// ── Main handler ──────────────────────────────────────────────────────────────

Deno.serve(async (_req: Request) => {
  try {
    const db     = adminClient()
    const appUrl = Deno.env.get('APP_URL') ?? 'https://agrimanager.app'

    // Week date range: Mon–Sun of the previous week
    const today     = new Date()
    const dayOfWeek = today.getUTCDay()                        // 0=Sun
    const monday    = new Date(today)
    monday.setUTCDate(today.getUTCDate() - ((dayOfWeek + 6) % 7) - 7)
    const sunday = new Date(monday)
    sunday.setUTCDate(monday.getUTCDate() + 6)

    const weekStart = monday.toISOString().slice(0, 10)
    const weekEnd   = sunday.toISOString().slice(0, 10)
    const weekLabel = `${monday.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} – ${sunday.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}`

    const orgs    = await getActiveOrgs(db)
    const results = { sent: 0, failed: 0, errors: [] as string[] }

    for (const org of orgs) {
      try {
        const metrics = await getWeeklyMetrics(db, org.orgId, weekStart, weekEnd, org.currency)
        const html    = buildEmailHtml(org, metrics, weekLabel, appUrl)
        const text    = buildEmailText(org, metrics, weekLabel)
        const subject = `${org.orgName} — Weekly Summary (${weekLabel})`

        await sendEmail(org.ownerEmail, subject, html, text)
        results.sent++
      } catch (err: any) {
        results.failed++
        results.errors.push(`${org.orgId}: ${err.message}`)
        console.error(`Failed for org ${org.orgId}:`, err)
      }
    }

    return new Response(JSON.stringify(results), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    })
  } catch (err: any) {
    console.error('weekly-report fatal error:', err)
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    })
  }
})
