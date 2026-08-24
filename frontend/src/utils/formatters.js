export function formatRelativeTime(isoString) {
  if (!isoString) return '—'
  const then = new Date(isoString).getTime()
  const now = Date.now()
  const diffMs = now - then
  const diffMin = Math.round(diffMs / 60000)
  if (diffMin < 1) return 'just now'
  if (diffMin < 60) return `${diffMin} m ago`
  const diffHr = Math.round(diffMin / 60)
  if (diffHr < 24) return `${diffHr} h ago`
  const diffDay = Math.round(diffHr / 24)
  return `${diffDay} d ago`
}

export function formatTime24h(isoString) {
  if (!isoString) return 'Not yet run'
  const date = new Date(isoString)
  return `Last run ${date.getHours().toString().padStart(2, '0')}:${date.getMinutes().toString().padStart(2, '0')}`
}

export function formatShortDate(isoString) {
  if (!isoString) return '—'
  return new Date(isoString).toLocaleDateString('en-US')
}

export function formatAbbrevDate(isoString) {
  if (!isoString) return '—'
  return new Date(isoString).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

export function formatDateRange(startDate, endDate) {
  const opts = { day: 'numeric', month: 'short' }
  const start = new Date(startDate).toLocaleDateString('en-GB', opts)
  const end = new Date(endDate).toLocaleDateString('en-GB', { ...opts, year: 'numeric' })
  return `${start} – ${end}`
}

export function initials(name) {
  if (!name) return '?'
  return name
    .split(' ')
    .map((part) => part[0])
    .join('')
    .slice(0, 2)
    .toUpperCase()
}

export function truncate(text, max = 60) {
  if (!text || text.length <= max) return text
  return `${text.slice(0, max - 1)}…`
}
