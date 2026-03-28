/**
 * AgriManagerX — alert-check Edge Function
 *
 * Runs every hour at :05 (scheduled via pg_cron).
 * Mirrors the client-side alert engine (src/core/services/alert-engine.ts)
 * but operates on server-side data so that alerts are created even when
 * no client device is online.
 *
 * Alert IDs and thresholds match AlertRuleId + AlertThresholds in
 * src/core/config/constants.ts to ensure deduplication works correctly
 * when the client later syncs the alerts table.
 *
 * Required secrets (auto-set by Supabase runtime):
 *   SUPABASE_URL
 *   SUPABASE_SERVICE_ROLE_KEY
 */

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

// ── Supabase admin client ──────────────────────────────────────────────────────

function adminClient() {
  return createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    { auth: { persistSession: false } }
  )
}

type SupabaseClient = ReturnType<typeof adminClient>

// ── Alert thresholds (mirrors src/core/config/constants.ts AlertThresholds) ───

const THRESHOLDS = {
  // Layers
  LAYER_MIN_HDP_PCT:          60,
  LAYER_MAX_MORTALITY_PCT:     5,
  LAYER_MAX_FEED_KG_PER_100:  13,
  // Broilers
  BROILER_MAX_MORTALITY_PCT:   5,
  BROILER_MAX_FCR:             2.2,
  BROILER_MIN_WEIGHT_PCT:     80,   // % of Ross 308 standard at given day
  // Inventory
  LOW_STOCK_DAYS_REMAINING:    7,
  // Financial
  MIN_GROSS_MARGIN_PCT:       10,
} as const

// ── Alert rule IDs (mirrors src/core/config/constants.ts AlertRuleId) ─────────

const RULE = {
  LAYER_PRODUCTION_DROP:  'layer_production_drop',
  LAYER_MORTALITY_HIGH:   'layer_mortality_high',
  LAYER_FEED_EXCESS:      'layer_feed_excess',
  BROILER_MORTALITY_HIGH: 'broiler_mortality_high',
  BROILER_FCR_HIGH:       'broiler_fcr_high',
  BROILER_WEIGHT_LOW:     'broiler_weight_low',
  LOW_STOCK:              'low_stock',
  STOCK_OUT:              'stock_out',
  FINANCIAL_MARGIN_LOW:   'financial_margin_low',
} as const

// ── Severity levels ────────────────────────────────────────────────────────────

type Severity = 'critical' | 'high' | 'medium' | 'info'

interface AlertPayload {
  organization_id:       string
  type:                  string
  severity:              Severity
  message:               string
  enterprise_instance_id?: string
  action_route?:         string
  action_label?:         string
}

// ── Dedup: skip if same rule was created for same enterprise within N hours ────

async function recentAlertExists(
  db: SupabaseClient,
  orgId: string,
  ruleId: string,
  enterpriseId: string | null,
  withinHours: number
): Promise<boolean> {
  const since = new Date(Date.now() - withinHours * 3_600_000).toISOString()
  let q = db
    .from('alerts')
    .select('id', { count: 'exact', head: true })
    .eq('organization_id', orgId)
    .eq('type', ruleId)
    .eq('is_dismissed', false)
    .gte('created_at', since)

  if (enterpriseId) q = q.eq('enterprise_instance_id', enterpriseId)

  const { count } = await q
  return (count ?? 0) > 0
}

async function maybeInsertAlert(
  db: SupabaseClient,
  payload: AlertPayload,
  dedupeHours = 24
): Promise<void> {
  const already = await recentAlertExists(
    db,
    payload.organization_id,
    payload.type,
    payload.enterprise_instance_id ?? null,
    dedupeHours
  )
  if (already) return

  const { error } = await db.from('alerts').insert(payload)
  if (error) console.error('insert alert error:', error)
}

// ── Fetch active enterprises with org scoping ─────────────────────────────────

async function getActiveEnterprises(db: SupabaseClient) {
  const { data, error } = await db
    .from('enterprise_instances')
    .select(`
      id, name, enterprise_type, start_date, current_stock_count,
      infrastructures!inner(
        farm_location_id,
        farm_locations!inner(organization_id)
      )
    `)
    .eq('status', 'active')

  if (error) throw error
  return (data ?? []).map((e: any) => ({
    id:           e.id as string,
    name:         e.name as string,
    type:         e.enterprise_type as string,
    startDate:    e.start_date as string,
    stockCount:   e.current_stock_count as number,
    orgId:        e.infrastructures.farm_locations.organization_id as string,
  }))
}

// ── Layer checks ──────────────────────────────────────────────────────────────

async function checkLayerEnterprise(
  db: SupabaseClient,
  ent: { id: string; name: string; orgId: string; stockCount: number }
): Promise<void> {
  const yesterday = new Date()
  yesterday.setUTCDate(yesterday.getUTCDate() - 1)
  const dateStr = yesterday.toISOString().slice(0, 10)

  const { data: recs } = await db
    .from('layer_daily_records')
    .select('total_eggs, mortality_count, feed_consumed_kg')
    .eq('enterprise_instance_id', ent.id)
    .gte('date', dateStr)
    .limit(1)

  if (!recs?.length) return   // No data yet today
  const rec = recs[0]

  const stock = ent.stockCount
  if (stock <= 0) return

  // HDP check
  const hdp = (rec.total_eggs / stock) * 100
  if (hdp < THRESHOLDS.LAYER_MIN_HDP_PCT) {
    await maybeInsertAlert(db, {
      organization_id:       ent.orgId,
      type:                  RULE.LAYER_PRODUCTION_DROP,
      severity:              hdp < THRESHOLDS.LAYER_MIN_HDP_PCT * 0.8 ? 'critical' : 'high',
      message:               `${ent.name}: HDP dropped to ${hdp.toFixed(1)}% (min ${THRESHOLDS.LAYER_MIN_HDP_PCT}%)`,
      enterprise_instance_id: ent.id,
      action_route:          `/enterprises/${ent.id}`,
      action_label:          'View Enterprise',
    })
  }

  // Mortality check
  const mortalityPct = (rec.mortality_count / stock) * 100
  if (mortalityPct > THRESHOLDS.LAYER_MAX_MORTALITY_PCT) {
    await maybeInsertAlert(db, {
      organization_id:       ent.orgId,
      type:                  RULE.LAYER_MORTALITY_HIGH,
      severity:              mortalityPct > THRESHOLDS.LAYER_MAX_MORTALITY_PCT * 1.5 ? 'critical' : 'high',
      message:               `${ent.name}: Daily mortality ${mortalityPct.toFixed(2)}% exceeds ${THRESHOLDS.LAYER_MAX_MORTALITY_PCT}%`,
      enterprise_instance_id: ent.id,
      action_route:          `/enterprises/${ent.id}`,
      action_label:          'View Enterprise',
    })
  }

  // Feed consumption check (kg per 100 birds)
  const feedPer100 = (rec.feed_consumed_kg / stock) * 100
  if (feedPer100 > THRESHOLDS.LAYER_MAX_FEED_KG_PER_100) {
    await maybeInsertAlert(db, {
      organization_id:       ent.orgId,
      type:                  RULE.LAYER_FEED_EXCESS,
      severity:              'medium',
      message:               `${ent.name}: Feed ${feedPer100.toFixed(1)} kg/100 birds exceeds target ${THRESHOLDS.LAYER_MAX_FEED_KG_PER_100}`,
      enterprise_instance_id: ent.id,
      action_route:          `/enterprises/${ent.id}`,
      action_label:          'View Enterprise',
    })
  }
}

// ── Broiler checks ────────────────────────────────────────────────────────────

async function checkBroilerEnterprise(
  db: SupabaseClient,
  ent: { id: string; name: string; orgId: string; stockCount: number; startDate: string }
): Promise<void> {
  // Fetch last 7 days
  const since = new Date()
  since.setUTCDate(since.getUTCDate() - 7)
  const sinceStr = since.toISOString().slice(0, 10)

  const { data: recs } = await db
    .from('broiler_daily_records')
    .select('mortality_count, feed_consumed_kg, body_weight_sample_avg, date')
    .eq('enterprise_instance_id', ent.id)
    .gte('date', sinceStr)
    .order('date', { ascending: false })

  if (!recs?.length) return

  const stock = ent.stockCount
  if (stock <= 0) return

  // Cumulative mortality this batch
  const { data: allRecs } = await db
    .from('broiler_daily_records')
    .select('mortality_count')
    .eq('enterprise_instance_id', ent.id)

  const totalDeaths     = (allRecs ?? []).reduce((s: number, r: any) => s + (r.mortality_count ?? 0), 0)
  const { data: entRow } = await db
    .from('enterprise_instances')
    .select('initial_stock_count')
    .eq('id', ent.id)
    .single()

  const initialStock    = entRow?.initial_stock_count ?? stock
  const cumulMortPct    = initialStock > 0 ? (totalDeaths / initialStock) * 100 : 0

  if (cumulMortPct > THRESHOLDS.BROILER_MAX_MORTALITY_PCT) {
    await maybeInsertAlert(db, {
      organization_id:       ent.orgId,
      type:                  RULE.BROILER_MORTALITY_HIGH,
      severity:              cumulMortPct > THRESHOLDS.BROILER_MAX_MORTALITY_PCT * 1.5 ? 'critical' : 'high',
      message:               `${ent.name}: Cumulative mortality ${cumulMortPct.toFixed(1)}% exceeds ${THRESHOLDS.BROILER_MAX_MORTALITY_PCT}%`,
      enterprise_instance_id: ent.id,
      action_route:          `/enterprises/${ent.id}`,
      action_label:          'View Enterprise',
    }, 48)
  }

  // FCR (last 7 days)
  const weekFeed   = recs.reduce((s: number, r: any) => s + (r.feed_consumed_kg ?? 0), 0)
  const weekDeaths = recs.reduce((s: number, r: any) => s + (r.mortality_count ?? 0), 0)
  const latestRec  = recs[0]
  const avgWeight  = latestRec?.body_weight_sample_avg
  if (avgWeight && weekFeed > 0) {
    // Approximate gain from start weight (~42g day-0)
    const dayOfBatch = Math.floor(
      (new Date().getTime() - new Date(ent.startDate).getTime()) / 86_400_000
    )
    const startWeight = 0.042   // kg — day-0 chick weight
    const gain        = (Number(avgWeight) - startWeight) * (stock - weekDeaths)
    const fcr         = gain > 0 ? weekFeed / gain : 0

    if (fcr > THRESHOLDS.BROILER_MAX_FCR && fcr < 10) {
      await maybeInsertAlert(db, {
        organization_id:       ent.orgId,
        type:                  RULE.BROILER_FCR_HIGH,
        severity:              'medium',
        message:               `${ent.name}: FCR ${fcr.toFixed(2)} exceeds target ${THRESHOLDS.BROILER_MAX_FCR} (day ${dayOfBatch})`,
        enterprise_instance_id: ent.id,
        action_route:          `/enterprises/${ent.id}`,
        action_label:          'View Enterprise',
      })
    }
  }
}

// ── Inventory checks ──────────────────────────────────────────────────────────

async function checkInventory(db: SupabaseClient, orgId: string): Promise<void> {
  const { data: items } = await db
    .from('inventory_items')
    .select('id, name, current_stock, reorder_point')
    .eq('organization_id', orgId)

  for (const item of (items ?? [])) {
    if (item.current_stock <= 0) {
      await maybeInsertAlert(db, {
        organization_id: orgId,
        type:            RULE.STOCK_OUT,
        severity:        'critical',
        message:         `${item.name} is out of stock`,
        action_route:    `/inventory/${item.id}`,
        action_label:    'View Item',
      }, 24)
    } else if (item.reorder_point != null && item.current_stock <= item.reorder_point) {
      await maybeInsertAlert(db, {
        organization_id: orgId,
        type:            `${RULE.LOW_STOCK}_${item.id}`,
        severity:        'medium',
        message:         `${item.name}: stock ${item.current_stock} is at or below reorder point ${item.reorder_point}`,
        action_route:    `/inventory/${item.id}`,
        action_label:    'View Item',
      }, 48)
    }
  }
}

// ── Financial checks ──────────────────────────────────────────────────────────

async function checkFinancials(db: SupabaseClient, orgId: string): Promise<void> {
  // Check current month margin
  const now       = new Date()
  const monthStart = `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, '0')}-01`
  const today      = now.toISOString().slice(0, 10)

  const { data: txns } = await db
    .from('financial_transactions')
    .select('type, amount')
    .eq('organization_id', orgId)
    .gte('date', monthStart)
    .lte('date', today)

  if (!txns?.length) return

  let income   = 0
  let expenses = 0
  for (const t of txns) {
    if (t.type === 'income')  income   += Number(t.amount)
    else                      expenses += Number(t.amount)
  }

  if (income > 0) {
    const marginPct = ((income - expenses) / income) * 100
    if (marginPct < THRESHOLDS.MIN_GROSS_MARGIN_PCT) {
      await maybeInsertAlert(db, {
        organization_id: orgId,
        type:            RULE.FINANCIAL_MARGIN_LOW,
        severity:        marginPct < 0 ? 'critical' : 'high',
        message:         `This month's gross margin is ${marginPct.toFixed(1)}% (min ${THRESHOLDS.MIN_GROSS_MARGIN_PCT}%)`,
        action_route:    '/financials',
        action_label:    'View Financials',
      }, 72)
    }
  }
}

// ── Cleanup: purge old dismissed alerts ───────────────────────────────────────

async function purgeOldAlerts(db: SupabaseClient): Promise<void> {
  const cutoff = new Date(Date.now() - 30 * 24 * 3_600_000).toISOString()
  await db
    .from('alerts')
    .delete()
    .eq('is_dismissed', true)
    .lt('created_at', cutoff)
}

// ── Main handler ──────────────────────────────────────────────────────────────

Deno.serve(async (_req: Request) => {
  try {
    const db = adminClient()

    // Get all active enterprises (with org IDs)
    const enterprises = await getActiveEnterprises(db)

    // Collect unique org IDs for org-level checks
    const orgIds = [...new Set(enterprises.map(e => e.orgId))]

    let checked = 0
    let errors  = 0

    // Per-enterprise checks
    for (const ent of enterprises) {
      try {
        if (ent.type === 'layers') {
          await checkLayerEnterprise(db, ent)
        } else if (ent.type === 'broilers') {
          await checkBroilerEnterprise(db, ent)
        }
        // cattle, fish, pigs, rabbits, crops — add checks here as needed
        checked++
      } catch (err) {
        console.error(`Error checking enterprise ${ent.id}:`, err)
        errors++
      }
    }

    // Per-org checks
    for (const orgId of orgIds) {
      try {
        await checkInventory(db, orgId)
        await checkFinancials(db, orgId)
      } catch (err) {
        console.error(`Error checking org ${orgId}:`, err)
        errors++
      }
    }

    // Housekeeping
    await purgeOldAlerts(db)

    return new Response(
      JSON.stringify({ checked, errors, orgs: orgIds.length }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    )
  } catch (err: any) {
    console.error('alert-check fatal error:', err)
    return new Response(
      JSON.stringify({ error: err.message }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    )
  }
})
