// Static Tailwind class maps — never concatenate class names dynamically.
// All maps include dark: variants since the app defaults to dark mode.

export const RISK_TAG_LABELS = {
  STALE: 'Stale',
  STUCK: 'Stuck',
  BLOCKED: 'Blocked',
  UNASSIGNED: 'Unassigned',
  INCOMPLETE_AC: 'No AC',
}

export const RISK_TAG_CLASSES = {
  STALE: 'bg-amber-100 border border-amber-300 text-amber-800 dark:bg-amber-500/15 dark:border-amber-500/30 dark:text-amber-400',
  STUCK: 'bg-orange-100 border border-orange-300 text-orange-800 dark:bg-orange-500/15 dark:border-orange-500/30 dark:text-orange-400',
  BLOCKED: 'bg-red-100 border border-red-300 text-red-800 dark:bg-red-500/15 dark:border-red-500/30 dark:text-red-400',
  UNASSIGNED: 'bg-gray-100 border border-gray-300 text-gray-700 dark:bg-gray-800 dark:border-gray-700 dark:text-gray-300',
  INCOMPLETE_AC: 'bg-purple-100 border border-purple-300 text-purple-800 dark:bg-purple-500/15 dark:border-purple-500/30 dark:text-purple-400',
}

export function explainRiskTag(tag, ticket) {
  switch (tag) {
    case 'STALE':
      return `No update since ${new Date(ticket.lastUpdated).toLocaleDateString('en-US')} — past the 24h freshness threshold.`
    case 'STUCK':
      return 'In Progress for over 50% of the sprint duration — work may be larger than estimated or silently blocked.'
    case 'BLOCKED':
      return `Blocked by ${ticket.blockers?.[0] || 'another ticket'} — can't move forward until that clears.`
    case 'UNASSIGNED':
      return 'No assignee — nobody currently owns this ticket.'
    case 'INCOMPLETE_AC':
      return 'Acceptance criteria is missing or too short — scope may be unclear before work starts.'
    default:
      return null
  }
}

export const STATUS_CLASSES = {
  Todo: 'bg-gray-100 border border-gray-300 text-gray-700 dark:bg-gray-800 dark:border-gray-700 dark:text-gray-300',
  Backlog: 'bg-gray-100 border border-gray-300 text-gray-700 dark:bg-gray-800 dark:border-gray-700 dark:text-gray-300',
  'In Progress': 'bg-brand-100 border border-brand-300 text-brand-700 dark:bg-brand-500/15 dark:border-brand-500/30 dark:text-brand-400',
  Testing: 'bg-sky-100 border border-sky-300 text-sky-700 dark:bg-sky-500/15 dark:border-sky-500/30 dark:text-sky-400',
  'In Review': 'bg-purple-100 border border-purple-300 text-purple-800 dark:bg-purple-500/15 dark:border-purple-500/30 dark:text-purple-400',
  Done: 'bg-emerald-100 border border-emerald-300 text-emerald-800 dark:bg-emerald-500/15 dark:border-emerald-500/30 dark:text-emerald-400',
}

export const SPRINT_STATUS_CLASSES = {
  'On Track': 'bg-emerald-100 border border-emerald-300 text-emerald-800 dark:bg-emerald-500/15 dark:border-emerald-500/30 dark:text-emerald-400',
  'At Risk': 'bg-amber-100 border border-amber-300 text-amber-800 dark:bg-amber-500/15 dark:border-amber-500/30 dark:text-amber-400',
  'Off Track': 'bg-red-100 border border-red-300 text-red-800 dark:bg-red-500/15 dark:border-red-500/30 dark:text-red-400',
}

export const SPRINT_STATUS_DOT = {
  'On Track': 'bg-emerald-500',
  'At Risk': 'bg-amber-500',
  'Off Track': 'bg-red-500',
}

export const RISK_LEVEL_CLASSES = {
  HIGH: 'bg-red-100 border border-red-300 text-red-800 dark:bg-red-500/15 dark:border-red-500/30 dark:text-red-400',
  MEDIUM: 'bg-amber-100 border border-amber-300 text-amber-800 dark:bg-amber-500/15 dark:border-amber-500/30 dark:text-amber-400',
  LOW: 'bg-emerald-100 border border-emerald-300 text-emerald-800 dark:bg-emerald-500/15 dark:border-emerald-500/30 dark:text-emerald-400',
}

export const RISK_LEVEL_DOT = {
  HIGH: 'bg-red-500',
  MEDIUM: 'bg-amber-500',
  LOW: 'bg-emerald-500',
}

export const TREND_CLASSES = {
  Improving: 'text-emerald-600 dark:text-emerald-400',
  Stable: 'text-gray-500 dark:text-gray-400',
  Declining: 'text-red-600 dark:text-red-400',
}

export const PRIORITY_CLASSES = {
  P0: 'bg-purple-100 border border-purple-300 text-purple-800 dark:bg-purple-500/15 dark:border-purple-500/30 dark:text-purple-400',
  P1: 'bg-red-100 border border-red-300 text-red-800 dark:bg-red-500/15 dark:border-red-500/30 dark:text-red-400',
  P2: 'bg-amber-100 border border-amber-300 text-amber-800 dark:bg-amber-500/15 dark:border-amber-500/30 dark:text-amber-400',
  P3: 'bg-gray-100 border border-gray-300 text-gray-700 dark:bg-gray-800 dark:border-gray-700 dark:text-gray-300',
}

export function healthScoreClasses(score) {
  if (score === null || score === undefined) {
    return { stroke: 'stroke-gray-300 dark:stroke-gray-700', text: 'text-gray-400 dark:text-gray-500' }
  }
  if (score >= 80) return { stroke: 'stroke-emerald-500', text: 'text-emerald-600 dark:text-emerald-400' }
  if (score >= 60) return { stroke: 'stroke-amber-500', text: 'text-amber-600 dark:text-amber-400' }
  return { stroke: 'stroke-red-500', text: 'text-red-600 dark:text-red-400' }
}
