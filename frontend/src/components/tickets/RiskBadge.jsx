import { RISK_TAG_CLASSES, RISK_TAG_LABELS } from '../../utils/riskColors'

export default function RiskBadge({ tag }) {
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ${RISK_TAG_CLASSES[tag] ?? 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300'}`}
    >
      <span className="h-1.5 w-1.5 rounded-full bg-current" />
      {RISK_TAG_LABELS[tag] ?? tag}
    </span>
  )
}
