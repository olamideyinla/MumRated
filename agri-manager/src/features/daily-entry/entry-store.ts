import { create } from 'zustand'

function todayStr() {
  return new Date().toISOString().split('T')[0]
}

interface EntryState {
  selectedDate: string
  setDate: (date: string) => void
  resetToToday: () => void
}

export const useEntryStore = create<EntryState>()((set) => ({
  selectedDate: todayStr(),
  setDate: (date) => set({ selectedDate: date }),
  resetToToday: () => set({ selectedDate: todayStr() }),
}))

export { todayStr }
