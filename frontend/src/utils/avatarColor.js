// Deterministic per-person avatar color — same email always maps to the
// same gradient, so a person looks the same everywhere they appear.
// Static class strings only (Tailwind purges dynamic ones).
const AVATAR_GRADIENTS = [
  'bg-gradient-to-br from-brand-500 to-brand-700',
  'bg-gradient-to-br from-emerald-500 to-emerald-700',
  'bg-gradient-to-br from-amber-500 to-amber-700',
  'bg-gradient-to-br from-rose-500 to-rose-700',
  'bg-gradient-to-br from-sky-500 to-sky-700',
  'bg-gradient-to-br from-purple-500 to-purple-700',
  'bg-gradient-to-br from-teal-500 to-teal-700',
  'bg-gradient-to-br from-orange-500 to-orange-700',
]

export function avatarGradient(seed) {
  const s = seed || ''
  let hash = 0
  for (let i = 0; i < s.length; i++) {
    hash = (hash * 31 + s.charCodeAt(i)) | 0
  }
  return AVATAR_GRADIENTS[Math.abs(hash) % AVATAR_GRADIENTS.length]
}
