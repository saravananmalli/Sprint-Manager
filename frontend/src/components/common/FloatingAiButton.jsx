import { SparklesIcon } from '@heroicons/react/24/solid'
import { useState } from 'react'
import AIScrumMasterPanel from './AIScrumMasterPanel'

export default function FloatingAiButton() {
  const [open, setOpen] = useState(false)

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label="Open AI Scrum Master"
        className="fixed bottom-6 right-6 z-40 flex h-14 w-14 items-center justify-center rounded-full bg-gradient-to-br from-brand-500 to-brand-700 text-white shadow-lg transition-transform duration-150 hover:scale-105 focus:outline-none focus:ring-2 focus:ring-brand-500 focus:ring-offset-2 dark:focus:ring-offset-gray-900"
      >
        <SparklesIcon className="w-6 h-6" />
      </button>
      {open && <AIScrumMasterPanel onClose={() => setOpen(false)} />}
    </>
  )
}
