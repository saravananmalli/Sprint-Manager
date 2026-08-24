import { ClipboardIcon } from '@heroicons/react/24/outline'
import { useState } from 'react'

export default function CopyButton({ text, onCopied }) {
  const [copied, setCopied] = useState(false)

  const handleCopy = async () => {
    await navigator.clipboard.writeText(text)
    setCopied(true)
    onCopied?.()
    setTimeout(() => setCopied(false), 1500)
  }

  return (
    <button
      type="button"
      onClick={handleCopy}
      className="inline-flex items-center gap-1.5 rounded-lg border border-gray-200 px-3 py-1.5 text-sm font-medium text-gray-700 transition-all duration-150 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-brand-500 focus:ring-offset-2"
    >
      <ClipboardIcon className="w-4 h-4" />
      {copied ? 'Copied ✓' : 'Copy'}
    </button>
  )
}
