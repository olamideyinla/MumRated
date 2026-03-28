import { format } from 'date-fns'
import { db } from '../database/db'
import { newId, nowIso } from '../../shared/types/base'
import type {
  AppUser, EnterpriseInstance, Infrastructure,
  DailyTask, DailyTaskChecklist,
  TaskPriority, TimeWindow, TaskType,
} from '../../shared/types'

// ── Time window from hour of day ──────────────────────────────────────────────

function currentTimeWindow(): TimeWindow {
  const h = new Date().getHours()
  if (h < 12) return 'morning'
  if (h < 17) return 'midday'
  return 'evening'
}

// ── Map template category to task type ───────────────────────────────────────

function categoryToTaskType(category: string): TaskType {
  switch (category) {
    case 'feeding':     return 'feeding'
    case 'cleaning':    return 'cleaning'
    case 'observation': return 'observation'
    default:            return 'custom_task'
  }
}

// ── Check if a record exists for a given enterprise + date ───────────────────

async function hasRecordForDate(enterpriseType: string, enterpriseId: string, date: string): Promise<string | null> {
  const check = async (table: { where: (k: string) => { equals: (v: string[]) => { first: () => Promise<{ id: string } | undefined> } } }) => {
    const r = await table.where('[enterpriseInstanceId+date]').equals([enterpriseId, date]).first()
    return r?.id ?? null
  }
  switch (enterpriseType) {
    case 'layers':          return check(db.layerDailyRecords as any)
    case 'broilers':        return check(db.broilerDailyRecords as any)
    case 'cattle_dairy':
    case 'cattle_beef':     return check(db.cattleDailyRecords as any)
    case 'fish':            return check(db.fishDailyRecords as any)
    case 'crop_annual':
    case 'crop_perennial':  return check(db.cropActivityRecords as any)
    case 'pigs_breeding':
    case 'pigs_growfinish': return check(db.pigDailyRecords as any)
    case 'rabbit':          return check(db.rabbitDailyRecords as any)
    case 'custom_animal':   return check(db.customAnimalDailyRecords as any)
    default:                return null
  }
}

// ── Build routine tasks (feeding + cleaning) per enterprise ───────────────────

function buildRoutineTasks(
  enterprise: EnterpriseInstance,
  infra: Infrastructure,
  checklistId: string,
  date: string,
  sortBase: number,
): DailyTask[] {
  const now = nowIso()
  const tasks: DailyTask[] = []

  const make = (
    type: TaskType,
    title: string,
    description: string,
    timeWindow: TimeWindow,
    priority: TaskPriority = 'required',
    offset = 0,
  ): DailyTask => ({
    id: newId(), checklistId,
    type,
    title, description: description || null,
    enterpriseInstanceId: enterprise.id,
    infrastructureId: infra.id,
    priority, scheduledTime: null, timeWindow,
    status: 'pending',
    completedAt: null, completedBy: null, linkedRecordId: null,
    notes: null,
    sortOrder: sortBase + offset,
    createdAt: now, updatedAt: now, syncStatus: 'pending',
  })

  const dow = new Date(date + 'T00:00:00').getDay() // 0=Sun

  switch (enterprise.enterpriseType) {
    case 'layers':
    case 'broilers':
      tasks.push(make('feeding',  `Morning feeding — ${infra.name}`, 'Provide morning feed ration', 'morning'))
      tasks.push(make('feeding',  `Evening feeding — ${infra.name}`, 'Provide evening feed ration', 'evening', 'required', 1))
      if (dow === 1) // Monday
        tasks.push(make('cleaning', `Weekly coop cleaning — ${infra.name}`, 'Clean house, replace litter if needed', 'morning', 'required', 2))
      break

    case 'cattle_dairy':
    case 'cattle_beef':
      tasks.push(make('feeding',  `Morning feeding — ${infra.name}`, 'Provide hay/feed morning ration', 'morning'))
      tasks.push(make('feeding',  `Evening feeding — ${infra.name}`, 'Provide hay/feed evening ration', 'evening', 'required', 1))
      if (dow === 1)
        tasks.push(make('cleaning', `Stall cleaning — ${infra.name}`, 'Remove manure and refresh bedding', 'morning', 'required', 2))
      break

    case 'fish':
      tasks.push(make('feeding',  `Morning feeding — ${infra.name}`, 'Feed morning ration, observe behaviour', 'morning'))
      tasks.push(make('feeding',  `Evening feeding — ${infra.name}`, 'Feed evening ration, check water quality', 'evening', 'required', 1))
      if (dow === 0) // Sunday
        tasks.push(make('cleaning', `Pond / tank cleaning — ${infra.name}`, 'Remove debris, check filters', 'morning', 'recommended', 2))
      break

    case 'pigs_breeding':
    case 'pigs_growfinish':
      tasks.push(make('feeding',  `Morning feeding — ${infra.name}`, 'Provide morning feed ration', 'morning'))
      tasks.push(make('feeding',  `Evening feeding — ${infra.name}`, 'Provide evening feed ration', 'evening', 'required', 1))
      if (dow === 1)
        tasks.push(make('cleaning', `Pen cleaning — ${infra.name}`, 'Wash pen floor and drinking troughs', 'morning', 'required', 2))
      break

    case 'rabbit':
      tasks.push(make('feeding',  `Morning feeding — ${infra.name}`, 'Provide feed and fresh water', 'morning'))
      tasks.push(make('feeding',  `Evening feeding — ${infra.name}`, 'Provide evening feed and greens', 'evening', 'required', 1))
      if (dow === 1)
        tasks.push(make('cleaning', `Hutch cleaning — ${infra.name}`, 'Remove soiled bedding, clean droppings tray', 'morning', 'required', 2))
      break

    case 'custom_animal':
      tasks.push(make('feeding',  `Feeding — ${infra.name}`, 'Provide daily feed ration', 'morning'))
      break
  }

  return tasks
}

// ── Patch routine tasks into an existing checklist ────────────────────────────
// Called when checklist already exists (e.g. page reload after deploy).
// Only runs if no feeding/cleaning tasks exist yet — safe to call on every load.

async function patchRoutineTasks(checklistId: string, worker: AppUser, date: string): Promise<void> {
  const existingRoutine = await db.dailyTasks
    .where('checklistId').equals(checklistId)
    .filter(t => t.type === 'feeding' || t.type === 'cleaning')
    .count()
  if (existingRoutine > 0) return

  const infraIds = [...(worker.assignedInfrastructureIds ?? [])]
  if (infraIds.length === 0) {
    const locs = await db.farmLocations.where('organizationId').equals(worker.organizationId).toArray()
    const locIds = new Set(locs.map(l => l.id))
    const allInfras = await db.infrastructures.toArray()
    infraIds.push(...allInfras.filter(i => locIds.has(i.farmLocationId)).map(i => i.id))
  }

  let sortBase = await db.dailyTasks.where('checklistId').equals(checklistId).count()
  const newTasks: DailyTask[] = []

  for (const infraId of infraIds) {
    const infra = await db.infrastructures.get(infraId)
    if (!infra) continue
    const enterprises = await db.enterpriseInstances
      .where('infrastructureId').equals(infraId)
      .filter(e => e.status === 'active')
      .toArray()
    for (const ent of enterprises) {
      const tasks = buildRoutineTasks(ent, infra, checklistId, date, sortBase)
      newTasks.push(...tasks)
      sortBase += tasks.length
    }
  }

  if (newTasks.length > 0) {
    await db.dailyTasks.bulkAdd(newTasks)
    await recalculateChecklistCompletion(checklistId)
  }
}

// ── Build data entry tasks for an enterprise ──────────────────────────────────

function buildDataEntryTasks(
  enterprise: EnterpriseInstance,
  infra: Infrastructure,
  checklistId: string,
  date: string,
  sortBase: number,
): DailyTask[] {
  const tasks: DailyTask[] = []

  const now = nowIso()

  const make = (
    title: string,
    description: string,
    timeWindow: TimeWindow,
    priority: TaskPriority = 'required',
    offset = 0,
  ): DailyTask => ({
    id: newId(), checklistId,
    type: 'data_entry',
    title, description: description || null,
    enterpriseInstanceId: enterprise.id,
    infrastructureId: infra.id,
    priority, scheduledTime: null, timeWindow,
    status: 'pending',
    completedAt: null, completedBy: null, linkedRecordId: null,
    notes: null,
    sortOrder: sortBase + offset,
  })

  const dayOfCycle = Math.max(1, Math.floor(
    (new Date(date).getTime() - new Date(enterprise.startDate).getTime()) / 86_400_000,
  ) + 1)

  switch (enterprise.enterpriseType) {
    case 'layers':
      tasks.push(make(
        `Enter egg data — ${infra.name}`,
        'Record eggs collected, broken eggs, mortality, feed & water consumed',
        'morning',
      ))
      break

    case 'broilers': {
      tasks.push(make(
        `Enter broiler data — ${infra.name}`,
        'Record mortality, feed consumed, water consumed',
        'evening',
      ))
      // Weigh day: every 7 days
      if (dayOfCycle % 7 === 0) {
        tasks.push(make(
          `Weigh broiler sample — ${infra.name}`,
          'Weigh 30–50 birds and record total weight for FCR calculation',
          'morning', 'required', 1,
        ))
      }
      break
    }

    case 'cattle_dairy':
      tasks.push(make(
        `Record morning milk yield — ${infra.name}`,
        'Record litres milked and number of animals milked',
        'morning',
      ))
      tasks.push(make(
        `Record evening milk yield — ${infra.name}`,
        'Record litres milked and number of animals milked',
        'evening', 'required', 1,
      ))
      tasks.push(make(
        `Record feed given — ${infra.name}`,
        'Record feed type and quantity consumed',
        'morning', 'recommended', 2,
      ))
      break

    case 'cattle_beef':
      tasks.push(make(
        `Enter cattle data — ${infra.name}`,
        'Record feed consumed, health observations, deaths or births',
        'evening',
      ))
      break

    case 'fish':
      tasks.push(make(
        `Record morning feeding — ${infra.name}`,
        'Record feed given, any mortality observed',
        'morning',
      ))
      tasks.push(make(
        `Record evening feeding — ${infra.name}`,
        'Record feed given, water quality observations',
        'evening', 'required', 1,
      ))
      break

    case 'pigs_breeding':
    case 'pigs_growfinish':
      tasks.push(make(
        `Enter pig data — ${infra.name}`,
        'Record mortality, feed consumed, births or weanings if applicable',
        'evening',
      ))
      break

    case 'rabbit':
      tasks.push(make(
        `Enter rabbit data — ${infra.name}`,
        'Record mortality, feed consumed, births, matings',
        'evening',
      ))
      break

    case 'crop_annual':
    case 'crop_perennial':
      tasks.push(make(
        `Log crop activity — ${infra.name}`,
        'Record any activity performed today (irrigation, spraying, weeding, observation)',
        'anytime', 'recommended',
      ))
      break

    default:
      tasks.push(make(
        `Enter data — ${enterprise.name}`,
        'Record today\'s observations for this enterprise',
        'evening',
      ))
  }

  return tasks
}

// ── Main generator ────────────────────────────────────────────────────────────

export async function generateDailyChecklist(
  worker: AppUser,
  date: string,
): Promise<DailyTaskChecklist> {
  const now = nowIso()

  // 1. Check if checklist already exists for today
  const existing = await db.dailyTaskChecklists
    .where('[workerId+date]').equals([worker.id, date])
    .first()

  if (existing) {
    await reconcileDataEntryTasks(worker.id, date)
    await patchRoutineTasks(existing.id, worker, date)
    return existing
  }

  // 2. Create new checklist
  const checklistId = newId()
  const checklist: DailyTaskChecklist = {
    id: checklistId, workerId: worker.id, date,
    completionPct: 0, generatedAt: now,
    createdAt: now, updatedAt: now, syncStatus: 'pending',
  }

  const allTasks: DailyTask[] = []
  let sortCounter = 0

  // 3. Get worker's assigned infrastructure
  const infraIds = worker.assignedInfrastructureIds ?? []
  if (infraIds.length === 0) {
    // Fall back: find all infra in org
    const locs = await db.farmLocations.where('organizationId').equals(worker.organizationId).toArray()
    const locIds = new Set(locs.map(l => l.id))
    const allInfras = await db.infrastructures.toArray()
    infraIds.push(...allInfras.filter(i => locIds.has(i.farmLocationId)).map(i => i.id))
  }

  // 4. Data entry + routine (feeding/cleaning) tasks per active enterprise
  for (const infraId of infraIds) {
    const infra = await db.infrastructures.get(infraId)
    if (!infra) continue

    const enterprises = await db.enterpriseInstances
      .where('infrastructureId').equals(infraId)
      .filter(e => e.status === 'active')
      .toArray()

    for (const ent of enterprises) {
      const entryTasks   = buildDataEntryTasks(ent, infra, checklistId, date, sortCounter)
      allTasks.push(...entryTasks)
      sortCounter += entryTasks.length

      const routineTasks = buildRoutineTasks(ent, infra, checklistId, date, sortCounter)
      allTasks.push(...routineTasks)
      sortCounter += routineTasks.length
    }
  }

  // 5. Health event tasks for today
  const dayOfWeek = new Date(date + 'T00:00:00').getDay()
  const allHealthEvents = await db.scheduledHealthEvents
    .where('scheduledDate').equals(date)
    .toArray()

  // Filter to events for enterprises assigned to this worker
  const assignedEnterpriseIds = new Set<string>()
  for (const infraId of infraIds) {
    const ents = await db.enterpriseInstances
      .where('infrastructureId').equals(infraId)
      .filter(e => e.status === 'active')
      .toArray()
    ents.forEach(e => assignedEnterpriseIds.add(e.id))
  }

  for (const event of allHealthEvents) {
    if (!assignedEnterpriseIds.has(event.enterpriseInstanceId)) continue
    if (event.status === 'completed' || event.status === 'skipped') continue

    const ent = await db.enterpriseInstances.get(event.enterpriseInstanceId)
    const infra = ent ? await db.infrastructures.get(ent.infrastructureId) : null

    allTasks.push({
      id: newId(), checklistId,
      type: 'health_event',
      title: `${event.name}${infra ? ` — ${infra.name}` : ''}`,
      description: [
        event.product ? `Product: ${event.product}` : null,
        event.dosage  ? `Dosage: ${event.dosage}` : null,
        event.route   ? `Route: ${event.route}` : null,
      ].filter(Boolean).join(' · ') || null,
      enterpriseInstanceId: event.enterpriseInstanceId,
      infrastructureId: infra?.id ?? null,
      priority: 'required',
      scheduledTime: null,
      timeWindow: 'morning',
      status: 'pending',
      completedAt: null, completedBy: null,
      linkedRecordId: event.id,
      notes: null,
      sortOrder: sortCounter++,
    })
  }

  // 6. Task template-based routine tasks
  const templates = await db.taskTemplates
    .where('organizationId').equals(worker.organizationId)
    .filter(t => t.isActive)
    .toArray()

  for (const tmpl of templates) {
    // Check frequency
    if (tmpl.frequency === 'weekdays_only' && (dayOfWeek === 0 || dayOfWeek === 6)) continue
    if (tmpl.frequency === 'specific_days' && tmpl.specificDays && !tmpl.specificDays.includes(dayOfWeek)) continue

    // Check infrastructure match
    if (tmpl.infrastructureId && !infraIds.includes(tmpl.infrastructureId)) continue
    if (!tmpl.infrastructureId) {
      // Check enterprise type match
      if (tmpl.enterpriseTypes.length > 0) {
        let hasMatch = false
        for (const infraId of infraIds) {
          const ents = await db.enterpriseInstances
            .where('infrastructureId').equals(infraId)
            .filter(e => e.status === 'active')
            .toArray()
          if (ents.some(e => tmpl.enterpriseTypes.includes(e.enterpriseType))) { hasMatch = true; break }
        }
        if (!hasMatch) continue
      }
    }

    // Check worker assignment
    if (tmpl.assignedWorkerIds && !tmpl.assignedWorkerIds.includes(worker.id)) continue

    allTasks.push({
      id: newId(), checklistId,
      type: categoryToTaskType(tmpl.category),
      title: tmpl.title,
      description: tmpl.description,
      enterpriseInstanceId: null,
      infrastructureId: tmpl.infrastructureId,
      priority: tmpl.priority,
      scheduledTime: null,
      timeWindow: tmpl.timeWindow,
      status: 'pending',
      completedAt: null, completedBy: null, linkedRecordId: null,
      notes: null,
      sortOrder: sortCounter++,
    })
  }

  // 7. Sort: morning → midday → evening → anytime, then priority (required first)
  const windowOrder: Record<TimeWindow, number>   = { morning: 0, midday: 1, evening: 2, anytime: 3 }
  const priorityOrder: Record<string, number>     = { required: 0, recommended: 1, optional: 2 }
  allTasks.sort((a, b) => {
    const wo = windowOrder[a.timeWindow] - windowOrder[b.timeWindow]
    if (wo !== 0) return wo
    return priorityOrder[a.priority] - priorityOrder[b.priority]
  })
  allTasks.forEach((t, i) => { t.sortOrder = i })

  // 8. Persist
  await db.transaction('rw', [db.dailyTaskChecklists, db.dailyTasks], async () => {
    await db.dailyTaskChecklists.add(checklist)
    if (allTasks.length > 0) await db.dailyTasks.bulkAdd(allTasks)
  })

  // 9. Auto-reconcile any existing records
  await reconcileDataEntryTasks(worker.id, date)

  return checklist
}

// ── reconcileDataEntryTasks ───────────────────────────────────────────────────
// Auto-mark data_entry tasks completed if the underlying record already exists.

export async function reconcileDataEntryTasks(workerId: string, date: string): Promise<void> {
  const checklist = await db.dailyTaskChecklists
    .where('[workerId+date]').equals([workerId, date])
    .first()
  if (!checklist) return

  const pendingDataTasks = await db.dailyTasks
    .where('checklistId').equals(checklist.id)
    .filter(t => t.type === 'data_entry' && t.status === 'pending' && !!t.enterpriseInstanceId)
    .toArray()

  if (pendingDataTasks.length === 0) return

  const now = nowIso()
  for (const task of pendingDataTasks) {
    const ent = await db.enterpriseInstances.get(task.enterpriseInstanceId!)
    if (!ent) continue
    const recordId = await hasRecordForDate(ent.enterpriseType, ent.id, date)
    if (recordId) {
      await db.dailyTasks.update(task.id, {
        status: 'completed',
        completedAt: now,
        linkedRecordId: recordId,
        notes: 'Auto-completed: data entry recorded',
      })
    }
  }

  await recalculateChecklistCompletion(checklist.id)
}

// ── recalculateChecklistCompletion ────────────────────────────────────────────

export async function recalculateChecklistCompletion(checklistId: string): Promise<number> {
  const tasks = await db.dailyTasks.where('checklistId').equals(checklistId).toArray()
  if (tasks.length === 0) return 0
  const completed = tasks.filter(t => t.status === 'completed').length
  const pct = Math.round((completed / tasks.length) * 100)
  await db.dailyTaskChecklists.update(checklistId, { completionPct: pct, updatedAt: nowIso() })
  return pct
}
