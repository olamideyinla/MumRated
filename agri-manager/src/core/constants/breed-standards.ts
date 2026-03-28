// ── Breed standard constants for offline decision-support tools ───────────────

// ── Interpolation helper ──────────────────────────────────────────────────────

function interpolate(pts: [number, number][], x: number): number {
  if (x <= pts[0][0]) return pts[0][1]
  for (let i = 1; i < pts.length; i++) {
    if (x <= pts[i][0]) {
      const t = (x - pts[i - 1][0]) / (pts[i][0] - pts[i - 1][0])
      return pts[i - 1][1] + t * (pts[i][1] - pts[i - 1][1])
    }
  }
  return pts[pts.length - 1][1]
}

// ── Ross 308 Broiler Standards ────────────────────────────────────────────────

const ROSS308_WEIGHT_PTS: [number, number][] = [
  [0, 0.042], [7, 0.170], [14, 0.430], [21, 0.840], [28, 1.380],
  [35, 2.000], [42, 2.690], [49, 3.300], [56, 3.810],
]

/** Live weight in kg at given age (days). */
export function ross308WeightKg(day: number): number {
  return interpolate(ROSS308_WEIGHT_PTS, day)
}

/** Average daily gain (kg/day) between two ages. */
export function ross308ADG(fromDay: number, toDay: number): number {
  return (ross308WeightKg(toDay) - ross308WeightKg(fromDay)) / (toDay - fromDay)
}

/** Feed consumed per bird per day (grams) at given week of life (1-based). */
export function ross308FeedGPerBirdDay(weekOfLife: number): number {
  const tbl: Record<number, number> = { 1: 15, 2: 28, 3: 55, 4: 85, 5: 112, 6: 135, 7: 150 }
  return tbl[Math.min(weekOfLife, 7)] ?? 150
}

/** Standard FCR at harvest age (weeks). */
export function ross308StandardFCR(ageWeeks: number): number {
  const pts: [number, number][] = [[3, 1.28], [4, 1.38], [5, 1.55], [6, 1.72], [7, 1.85], [8, 1.97]]
  return interpolate(pts, ageWeeks)
}

/** EPEF = (Survival% × Live weight kg × 100) / (Age days × FCR). */
export function calcEPEF(survivalPct: number, weightKg: number, ageDays: number, fcr: number): number {
  if (ageDays <= 0 || fcr <= 0) return 0
  return (survivalPct * weightKg * 100) / (ageDays * fcr)
}

export const ROSS308_VACCINATIONS = [
  { day: 1,  name: 'Newcastle + IB',        route: 'Spray',   budgetPer1000: 30 },
  { day: 7,  name: 'Gumboro IBD',            route: 'Water',   budgetPer1000: 25 },
  { day: 14, name: 'Gumboro IBD booster',    route: 'Water',   budgetPer1000: 25 },
  { day: 21, name: 'Newcastle booster',      route: 'Water',   budgetPer1000: 20 },
  { day: 28, name: 'Newcastle La Sota',      route: 'Water',   budgetPer1000: 20 },
] as const

// ── Lohmann Brown Layer Standards ─────────────────────────────────────────────

const LOHMANN_PROD_PTS: [number, number][] = [
  [17, 0], [18, 5], [19, 35], [20, 70], [21, 85], [22, 92], [24, 95],
  [28, 93], [32, 90], [36, 87], [40, 84], [44, 80],
  [48, 76], [52, 73], [56, 70], [60, 66], [64, 62],
  [68, 57], [72, 52], [76, 45], [80, 38], [84, 30],
]

/** Production % at given age in weeks. */
export function lohmannProductionPct(weekOfAge: number): number {
  if (weekOfAge < 17) return 0
  const raw = interpolate(LOHMANN_PROD_PTS, weekOfAge)
  return Math.max(0, raw)
}

/** Average feed per bird per day (kg) during production. */
export const LOHMANN_FEED_KG_PER_BIRD_DAY = 0.115

/** Standard peak production %. */
export const LOHMANN_PEAK_PRODUCTION_PCT = 95

/** Feed per bird per day during rearing (kg), weeks 0–17. */
export function lohmannRearingFeedKg(weekOfAge: number): number {
  const pts: [number, number][] = [[0, 0.018], [4, 0.030], [8, 0.060], [12, 0.085], [16, 0.105], [17, 0.115]]
  return interpolate(pts, weekOfAge)
}

export const LOHMANN_VACCINATIONS = [
  { weekOfAge: 1,  name: 'Marek\'s (hatchery)',   route: 'Injection' },
  { weekOfAge: 1,  name: 'Newcastle + IB',         route: 'Spray' },
  { weekOfAge: 3,  name: 'Gumboro IBD',             route: 'Water' },
  { weekOfAge: 6,  name: 'Newcastle + IB booster', route: 'Water' },
  { weekOfAge: 10, name: 'Newcastle',               route: 'Water' },
  { weekOfAge: 16, name: 'Newcastle + IB',          route: 'Water' },
  { weekOfAge: 18, name: 'EDS76 / AE',              route: 'Injection' },
  { weekOfAge: 30, name: 'Newcastle booster',       route: 'Water' },
  { weekOfAge: 42, name: 'Newcastle + IB',          route: 'Water' },
] as const

// ── Benchmark reference values ────────────────────────────────────────────────

/** Broiler benchmark targets (what a "score 80" farm achieves). */
export const BROILER_BENCHMARKS = {
  breed_standard: { fcr: 1.72, mortalityPct: 3.5, adgG: 58, epef: 330, costPerKg: 1.50, marginPct: 18 },
  good:           { fcr: 1.80, mortalityPct: 4.5, adgG: 55, epef: 300, costPerKg: 1.65, marginPct: 14 },
  average:        { fcr: 1.95, mortalityPct: 6.0, adgG: 50, epef: 260, costPerKg: 1.85, marginPct: 8  },
}

/** Layer benchmark targets. */
export const LAYER_BENCHMARKS = {
  breed_standard: { peakPct: 95, fcr: 2.05, mortalityPct: 5,  hdpPct: 80, costPerEgg: 0.08, revenuePerBird: 22 },
  good:           { peakPct: 88, fcr: 2.20, mortalityPct: 7,  hdpPct: 74, costPerEgg: 0.10, revenuePerBird: 19 },
  average:        { peakPct: 80, fcr: 2.40, mortalityPct: 10, hdpPct: 67, costPerEgg: 0.12, revenuePerBird: 15 },
}

// ── Batch planning cost templates ─────────────────────────────────────────────

export interface WeeklyProjection {
  week: number
  label: string
  feedKg: number
  birdCount: number
  cumulativeFeedKg: number
  cashOut: number   // cost this week
  cashIn: number    // revenue this week (0 until sale)
  note?: string
}

export interface BatchPlan {
  enterpriseType: string
  stockCount: number
  startDate: string
  durationWeeks: number
  weeklyProjections: WeeklyProjection[]
  totalFeedKg: number
  totalCost: number
  expectedRevenue: number
  expectedROI: number
  costBreakdown: { category: string; amount: number }[]
}

/** Generate a broiler batch plan. */
export function planBroilerBatch(params: {
  stockCount: number
  startDate: string
  slaughterWeek?: number       // default 6
  feedPricePerKg?: number      // default 0.45
  chickCostPerBird?: number    // default 0.80
  salePricePerKg?: number      // default 2.20
  laborWeekly?: number         // default 50
  vaccinationBudget?: number   // default 80 per 1000
}): BatchPlan {
  const {
    stockCount,
    startDate,
    slaughterWeek = 6,
    feedPricePerKg = 0.45,
    chickCostPerBird = 0.80,
    salePricePerKg = 2.20,
    laborWeekly = 50,
    vaccinationBudget = 80,
  } = params

  const projections: WeeklyProjection[] = []
  let alive = stockCount
  let cumulativeFeed = 0
  const weeklyMortalityRate = 0.005 // 0.5% per week

  const chickCost = stockCount * chickCostPerBird
  const vaccCost = (stockCount / 1000) * vaccinationBudget * slaughterWeek

  for (let w = 1; w <= slaughterWeek; w++) {
    const mortalityThisWeek = Math.round(alive * weeklyMortalityRate)
    alive = alive - mortalityThisWeek
    const feedGPerBirdDay = ross308FeedGPerBirdDay(w)
    const feedKgThisWeek = (feedGPerBirdDay / 1000) * alive * 7
    cumulativeFeed += feedKgThisWeek

    const feedCost = feedKgThisWeek * feedPricePerKg
    const weekCashIn = w === slaughterWeek
      ? alive * ross308WeightKg(w * 7) * salePricePerKg
      : 0

    const vacc = ROSS308_VACCINATIONS.find(v => Math.ceil(v.day / 7) === w)

    projections.push({
      week: w,
      label: `Wk ${w}`,
      feedKg: Math.round(feedKgThisWeek),
      birdCount: alive,
      cumulativeFeedKg: Math.round(cumulativeFeed),
      cashOut: Math.round(feedCost + laborWeekly + (w === 1 ? chickCost + vaccCost : 0)),
      cashIn: Math.round(weekCashIn),
      note: vacc?.name,
    })
  }

  const totalFeedKg = cumulativeFeed
  const totalFeedCost = totalFeedKg * feedPricePerKg
  const totalLabor = slaughterWeek * laborWeekly
  const totalCost = chickCost + totalFeedCost + vaccCost + totalLabor
  const expectedRevenue = alive * ross308WeightKg(slaughterWeek * 7) * salePricePerKg
  const expectedROI = totalCost > 0 ? ((expectedRevenue - totalCost) / totalCost) * 100 : 0

  return {
    enterpriseType: 'broilers',
    stockCount,
    startDate,
    durationWeeks: slaughterWeek,
    weeklyProjections: projections,
    totalFeedKg: Math.round(totalFeedKg),
    totalCost: Math.round(totalCost),
    expectedRevenue: Math.round(expectedRevenue),
    expectedROI: Math.round(expectedROI),
    costBreakdown: [
      { category: 'Chicks',          amount: Math.round(chickCost) },
      { category: 'Feed',            amount: Math.round(totalFeedCost) },
      { category: 'Vaccines/Meds',   amount: Math.round(vaccCost) },
      { category: 'Labor',           amount: Math.round(totalLabor) },
    ],
  }
}

/** Generate a layer batch plan (rearing 17wks + first 52 weeks of lay). */
export function planLayerBatch(params: {
  stockCount: number
  startDate: string
  rearingWeeks?: number         // default 17
  layingWeeks?: number          // default 52
  feedPricePerKg?: number       // default 0.42
  pulletCostPerBird?: number    // default 2.50
  eggPricePerTray?: number      // default 4.00
  laborWeekly?: number          // default 60
}): BatchPlan {
  const {
    stockCount,
    startDate,
    rearingWeeks = 17,
    layingWeeks = 52,
    feedPricePerKg = 0.42,
    pulletCostPerBird = 2.50,
    eggPricePerTray = 4.00,
    laborWeekly = 60,
  } = params

  const totalWeeks = rearingWeeks + layingWeeks
  const projections: WeeklyProjection[] = []
  let alive = stockCount
  const weeklyMortalityRate = 0.001
  const eggPricePerUnit = eggPricePerTray / 30
  let cumulativeFeed = 0

  for (let w = 1; w <= totalWeeks; w++) {
    const mortality = Math.round(alive * weeklyMortalityRate)
    alive = alive - mortality
    const isRearing = w <= rearingWeeks
    const ageWeeks = w

    const feedKg = isRearing
      ? lohmannRearingFeedKg(ageWeeks) * alive * 7
      : LOHMANN_FEED_KG_PER_BIRD_DAY * alive * 7
    cumulativeFeed += feedKg

    const prodPct = isRearing ? 0 : lohmannProductionPct(ageWeeks) / 100
    const eggsThisWeek = prodPct * alive * 7
    const eggRevenue = eggsThisWeek * eggPricePerUnit

    const feedCost = feedKg * feedPricePerKg
    const chickCostWeek1 = w === 1 ? stockCount * pulletCostPerBird : 0

    projections.push({
      week: w,
      label: `Wk ${w}`,
      feedKg: Math.round(feedKg),
      birdCount: alive,
      cumulativeFeedKg: Math.round(cumulativeFeed),
      cashOut: Math.round(feedCost + laborWeekly + chickCostWeek1),
      cashIn: Math.round(eggRevenue),
      note: isRearing ? 'Rearing' : undefined,
    })
  }

  const pulletCost = stockCount * pulletCostPerBird
  const totalFeedCost = cumulativeFeed * feedPricePerKg
  const totalLabor = totalWeeks * laborWeekly
  const totalCost = pulletCost + totalFeedCost + totalLabor
  const expectedRevenue = projections.reduce((s, p) => s + p.cashIn, 0)
  const expectedROI = totalCost > 0 ? ((expectedRevenue - totalCost) / totalCost) * 100 : 0

  return {
    enterpriseType: 'layers',
    stockCount,
    startDate,
    durationWeeks: totalWeeks,
    weeklyProjections: projections,
    totalFeedKg: Math.round(cumulativeFeed),
    totalCost: Math.round(totalCost),
    expectedRevenue: Math.round(expectedRevenue),
    expectedROI: Math.round(expectedROI),
    costBreakdown: [
      { category: 'Pullets',  amount: Math.round(pulletCost) },
      { category: 'Feed',     amount: Math.round(totalFeedCost) },
      { category: 'Labor',    amount: Math.round(totalLabor) },
    ],
  }
}
