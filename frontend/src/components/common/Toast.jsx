import { XMarkIcon } from '@heroicons/react/24/outline'
import clsx from 'clsx'
import { useToast } from '../../hooks/useToast'

const VARIANT_CLASSES = {
  success: 'bg-emerald-50 border-emerald-200 text-emerald-800 dark:bg-emerald-900/30 dark:border-emerald-800 dark:text-emerald-300',
  info: 'bg-brand-50 border-brand-100 text-brand-700 dark:bg-brand-500/10 dark:border-brand-800 dark:text-brand-300',
  warning: 'bg-amber-50 border-amber-200 text-amber-800 dark:bg-amber-900/30 dark:border-amber-800 dark:text-amber-300',
  error: 'bg-red-50 border-red-200 text-red-800 dark:bg-red-900/30 dark:border-red-800 dark:text-red-300',
}

export default function ToastContainer() {
  const { toasts, dismiss } = useToast()

  return (
    <div
      className="fixed top-6 right-6 z-[60] flex flex-col gap-2 w-80"
      aria-live="polite"
    >
      {toasts.map((toast) => (
        <div
          key={toast.id}
          className={clsx(
            'flex items-start justify-between gap-3 rounded-lg border p-3 shadow-lg transition-all duration-200',
            VARIANT_CLASSES[toast.variant]
          )}
        >
          <p className="text-sm font-medium">{toast.message}</p>
          <button
            type="button"
            aria-label="Dismiss notification"
            onClick={() => dismiss(toast.id)}
            className="shrink-0 rounded focus:outline-none focus:ring-2 focus:ring-brand-500 focus:ring-offset-2"
          >
            <XMarkIcon className="w-4 h-4" />
          </button>
        </div>
      ))}
    </div>
  )
}
