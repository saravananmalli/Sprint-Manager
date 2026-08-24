const STORAGE_KEY = 'sprint-agent-onboarding-seen'
const ONBOARDING_VERSION = 1

export function hasSeenOnboarding() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return false
    const parsed = JSON.parse(raw)
    return parsed?.seen === true && parsed?.version === ONBOARDING_VERSION
  } catch {
    return false
  }
}

export function markOnboardingSeen() {
  localStorage.setItem(
    STORAGE_KEY,
    JSON.stringify({ seen: true, version: ONBOARDING_VERSION, completedAt: new Date().toISOString() })
  )
}
