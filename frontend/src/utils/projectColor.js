// Deterministic per-project identity color — same project id always maps to
// the same dot color, independent of sprint status (which has its own
// separate emerald/amber/red meaning — see SPRINT_STATUS_DOT).
const PROJECT_DOTS = [
  'bg-brand-500',
  'bg-emerald-500',
  'bg-amber-500',
  'bg-rose-500',
  'bg-sky-500',
  'bg-purple-500',
  'bg-teal-500',
  'bg-orange-500',
]

const PROJECT_ICON_BG = [
  'bg-brand-100 dark:bg-brand-500/10',
  'bg-emerald-100 dark:bg-emerald-500/10',
  'bg-amber-100 dark:bg-amber-500/10',
  'bg-rose-100 dark:bg-rose-500/10',
  'bg-sky-100 dark:bg-sky-500/10',
  'bg-purple-100 dark:bg-purple-500/10',
  'bg-teal-100 dark:bg-teal-500/10',
  'bg-orange-100 dark:bg-orange-500/10',
]

function hashIndex(seed, length) {
  const s = seed || ''
  let hash = 0
  for (let i = 0; i < s.length; i++) {
    hash = (hash * 31 + s.charCodeAt(i)) | 0
  }
  return Math.abs(hash) % length
}

export function projectDot(id) {
  return PROJECT_DOTS[hashIndex(id, PROJECT_DOTS.length)]
}

export function projectIconBg(id) {
  return PROJECT_ICON_BG[hashIndex(id, PROJECT_ICON_BG.length)]
}
