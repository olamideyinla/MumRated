import { create } from 'zustand'

export type Theme = 'system' | 'light' | 'dark'
export type FontSize = 'normal' | 'large'

interface UIState {
  isOnline: boolean
  setOnline: (v: boolean) => void
  toasts: Toast[]
  addToast: (toast: Omit<Toast, 'id'>) => void
  removeToast: (id: string) => void
  theme: Theme
  setTheme: (t: Theme) => void
  fontSize: FontSize
  setFontSize: (s: FontSize) => void
}

interface Toast {
  id: string
  message: string
  type: 'success' | 'error' | 'info' | 'warning'
}

let toastId = 0

export const useUIStore = create<UIState>((set) => ({
  isOnline: navigator.onLine,
  setOnline: (isOnline) => set({ isOnline }),
  toasts: [],
  addToast: (toast) =>
    set((s) => ({
      toasts: [...s.toasts, { ...toast, id: String(++toastId) }],
    })),
  removeToast: (id) =>
    set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) })),
  theme: (localStorage.getItem('agri-theme') as Theme | null) ?? 'system',
  setTheme: (theme) => {
    localStorage.setItem('agri-theme', theme)
    set({ theme })
  },
  fontSize: (localStorage.getItem('agri-fontsize') as FontSize | null) ?? 'normal',
  setFontSize: (fontSize) => {
    localStorage.setItem('agri-fontsize', fontSize)
    set({ fontSize })
  },
}))
