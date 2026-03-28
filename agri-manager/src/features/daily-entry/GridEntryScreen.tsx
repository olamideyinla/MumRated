/**
 * Table-based bulk entry for a single date.
 * Each row = one enterprise. Columns vary by type family.
 * Tab/Enter navigates between cells; "Save All" upserts changed rows.
 */
import { useRef, useState, useCallback } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { useNavigate } from 'react-router-dom'
import { ArrowLeft, Save } from 'lucide-react'
import { nanoid } from 'nanoid'
import { useAuthStore } from '../../stores/auth-store'
import { useUIStore } from '../../stores/ui-store'
import { db } from '../../core/database/db'
import { useEntryStore } from './entry-store'
import { QuickDateBar } from '../../shared/components/entry/QuickDateBar'
import type { EnterpriseInstance } from '../../shared/types'

// ── Cell ──────────────────────────────────────────────────────────────────────

interface CellProps {
  value: string
  rowIdx: number
  colIdx: number
  onChange: (v: string) => void
  onNavigate: (row: number, col: number) => void
  totalCols: number
  totalRows: number
  inputRef: (el: HTMLInputElement | null) => void
}

function GridCell({
  value, rowIdx, colIdx, onChange, onNavigate, totalCols, totalRows, inputRef,
}: CellProps) {
  return (
    <input
      ref={inputRef}
      type="number"
      inputMode="decimal"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      onKeyDown={(e) => {
        if (e.key === 'Tab') {
          e.preventDefault()
          if (e.shiftKey) {
            if (colIdx > 0) onNavigate(rowIdx, colIdx - 1)
            else if (rowIdx > 0) onNavigate(rowIdx - 1, totalCols - 1)
          } else {
            if (colIdx < totalCols - 1) onNavigate(rowIdx, colIdx + 1)
            else if (rowIdx < totalRows - 1) onNavigate(rowIdx + 1, 0)
          }
        }
        if (e.key === 'Enter') {
          e.preventDefault()
          if (rowIdx < totalRows - 1) onNavigate(rowIdx + 1, colIdx)
        }
      }}
      className="w-full h-10 px-2 text-right text-sm font-semibold bg-transparent border-none outline-none focus:bg-primary-50 rounded transition-colors"
      placeholder="—"
    />
  )
}

// ── Column definitions ────────────────────────────────────────────────────────

interface ColDef {
  key: string
  header: string
  width: string
  appliesToTypes: string[]
}

const COLUMNS: ColDef[] = [
  { key: 'mortality',  header: 'Deaths',   width: 'w-20', appliesToTypes: ['layers','broilers','pigs_breeding','pigs_growfinish','rabbit','custom_animal'] },
  { key: 'eggs',       header: 'Eggs',     width: 'w-24', appliesToTypes: ['layers'] },
  { key: 'feed',       header: 'Feed (kg)',width: 'w-24', appliesToTypes: ['layers','broilers','cattle_dairy','cattle_beef','fish','pigs_breeding','pigs_growfinish','rabbit','custom_animal'] },
  { key: 'milk',       header: 'Milk (L)', width: 'w-24', appliesToTypes: ['cattle_dairy'] },
  { key: 'mort_fish',  header: 'Mort.',    width: 'w-20', appliesToTypes: ['fish'] },
]

// ── Row state ─────────────────────────────────────────────────────────────────

interface RowState {
  enterprise: EnterpriseInstance
  cells: Record<string, string>
  isDirty: boolean
}

// ── Main component ────────────────────────────────────────────────────────────

export default function GridEntryScreen() {
  const navigate   = useNavigate()
  const userId     = useAuthStore(s => s.user?.id) ?? ''
  const addToast   = useUIStore(s => s.addToast)
  const { selectedDate, setDate } = useEntryStore()

  const [rows, setRows] = useState<RowState[]>([])
  const [isSaving, setIsSaving] = useState(false)

  // Map of inputRefs: `${rowIdx}-${colIdx}` → HTMLInputElement
  const inputRefs = useRef<Record<string, HTMLInputElement | null>>({})

  const navigate2 = useCallback((row: number, col: number) => {
    const key = `${row}-${col}`
    inputRefs.current[key]?.focus()
  }, [])

  // ── Load enterprises & pre-fill existing records ──────────────────────────

  useLiveQuery(async () => {
    if (!userId) return
    const user = await db.appUsers.get(userId)
    if (!user) return

    const locations  = await db.farmLocations.where('organizationId').equals(user.organizationId).toArray()
    const locationIds = new Set(locations.map(l => l.id))
    const allInfras   = await db.infrastructures.toArray()
    const orgInfraIds = allInfras.filter(i => locationIds.has(i.farmLocationId)).map(i => i.id)

    const enterprises = await db.enterpriseInstances
      .where('infrastructureId').anyOf(orgInfraIds)
      .filter(e => e.status === 'active')
      .toArray()

    const newRows: RowState[] = await Promise.all(
      enterprises.map(async (ent) => {
        const cells: Record<string, string> = {}

        switch (ent.enterpriseType) {
          case 'layers': {
            const r = await db.layerDailyRecords.where('[enterpriseInstanceId+date]').equals([ent.id, selectedDate]).first()
            cells['mortality'] = String(r?.mortalityCount ?? '')
            cells['eggs']      = String(r?.totalEggs ?? '')
            cells['feed']      = String(r?.feedConsumedKg ?? '')
            break
          }
          case 'broilers': {
            const r = await db.broilerDailyRecords.where('[enterpriseInstanceId+date]').equals([ent.id, selectedDate]).first()
            cells['mortality'] = String(r?.mortalityCount ?? '')
            cells['feed']      = String(r?.feedConsumedKg ?? '')
            break
          }
          case 'cattle_dairy': {
            const r = await db.cattleDailyRecords.where('[enterpriseInstanceId+date]').equals([ent.id, selectedDate]).first()
            cells['milk'] = String(r?.milkYieldLiters ?? '')
            cells['feed'] = String(r?.feedConsumedKg ?? '')
            break
          }
          case 'cattle_beef': {
            const r = await db.cattleDailyRecords.where('[enterpriseInstanceId+date]').equals([ent.id, selectedDate]).first()
            cells['feed'] = String(r?.feedConsumedKg ?? '')
            break
          }
          case 'fish': {
            const r = await db.fishDailyRecords.where('[enterpriseInstanceId+date]').equals([ent.id, selectedDate]).first()
            cells['feed']      = String(r?.feedGivenKg ?? '')
            cells['mort_fish'] = String(r?.estimatedMortality ?? '')
            break
          }
          case 'pigs_breeding':
          case 'pigs_growfinish': {
            const r = await db.pigDailyRecords.where('[enterpriseInstanceId+date]').equals([ent.id, selectedDate]).first()
            cells['mortality'] = String(r?.mortalityCount ?? '')
            cells['feed']      = String(r?.feedConsumedKg ?? '')
            break
          }
          case 'rabbit': {
            const r = await db.rabbitDailyRecords.where('[enterpriseInstanceId+date]').equals([ent.id, selectedDate]).first()
            cells['mortality'] = String(r?.mortalityCount ?? '')
            cells['feed']      = String(r?.feedConsumedKg ?? '')
            break
          }
          case 'custom_animal': {
            const r = await db.customAnimalDailyRecords.where('[enterpriseInstanceId+date]').equals([ent.id, selectedDate]).first()
            cells['mortality'] = String(r?.mortalityCount ?? '')
            cells['feed']      = String(r?.feedConsumedKg ?? '')
            break
          }
        }
        return { enterprise: ent, cells, isDirty: false }
      }),
    )
    setRows(newRows)
  }, [userId, selectedDate])

  // ── Column visibility: only show columns relevant to any enterprise ────────

  const activeEntTypes = new Set(rows.map(r => r.enterprise.enterpriseType))
  const visibleCols    = COLUMNS.filter(c => c.appliesToTypes.some(t => activeEntTypes.has(t as any)))

  const updateCell = (rowIdx: number, key: string, value: string) => {
    setRows(prev => prev.map((r, i) =>
      i === rowIdx ? { ...r, cells: { ...r.cells, [key]: value }, isDirty: true } : r,
    ))
  }

  // ── Save all dirty rows ───────────────────────────────────────────────────

  const saveAll = async () => {
    const dirty = rows.filter(r => r.isDirty)
    if (dirty.length === 0) {
      addToast({ message: 'Nothing to save', type: 'info' })
      return
    }
    setIsSaving(true)
    try {
      const now = new Date().toISOString()
      await db.transaction('rw',
        [db.layerDailyRecords, db.broilerDailyRecords, db.cattleDailyRecords,
         db.fishDailyRecords, db.pigDailyRecords, db.rabbitDailyRecords, db.customAnimalDailyRecords],
        async () => {
          for (const row of dirty) {
            const ent    = row.enterprise
            const cells  = row.cells
            const base   = { enterpriseInstanceId: ent.id, date: selectedDate, recordedBy: userId, syncStatus: 'pending' as const, createdAt: now, updatedAt: now }

            switch (ent.enterpriseType) {
              case 'layers': {
                const existing = await db.layerDailyRecords.where('[enterpriseInstanceId+date]').equals([ent.id, selectedDate]).first()
                await db.layerDailyRecords.put({
                  id: existing?.id ?? nanoid(), ...base,
                  totalEggs:      parseFloat(cells['eggs']) || 0,
                  mortalityCount: parseFloat(cells['mortality']) || 0,
                  feedConsumedKg: parseFloat(cells['feed']) || 0,
                  createdAt:      existing?.createdAt ?? now,
                })
                break
              }
              case 'broilers': {
                const existing = await db.broilerDailyRecords.where('[enterpriseInstanceId+date]').equals([ent.id, selectedDate]).first()
                await db.broilerDailyRecords.put({
                  id: existing?.id ?? nanoid(), ...base,
                  mortalityCount: parseFloat(cells['mortality']) || 0,
                  feedConsumedKg: parseFloat(cells['feed']) || 0,
                  createdAt:      existing?.createdAt ?? now,
                })
                break
              }
              case 'cattle_dairy':
              case 'cattle_beef': {
                const existing = await db.cattleDailyRecords.where('[enterpriseInstanceId+date]').equals([ent.id, selectedDate]).first()
                await db.cattleDailyRecords.put({
                  id: existing?.id ?? nanoid(), ...base,
                  milkYieldLiters: ent.enterpriseType === 'cattle_dairy' ? parseFloat(cells['milk']) || undefined : undefined,
                  feedConsumedKg:  parseFloat(cells['feed']) || undefined,
                  createdAt:       existing?.createdAt ?? now,
                })
                break
              }
              case 'fish': {
                const existing = await db.fishDailyRecords.where('[enterpriseInstanceId+date]').equals([ent.id, selectedDate]).first()
                await db.fishDailyRecords.put({
                  id: existing?.id ?? nanoid(), ...base,
                  feedGivenKg:        parseFloat(cells['feed']) || 0,
                  estimatedMortality: parseFloat(cells['mort_fish']) || undefined,
                  createdAt:          existing?.createdAt ?? now,
                })
                break
              }
              case 'pigs_breeding':
              case 'pigs_growfinish': {
                const existing = await db.pigDailyRecords.where('[enterpriseInstanceId+date]').equals([ent.id, selectedDate]).first()
                await db.pigDailyRecords.put({
                  id: existing?.id ?? nanoid(), ...base,
                  mortalityCount: parseFloat(cells['mortality']) || 0,
                  feedConsumedKg: parseFloat(cells['feed']) || 0,
                  createdAt:      existing?.createdAt ?? now,
                })
                break
              }
              case 'rabbit': {
                const existing = await db.rabbitDailyRecords.where('[enterpriseInstanceId+date]').equals([ent.id, selectedDate]).first()
                await db.rabbitDailyRecords.put({
                  id: existing?.id ?? nanoid(), ...base,
                  mortalityCount: parseFloat(cells['mortality']) || 0,
                  feedConsumedKg: parseFloat(cells['feed']) || 0,
                  createdAt:      existing?.createdAt ?? now,
                })
                break
              }
              case 'custom_animal': {
                const existing = await db.customAnimalDailyRecords.where('[enterpriseInstanceId+date]').equals([ent.id, selectedDate]).first()
                await db.customAnimalDailyRecords.put({
                  id: existing?.id ?? nanoid(), ...base,
                  mortalityCount: parseFloat(cells['mortality']) || undefined,
                  feedConsumedKg: parseFloat(cells['feed']) || undefined,
                  createdAt:      existing?.createdAt ?? now,
                })
                break
              }
            }
          }
        },
      )
      setRows(prev => prev.map(r => ({ ...r, isDirty: false })))
      addToast({ message: `Saved ${dirty.length} entr${dirty.length === 1 ? 'y' : 'ies'}`, type: 'success' })
    } catch {
      addToast({ message: 'Save failed — try again', type: 'error' })
    } finally {
      setIsSaving(false)
    }
  }

  // ── Column totals ─────────────────────────────────────────────────────────

  const totals: Record<string, number> = {}
  for (const col of visibleCols) {
    totals[col.key] = rows.reduce((s, r) => s + (parseFloat(r.cells[col.key]) || 0), 0)
  }

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="h-dvh flex flex-col bg-gray-50">
      {/* Header */}
      <div className="bg-primary-600 px-4 pt-3 pb-3 flex items-center gap-3 safe-top">
        <button
          onClick={() => navigate('/daily-entry')}
          className="w-10 h-10 flex items-center justify-center text-white/80 active:scale-95 transition-transform"
        >
          <ArrowLeft size={22} />
        </button>
        <div className="flex-1">
          <QuickDateBar date={selectedDate} onChange={setDate} />
        </div>
        <button
          onClick={saveAll}
          disabled={isSaving || !rows.some(r => r.isDirty)}
          className="flex items-center gap-1.5 bg-white/20 hover:bg-white/30 disabled:opacity-40 text-white text-sm font-semibold px-3 py-2 rounded-xl active:scale-95 transition-all"
        >
          <Save size={16} />
          {isSaving ? 'Saving…' : 'Save All'}
        </button>
      </div>

      {/* Table */}
      <div className="flex-1 overflow-auto">
        {rows.length === 0 ? (
          <div className="flex items-center justify-center py-16 text-gray-400 text-sm">
            No active enterprises
          </div>
        ) : (
          <table className="w-full text-sm border-collapse">
            <thead className="sticky top-0 bg-white shadow-sm z-10">
              <tr>
                <th className="text-left px-4 py-3 font-semibold text-gray-600 border-b border-gray-200">
                  Enterprise
                </th>
                {visibleCols.map(col => (
                  <th
                    key={col.key}
                    className={`${col.width} text-right px-2 py-3 font-semibold text-gray-600 border-b border-gray-200`}
                  >
                    {col.header}
                  </th>
                ))}
              </tr>
            </thead>

            <tbody>
              {rows.map((row, rowIdx) => (
                <tr
                  key={row.enterprise.id}
                  className={`border-b border-gray-100 ${row.isDirty ? 'bg-amber-50' : 'bg-white'}`}
                >
                  {/* Enterprise name */}
                  <td className="px-4 py-2">
                    <p className="font-medium text-gray-900 leading-tight">{row.enterprise.name}</p>
                    <p className="text-xs text-gray-400">{row.enterprise.enterpriseType.replace('_', ' ')}</p>
                  </td>
                  {visibleCols.map((col, colIdx) => {
                    const applies = col.appliesToTypes.includes(row.enterprise.enterpriseType)
                    return (
                      <td key={col.key} className={`${col.width} border-l border-gray-100`}>
                        {applies ? (
                          <GridCell
                            value={row.cells[col.key] ?? ''}
                            rowIdx={rowIdx}
                            colIdx={colIdx}
                            onChange={(v) => updateCell(rowIdx, col.key, v)}
                            onNavigate={navigate2}
                            totalCols={visibleCols.length}
                            totalRows={rows.length}
                            inputRef={(el) => { inputRefs.current[`${rowIdx}-${colIdx}`] = el }}
                          />
                        ) : (
                          <div className="w-full h-10 bg-gray-50" />
                        )}
                      </td>
                    )
                  })}
                </tr>
              ))}
            </tbody>

            {/* Totals row */}
            <tfoot className="sticky bottom-0 bg-gray-100 border-t-2 border-gray-300 z-10">
              <tr>
                <td className="px-4 py-2 text-xs font-bold text-gray-600 uppercase tracking-wide">Total</td>
                {visibleCols.map(col => (
                  <td key={col.key} className={`${col.width} text-right px-2 py-2 font-bold text-gray-700`}>
                    {totals[col.key] > 0 ? totals[col.key].toLocaleString() : '—'}
                  </td>
                ))}
              </tr>
            </tfoot>
          </table>
        )}
      </div>
    </div>
  )
}
