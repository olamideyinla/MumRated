import { v4 as uuidv4 } from 'uuid'
import { db } from '../database/db'
import { AlertRuleId, AlertThresholds } from '../config/constants'
import { henDayProductionPct, ross308WeightForDay } from './kpi-calculator'
import type { Alert, AlertSeverity } from '../../shared/types'

export class AlertEngine {
  async checkAlerts(orgId: string): Promise<void> {
    const [user] = await db.appUsers.where('organizationId').equals(orgId).toArray()
    if (!user) return

    await Promise.all([
      this._checkLayerAlerts(orgId),
      this._checkBroilerAlerts(orgId),
      this._checkFishAlerts(orgId),
      this._checkInventoryAlerts(orgId),
      this._checkFinancialAlerts(orgId),
      this._checkOperationalAlerts(orgId),
      this._checkHealthAlerts(orgId),
    ])
  }

  private async _checkLayerAlerts(orgId: string): Promise<void> {
    const enterprises = await this._activeEnterprises(orgId, 'layer')

    for (const ent of enterprises) {
      const records = await db.layerDailyRecords
        .where('enterpriseInstanceId').equals(ent.id)
        .reverse().limit(8).sortBy('date')

      if (records.length < 2) continue
      const latest = records[records.length - 1]
      const prev = records[records.length - 2]

      // Production drop
      const latestHdp = henDayProductionPct(latest.totalEggs, ent.currentStockCount)
      const prevHdp = henDayProductionPct(prev.totalEggs, ent.currentStockCount)
      if (prevHdp >= AlertThresholds.layerMinHdpForDrop &&
          prevHdp - latestHdp >= AlertThresholds.layerProductionDropPts) {
        await this._maybeCreate({
          ruleId: AlertRuleId.layerProductionDrop,
          severity: 'high',
          message: `${ent.name}: HDP dropped from ${prevHdp.toFixed(1)}% to ${latestHdp.toFixed(1)}%`,
          enterpriseId: ent.id,
          actionRoute: `/enterprises/${ent.id}`,
          actionLabel: 'View Enterprise',
        })
      }

      // Mortality spike
      const mort = latest.mortalityCount
      const mortPct = mort / ent.currentStockCount
      if (mort >= AlertThresholds.layerMortalityMinBirds &&
          mortPct >= AlertThresholds.layerMortalityPct) {
        await this._maybeCreate({
          ruleId: AlertRuleId.layerMortalitySpike,
          severity: 'high',
          message: `${ent.name}: ${mort} deaths (${(mortPct * 100).toFixed(2)}% of flock)`,
          enterpriseId: ent.id,
        })
      }

      // Feed anomaly (7-day average)
      if (records.length >= 7) {
        const avg7 = records.slice(-7).reduce((s, r) => s + r.feedConsumedKg, 0) / 7
        const deviation = Math.abs(latest.feedConsumedKg - avg7) / avg7
        if (avg7 > 0 && deviation >= AlertThresholds.layerFeedDeviationPct) {
          await this._maybeCreate({
            ruleId: AlertRuleId.layerFeedAnomaly,
            severity: 'medium',
            message: `${ent.name}: Feed consumption ${(deviation * 100).toFixed(0)}% off 7-day average`,
            enterpriseId: ent.id,
          })
        }
      }
    }
  }

  private async _checkBroilerAlerts(orgId: string): Promise<void> {
    const enterprises = await this._activeEnterprises(orgId, 'broiler')

    for (const ent of enterprises) {
      const records = await db.broilerDailyRecords
        .where('enterpriseInstanceId').equals(ent.id)
        .reverse().limit(1).toArray()

      if (!records.length) continue
      const latest = records[0]

      // Mortality spike
      const mort = latest.mortalityCount
      const mortPct = mort / ent.currentStockCount
      if (mort >= AlertThresholds.broilerMortalityMinBirds &&
          mortPct >= AlertThresholds.broilerMortalityPct) {
        await this._maybeCreate({
          ruleId: AlertRuleId.broilerMortalitySpike,
          severity: 'high',
          message: `${ent.name}: ${mort} deaths (${(mortPct * 100).toFixed(2)}% of batch)`,
          enterpriseId: ent.id,
        })
      }

      // Weight behind standard
      const dayAge = Math.floor((Date.now() - ent.startDate.getTime()) / 86400000)
      const standard = ross308WeightForDay(dayAge)
      if (standard && latest.bodyWeightSampleAvg) {
        const behind = (standard - latest.bodyWeightSampleAvg) / standard
        if (behind >= AlertThresholds.broilerWeightBehindPct) {
          await this._maybeCreate({
            ruleId: AlertRuleId.broilerWeightBehind,
            severity: 'medium',
            message: `${ent.name}: Weight ${latest.bodyWeightSampleAvg.toFixed(2)}kg vs ${standard.toFixed(2)}kg standard (day ${dayAge})`,
            enterpriseId: ent.id,
            dedupHours: 48,
          })
        }
      }

      // Near market
      if (ent.expectedEndDate) {
        const daysLeft = Math.floor((ent.expectedEndDate.getTime() - Date.now()) / 86400000)
        if (daysLeft >= 0 && daysLeft <= AlertThresholds.broilerNearMarketDays) {
          await this._maybeCreate({
            ruleId: AlertRuleId.broilerNearMarket,
            severity: 'info',
            message: `${ent.name}: ${daysLeft} day${daysLeft !== 1 ? 's' : ''} until expected market date`,
            enterpriseId: ent.id,
            dedupHours: 24,
          })
        }
      }
    }
  }

  private async _checkFishAlerts(orgId: string): Promise<void> {
    const enterprises = await this._activeEnterprises(orgId, 'fish')

    for (const ent of enterprises) {
      const records = await db.fishDailyRecords
        .where('enterpriseInstanceId').equals(ent.id)
        .reverse().limit(1).toArray()

      if (!records.length) continue
      const r = records[0]

      if (r.dissolvedOxygen !== undefined && r.dissolvedOxygen < AlertThresholds.fishDoLow) {
        await this._maybeCreate({
          ruleId: AlertRuleId.fishDoCritical,
          severity: 'critical',
          message: `${ent.name}: Dissolved oxygen critically low at ${r.dissolvedOxygen.toFixed(1)} mg/L`,
          enterpriseId: ent.id,
          dedupHours: 6,
        })
      }
      if (r.ammonia !== undefined && r.ammonia > AlertThresholds.fishAmmoniaHigh) {
        await this._maybeCreate({
          ruleId: AlertRuleId.fishAmmoniaHigh,
          severity: 'high',
          message: `${ent.name}: Ammonia at ${r.ammonia.toFixed(2)} mg/L (limit: 0.5)`,
          enterpriseId: ent.id,
        })
      }
      if (r.waterPh !== undefined &&
          (r.waterPh < AlertThresholds.fishPhMin || r.waterPh > AlertThresholds.fishPhMax)) {
        await this._maybeCreate({
          ruleId: AlertRuleId.fishPhOutOfRange,
          severity: 'high',
          message: `${ent.name}: pH ${r.waterPh.toFixed(1)} is outside safe range (6.5–9.0)`,
          enterpriseId: ent.id,
        })
      }
      if (r.waterTemp !== undefined &&
          (r.waterTemp < AlertThresholds.fishTempMin || r.waterTemp > AlertThresholds.fishTempMax)) {
        await this._maybeCreate({
          ruleId: AlertRuleId.fishTempExtreme,
          severity: 'high',
          message: `${ent.name}: Water temperature ${r.waterTemp.toFixed(1)}°C is outside safe range (18–32°C)`,
          enterpriseId: ent.id,
        })
      }
    }
  }

  private async _checkInventoryAlerts(orgId: string): Promise<void> {
    const items = await db.inventoryItems.where('organizationId').equals(orgId).toArray()

    for (const item of items) {
      if (item.reorderPoint == null) continue

      if (item.currentStock <= item.reorderPoint) {
        await this._maybeCreate({
          ruleId: AlertRuleId.invLowStock(item.id),
          severity: 'medium',
          message: `Low stock: ${item.name} has ${item.currentStock} ${item.unitOfMeasurement} (reorder at ${item.reorderPoint})`,
          actionRoute: '/inventory',
          actionLabel: 'View Inventory',
        })
      }
    }
  }

  private async _checkFinancialAlerts(orgId: string): Promise<void> {
    const now = new Date()
    const from = new Date(now.getFullYear(), now.getMonth(), 1)

    const txns = await db.financialTransactions
      .where('organizationId').equals(orgId)
      .filter(t => t.date >= from)
      .toArray()

    const income = txns.filter(t => t.type === 'income').reduce((s, t) => s + t.amount, 0)
    const expenses = txns.filter(t => t.type === 'expense').reduce((s, t) => s + t.amount, 0)

    if (income > 0 && expenses / income >= AlertThresholds.finCostPct) {
      await this._maybeCreate({
        ruleId: AlertRuleId.finCostExceedingRevenue,
        severity: 'high',
        message: `Month-to-date costs (${((expenses / income) * 100).toFixed(0)}% of income) are approaching revenue`,
        actionRoute: '/financials',
        actionLabel: 'View Financials',
        dedupHours: 48,
      })
    }
  }

  private async _checkOperationalAlerts(orgId: string): Promise<void> {
    const enterprises = await this._activeEnterprises(orgId)
    const today = new Date()
    today.setHours(0, 0, 0, 0)

    for (const ent of enterprises) {
      // Batch nearing end
      if (ent.expectedEndDate) {
        const daysLeft = Math.floor((ent.expectedEndDate.getTime() - Date.now()) / 86400000)
        if (daysLeft >= 0 && daysLeft <= AlertThresholds.opBatchNearingEndDays) {
          await this._maybeCreate({
            ruleId: AlertRuleId.opBatchNearingEnd(ent.id),
            severity: 'info',
            message: `${ent.name}: Batch ends in ${daysLeft} day${daysLeft !== 1 ? 's' : ''}`,
            enterpriseId: ent.id,
            dedupHours: 24,
          })
        }
      }
    }
  }

  private async _maybeCreate(params: {
    ruleId: string
    severity: AlertSeverity
    message: string
    enterpriseId?: string
    actionRoute?: string
    actionLabel?: string
    dedupHours?: number
  }): Promise<void> {
    const dedupHours = params.dedupHours ?? AlertThresholds.defaultDedupHours
    const cutoff = new Date(Date.now() - dedupHours * 3600000)

    const existing = await db.alerts
      .filter(a =>
        a.ruleId === params.ruleId &&
        !a.isDismissed &&
        a.createdAt >= cutoff &&
        a.enterpriseInstanceId === (params.enterpriseId ?? undefined)
      )
      .count()

    if (existing > 0) return

    const alert: Alert = {
      id: uuidv4(),
      ruleId: params.ruleId,
      severity: params.severity,
      message: params.message,
      enterpriseInstanceId: params.enterpriseId,
      isRead: false,
      isDismissed: false,
      actionRoute: params.actionRoute,
      actionLabel: params.actionLabel,
      createdAt: new Date(),
    }
    await db.alerts.add(alert)
  }

  private async _checkHealthAlerts(orgId: string): Promise<void> {
    const today = new Date().toISOString().slice(0, 10)
    const enterprises = await this._activeEnterprises(orgId)
    const enterpriseMap = new Map(enterprises.map(e => [e.id, e.name]))
    const enterpriseIds = enterprises.map(e => e.id)
    if (enterpriseIds.length === 0) return

    const events = await db.scheduledHealthEvents
      .where('enterpriseInstanceId').anyOf(enterpriseIds)
      .filter(e => e.status !== 'completed' && e.status !== 'skipped')
      .toArray()

    for (const evt of events) {
      const entName = enterpriseMap.get(evt.enterpriseInstanceId) ?? 'Enterprise'
      if (evt.scheduledDate < today) {
        // Overdue
        await this._maybeCreate({
          ruleId: `health-event-${evt.id}`,
          severity: 'high',
          message: `Overdue: ${evt.name} for ${entName}`,
          enterpriseId: evt.enterpriseInstanceId,
          actionRoute: '/health',
          actionLabel: 'View Schedule',
          dedupHours: 24,
        })
      } else if (evt.scheduledDate === today) {
        // Due today
        await this._maybeCreate({
          ruleId: `health-due-${evt.id}`,
          severity: 'medium',
          message: `Due today: ${evt.name} for ${entName}`,
          enterpriseId: evt.enterpriseInstanceId,
          actionRoute: '/health',
          actionLabel: 'View Schedule',
          dedupHours: 12,
        })
      }
    }
  }

  private async _activeEnterprises(orgId: string, type?: string) {
    const infras = await db.infrastructures.toArray()
    const infrasForOrg = infras.filter(async (i) => {
      const loc = await db.farmLocations.get(i.farmLocationId)
      return loc?.organizationId === orgId
    })
    const infraIds = infrasForOrg.map(i => i.id)
    let q = db.enterpriseInstances
      .where('infrastructureId').anyOf(infraIds)
      .filter(e => e.status === 'active')
    if (type) q = q.filter(e => e.enterpriseType === type as any)
    return q.toArray()
  }
}

export const alertEngine = new AlertEngine()
