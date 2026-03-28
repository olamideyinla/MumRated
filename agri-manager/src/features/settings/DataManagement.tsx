import { useState, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import JSZip from 'jszip'
import Papa from 'papaparse'
import { ArrowLeft, Download, Upload, Trash2, FileDown, AlertTriangle, CheckCircle2 } from 'lucide-react'
import { db } from '../../core/database/db'
import { useAuthStore } from '../../stores/auth-store'
import { shareFile } from '../../shared/utils/file-download'
import { exportFinancialTransactions, exportInventoryReport } from '../../core/services/csv-export'

// Tables included in backup (parent-first order, excludes device-local tables)
const BACKUP_TABLES = [
  'organizations', 'farmLocations', 'infrastructures', 'enterpriseInstances',
  'layerDailyRecords', 'broilerDailyRecords', 'cattleDailyRecords', 'fishDailyRecords',
  'cropActivityRecords', 'pigDailyRecords', 'rabbitDailyRecords', 'customAnimalDailyRecords',
  'inventoryItems', 'inventoryTransactions', 'financialTransactions', 'contacts', 'appUsers',
] as const

type BackupTable = typeof BACKUP_TABLES[number]

// ── Section wrapper ───────────────────────────────────────────────────────────

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
      <h2 className="text-sm font-bold text-gray-800 mb-3">{title}</h2>
      {children}
    </div>
  )
}

// ── Main component ────────────────────────────────────────────────────────────

export default function DataManagement() {
  const navigate = useNavigate()
  const appUser = useAuthStore(s => s.appUser)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const [backupStatus, setBackupStatus] = useState<'idle' | 'busy' | 'done' | 'error'>('idle')
  const [importStatus, setImportStatus] = useState<'idle' | 'busy' | 'done' | 'error'>('idle')
  const [importMessage, setImportMessage] = useState('')
  const [deleteConfirm, setDeleteConfirm] = useState('')
  const [deleteStatus, setDeleteStatus] = useState<'idle' | 'busy'>('idle')
  const [exportingTxns, setExportingTxns] = useState(false)
  const [exportingInv, setExportingInv] = useState(false)

  // ── Full Backup ─────────────────────────────────────────────────────────────

  const handleBackup = async () => {
    if (!appUser) return
    setBackupStatus('busy')
    try {
      const zip = new JSZip()
      const recordCounts: Record<string, number> = {}

      for (const tableName of BACKUP_TABLES) {
        const records = await (db[tableName as BackupTable] as any).toArray()
        recordCounts[tableName] = records.length
        const csv = Papa.unparse(records)
        zip.file(`${tableName}.csv`, '\ufeff' + csv)
      }

      const metadata = {
        appVersion: '1.0',
        exportDate: new Date().toISOString(),
        farmName: appUser.fullName,
        organizationId: appUser.organizationId,
        recordCounts,
      }
      zip.file('metadata.json', JSON.stringify(metadata, null, 2))

      const blob = await zip.generateAsync({ type: 'blob', compression: 'DEFLATE' })
      const today = new Date().toISOString().split('T')[0]
      await shareFile(blob, `agrimanagerx-backup-${today}.zip`, 'Farm Data Backup')
      setBackupStatus('done')
      setTimeout(() => setBackupStatus('idle'), 3000)
    } catch (e) {
      console.error('Backup failed:', e)
      setBackupStatus('error')
      setTimeout(() => setBackupStatus('idle'), 4000)
    }
  }

  // ── Import Data ─────────────────────────────────────────────────────────────

  const handleImportFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setImportStatus('busy')
    setImportMessage('')

    try {
      const zip = await JSZip.loadAsync(file)
      let totalImported = 0
      const skipped: string[] = []

      for (const [filename, zipEntry] of Object.entries(zip.files)) {
        if (zipEntry.dir || !filename.endsWith('.csv')) continue
        const tableName = filename.replace('.csv', '') as BackupTable
        if (!(BACKUP_TABLES as readonly string[]).includes(tableName)) {
          skipped.push(tableName)
          continue
        }

        const csvText = await zipEntry.async('string')
        // Strip BOM if present
        const clean = csvText.startsWith('\ufeff') ? csvText.slice(1) : csvText
        const parsed = Papa.parse(clean, { header: true, skipEmptyLines: true })
        if (parsed.data.length > 0) {
          await (db[tableName] as any).bulkPut(parsed.data)
          totalImported += parsed.data.length
        }
      }

      const msg = `Imported ${totalImported} records.${skipped.length > 0 ? ` Skipped: ${skipped.join(', ')}.` : ''}`
      setImportMessage(msg)
      setImportStatus('done')
    } catch (e) {
      console.error('Import failed:', e)
      setImportMessage('Import failed. Make sure the file is a valid backup ZIP.')
      setImportStatus('error')
    } finally {
      // Reset file input
      if (fileInputRef.current) fileInputRef.current.value = ''
    }
  }

  // ── Quick Exports ───────────────────────────────────────────────────────────

  const handleExportTransactions = async () => {
    if (!appUser) return
    setExportingTxns(true)
    try {
      const today = new Date().toISOString().split('T')[0]
      const yearStart = today.slice(0, 4) + '-01-01'
      await exportFinancialTransactions(appUser.organizationId, { from: yearStart, to: today })
    } finally {
      setExportingTxns(false)
    }
  }

  const handleExportInventory = async () => {
    if (!appUser) return
    setExportingInv(true)
    try {
      await exportInventoryReport(appUser.organizationId)
    } finally {
      setExportingInv(false)
    }
  }

  // ── Clear Data ──────────────────────────────────────────────────────────────

  const handleClearData = async () => {
    if (deleteConfirm !== 'DELETE') return
    setDeleteStatus('busy')
    try {
      await db.delete()
      window.location.reload()
    } catch (e) {
      console.error('Clear failed:', e)
      setDeleteStatus('idle')
    }
  }

  return (
    <div className="min-h-dvh bg-gray-50 flex flex-col">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 px-4 py-3 safe-top">
        <div className="flex items-center gap-3">
          <button onClick={() => navigate(-1)} className="p-1 -ml-1 rounded-lg text-gray-600 hover:bg-gray-100">
            <ArrowLeft className="w-5 h-5" />
          </button>
          <h1 className="text-base font-semibold text-gray-900">Data Management</h1>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-4 pb-8">

        {/* Full Backup */}
        <Section title="Full Backup">
          <p className="text-xs text-gray-500 mb-3">
            Exports all your farm data as a ZIP file containing CSV files for each table, plus a metadata summary.
          </p>
          <button
            onClick={handleBackup}
            disabled={backupStatus === 'busy'}
            className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl bg-primary-600 text-white text-sm font-semibold disabled:opacity-60 active:bg-primary-700 transition-colors"
          >
            {backupStatus === 'busy' ? (
              <span className="animate-spin inline-block w-4 h-4 border-2 border-white border-t-transparent rounded-full" />
            ) : backupStatus === 'done' ? (
              <CheckCircle2 className="w-4 h-4" />
            ) : (
              <Download className="w-4 h-4" />
            )}
            {backupStatus === 'busy' ? 'Creating backup…' : backupStatus === 'done' ? 'Backup ready!' : 'Create Full Backup'}
          </button>
          {backupStatus === 'error' && (
            <p className="text-xs text-red-600 mt-2">Backup failed. Please try again.</p>
          )}
        </Section>

        {/* Import Data */}
        <Section title="Import Data">
          <p className="text-xs text-amber-700 bg-amber-50 rounded-lg px-3 py-2 mb-3">
            <strong>Warning:</strong> Existing records with the same ID will be overwritten.
          </p>
          <input
            ref={fileInputRef}
            type="file"
            accept=".zip"
            className="hidden"
            onChange={handleImportFile}
          />
          <button
            onClick={() => fileInputRef.current?.click()}
            disabled={importStatus === 'busy'}
            className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl border-2 border-primary-200 text-primary-700 text-sm font-semibold disabled:opacity-60 active:bg-primary-50 transition-colors"
          >
            {importStatus === 'busy' ? (
              <span className="animate-spin inline-block w-4 h-4 border-2 border-primary-600 border-t-transparent rounded-full" />
            ) : (
              <Upload className="w-4 h-4" />
            )}
            {importStatus === 'busy' ? 'Importing…' : 'Import from Backup ZIP'}
          </button>
          {importMessage && (
            <p className={`text-xs mt-2 ${importStatus === 'error' ? 'text-red-600' : 'text-emerald-700'}`}>
              {importMessage}
            </p>
          )}
        </Section>

        {/* Quick Exports */}
        <Section title="Quick Exports">
          <div className="space-y-2">
            <button
              onClick={handleExportTransactions}
              disabled={exportingTxns}
              className="w-full flex items-center gap-3 py-2.5 px-3 rounded-xl border border-gray-200 text-sm text-gray-700 font-medium hover:bg-gray-50 disabled:opacity-60 transition-colors"
            >
              {exportingTxns
                ? <span className="animate-spin inline-block w-4 h-4 border-2 border-gray-400 border-t-transparent rounded-full" />
                : <FileDown className="w-4 h-4 text-gray-500" />}
              <span className="flex-1 text-left">Transactions CSV</span>
              <span className="text-xs text-gray-400">This year</span>
            </button>
            <button
              onClick={handleExportInventory}
              disabled={exportingInv}
              className="w-full flex items-center gap-3 py-2.5 px-3 rounded-xl border border-gray-200 text-sm text-gray-700 font-medium hover:bg-gray-50 disabled:opacity-60 transition-colors"
            >
              {exportingInv
                ? <span className="animate-spin inline-block w-4 h-4 border-2 border-gray-400 border-t-transparent rounded-full" />
                : <FileDown className="w-4 h-4 text-gray-500" />}
              <span className="flex-1 text-left">Inventory CSV</span>
              <span className="text-xs text-gray-400">Stock + movements</span>
            </button>
          </div>
        </Section>

        {/* Clear Local Data */}
        <Section title="Clear Local Data">
          <div className="flex items-start gap-2 mb-3 p-3 bg-red-50 rounded-xl">
            <AlertTriangle className="w-4 h-4 text-red-600 mt-0.5 flex-shrink-0" />
            <p className="text-xs text-red-700">
              This permanently deletes all local data. Your login session is kept. Data will re-sync from the server when online.
            </p>
          </div>
          <p className="text-xs text-gray-600 mb-2">Type <strong>DELETE</strong> to confirm:</p>
          <input
            type="text"
            value={deleteConfirm}
            onChange={e => setDeleteConfirm(e.target.value)}
            placeholder="Type DELETE"
            className="w-full border border-gray-300 rounded-xl px-3 py-2 text-sm mb-3 focus:outline-none focus:ring-2 focus:ring-red-300"
          />
          <button
            onClick={handleClearData}
            disabled={deleteConfirm !== 'DELETE' || deleteStatus === 'busy'}
            className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl bg-red-600 text-white text-sm font-semibold disabled:opacity-40 active:bg-red-700 transition-colors"
          >
            {deleteStatus === 'busy'
              ? <span className="animate-spin inline-block w-4 h-4 border-2 border-white border-t-transparent rounded-full" />
              : <Trash2 className="w-4 h-4" />}
            {deleteStatus === 'busy' ? 'Clearing…' : 'Clear All Local Data'}
          </button>
        </Section>
      </div>
    </div>
  )
}
