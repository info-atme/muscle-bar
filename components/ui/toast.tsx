'use client'

import {
  createContext,
  useContext,
  useState,
  useCallback,
  useRef,
  useEffect,
} from 'react'

type ToastVariant = 'success' | 'error' | 'warning'

type Toast = {
  id: number
  message: string
  variant: ToastVariant
  exiting: boolean
}

type ToastContextValue = {
  success: (message: string) => void
  error: (message: string) => void
  warning: (message: string) => void
}

const ToastContext = createContext<ToastContextValue | null>(null)

const variantStyles: Record<ToastVariant, string> = {
  success: 'bg-green-600 text-white',
  error: 'bg-red-600 text-white',
  warning: 'bg-yellow-600 text-white',
}

function ToastItem({ toast, onRemove }: { toast: Toast; onRemove: (id: number) => void }) {
  useEffect(() => {
    const timer = setTimeout(() => onRemove(toast.id), 3000)
    return () => clearTimeout(timer)
  }, [toast.id, onRemove])

  return (
    <div
      className={`px-4 py-3 rounded-lg shadow-lg text-sm font-medium transition-all duration-300 ${
        variantStyles[toast.variant]
      } ${toast.exiting ? 'opacity-0 translate-y-2' : 'opacity-100 translate-y-0 animate-toast-in'}`}
    >
      {toast.message}
    </div>
  )
}

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([])
  const idRef = useRef(0)

  const dismiss = useCallback((id: number) => {
    // Mark as exiting for fade-out
    setToasts((prev) => prev.map((t) => (t.id === id ? { ...t, exiting: true } : t)))
    // Remove after animation
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id))
    }, 300)
  }, [])

  const show = useCallback((message: string, variant: ToastVariant) => {
    const id = ++idRef.current
    setToasts((prev) => [...prev, { id, message, variant, exiting: false }])
  }, [])

  const value: ToastContextValue = {
    success: useCallback((msg: string) => show(msg, 'success'), [show]),
    error: useCallback((msg: string) => show(msg, 'error'), [show]),
    warning: useCallback((msg: string) => show(msg, 'warning'), [show]),
  }

  return (
    <ToastContext.Provider value={value}>
      {children}
      {/* Toast container - positioned above bottom tab bar */}
      {toasts.length > 0 && (
        <div
          className="fixed left-4 right-4 z-[60] flex flex-col gap-2 pointer-events-none"
          style={{ bottom: 'calc(env(safe-area-inset-bottom, 0px) + 68px)' }}
        >
          {toasts.map((toast) => (
            <div key={toast.id} className="pointer-events-auto">
              <ToastItem toast={toast} onRemove={dismiss} />
            </div>
          ))}
        </div>
      )}
    </ToastContext.Provider>
  )
}

export function useToast(): ToastContextValue {
  const ctx = useContext(ToastContext)
  if (!ctx) {
    throw new Error('useToast must be used within a ToastProvider')
  }
  return ctx
}
