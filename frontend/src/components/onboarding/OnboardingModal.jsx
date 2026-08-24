import { ChatBubbleLeftRightIcon, UserGroupIcon, ViewColumnsIcon, XMarkIcon } from '@heroicons/react/24/outline'
import clsx from 'clsx'
import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'

function PulseIcon({ className }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <path d="M22 12h-4l-3 9L9 3l-3 9H2" />
    </svg>
  )
}

function MiniHealthGauge() {
  const pct = 0.84
  const r = 40
  const c = 2 * Math.PI * r
  return (
    <svg viewBox="0 0 100 100" className="h-16 w-16">
      <circle cx="50" cy="50" r={r} fill="none" strokeWidth="10" className="stroke-gray-100 dark:stroke-gray-800" />
      <circle
        cx="50"
        cy="50"
        r={r}
        fill="none"
        strokeWidth="10"
        strokeLinecap="round"
        className="stroke-brand-500"
        strokeDasharray={c}
        strokeDashoffset={c * (1 - pct)}
        transform="rotate(-90 50 50)"
      />
      <text x="50" y="57" textAnchor="middle" className="fill-gray-900 dark:fill-gray-100 font-bold" fontSize="26">
        84
      </text>
    </svg>
  )
}

const STEPS = [
  {
    key: 'welcome',
    eyebrow: 'Sprint Agent',
    title: 'Welcome to Sprint Agent',
    body: "Sprint Agent is an AI-powered agile copilot that watches your sprints in real time — tracking health, surfacing risk, and drafting the busywork so your team can focus on shipping. This build runs on demo data as a portfolio showcase; here's a 30-second look at how it fits together.",
    visual: 'logo',
  },
  {
    key: 'dashboard',
    eyebrow: 'Step 2 of 4',
    title: 'One glance, full sprint health',
    body: 'The Dashboard opens on a circular Sprint Health score blending Velocity, Blockers, Staleness, and Completion into a single trending number. Below it, click-through stat tiles — Story points, Tickets done, At risk, Velocity — and a live Burndown Chart show exactly where the sprint stands.',
    visual: 'gauge',
  },
  {
    key: 'workflow',
    eyebrow: 'Step 3 of 4',
    title: 'AI does the busywork',
    body: 'Three pages carry the AI layer end to end:',
    bullets: [
      { icon: ViewColumnsIcon, label: 'Kanban', text: 'A git-webhook simulation auto-links commits to tickets and moves cards as work lands.' },
      { icon: UserGroupIcon, label: 'Team', text: 'AI drafts ready-to-send nudges for teammates trending at-risk, before a deadline slips.' },
      { icon: ChatBubbleLeftRightIcon, label: 'Reports', text: 'Generate a leadership-ready sprint report in one click — no manual status roundup.' },
    ],
    visual: 'bullets',
  },
  {
    key: 'tips',
    eyebrow: 'Step 4 of 4',
    title: "You're ready — a few power-user tips",
    body: 'Press Ctrl K anywhere to open the command palette, or G then a letter to jump straight to a section (G D for Dashboard, G K for Kanban, G R for Reports). Press ? for the full shortcut list. And you can always revisit this tour from the ? icon in the header.',
    visual: 'tips',
  },
]

function StepVisual({ step }) {
  if (step.visual === 'logo') {
    return (
      <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-brand-500 to-brand-700 shadow-lg">
        <PulseIcon className="w-7 h-7 text-white" />
      </span>
    )
  }
  if (step.visual === 'gauge') {
    return <MiniHealthGauge />
  }
  if (step.visual === 'tips') {
    return (
      <div className="flex flex-wrap gap-1.5">
        {['Ctrl', 'K'].map((k) => (
          <kbd key={k} className="rounded bg-gray-100 dark:bg-gray-800 px-1.5 py-0.5 font-mono text-[10px] text-gray-700 dark:text-gray-300">
            {k}
          </kbd>
        ))}
      </div>
    )
  }
  return null
}

export default function OnboardingModal({ onClose }) {
  const [step, setStep] = useState(0)
  const cardRef = useRef(null)
  const isFirst = step === 0
  const isLast = step === STEPS.length - 1
  const current = STEPS[step]

  useEffect(() => {
    cardRef.current?.focus()
    const onKey = (e) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  const next = () => (isLast ? onClose() : setStep((s) => s + 1))
  const back = () => setStep((s) => Math.max(0, s - 1))

  return createPortal(
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-gray-900/60 backdrop-blur-sm p-4"
      onClick={onClose}
    >
      <div
        ref={cardRef}
        tabIndex={-1}
        role="dialog"
        aria-modal="true"
        aria-labelledby="onboarding-title"
        onClick={(e) => e.stopPropagation()}
        className="relative w-full max-w-lg overflow-hidden rounded-2xl border border-gray-100 dark:border-gray-800 bg-white/95 dark:bg-gray-900/95 shadow-2xl backdrop-blur-xl focus:outline-none"
      >
        <div className="pointer-events-none absolute -left-16 -top-16 h-56 w-56 rounded-full bg-brand-500/20 blur-3xl" />
        <div className="pointer-events-none absolute -right-12 -bottom-16 h-56 w-56 rounded-full bg-purple-500/15 blur-3xl" />

        <button
          type="button"
          onClick={onClose}
          aria-label="Skip tour"
          className="absolute right-4 top-4 z-10 rounded-lg p-1.5 text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 focus:outline-none focus:ring-2 focus:ring-brand-500"
        >
          <XMarkIcon className="w-5 h-5" />
        </button>

        <div className="relative px-8 pt-10 pb-6 sm:px-10 min-h-[280px]">
          <StepVisual step={current} />
          <p className="mt-5 text-xs font-semibold uppercase tracking-wide text-brand-600 dark:text-brand-400">{current.eyebrow}</p>
          <h2 id="onboarding-title" className="mt-1.5 text-xl font-bold text-gray-900 dark:text-gray-100">
            {current.title}
          </h2>
          <p className="mt-3 text-sm leading-relaxed text-gray-600 dark:text-gray-300">{current.body}</p>

          {current.bullets && (
            <ul className="mt-4 space-y-3">
              {current.bullets.map((b) => (
                <li key={b.label} className="flex items-start gap-3">
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-brand-50 dark:bg-brand-500/10">
                    <b.icon className="w-5 h-5 text-brand-600 dark:text-brand-400" />
                  </span>
                  <span className="min-w-0">
                    <span className="block text-sm font-semibold text-gray-900 dark:text-gray-100">{b.label}</span>
                    <span className="block text-xs text-gray-500 dark:text-gray-400">{b.text}</span>
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="relative flex items-center justify-between gap-4 border-t border-gray-100 dark:border-gray-800 bg-gray-50/60 dark:bg-gray-800/40 px-8 py-4 sm:px-10">
          <div className="flex items-center gap-1.5" role="tablist" aria-label="Onboarding progress">
            {STEPS.map((s, i) => (
              <button
                key={s.key}
                type="button"
                aria-label={`Go to step ${i + 1}`}
                onClick={() => setStep(i)}
                className={clsx(
                  'h-1.5 rounded-full transition-all duration-200',
                  i === step ? 'w-6 bg-brand-600' : 'w-1.5 bg-gray-300 dark:bg-gray-700 hover:bg-gray-400 dark:hover:bg-gray-600'
                )}
              />
            ))}
          </div>
          <div className="flex items-center gap-2">
            {!isFirst && (
              <button
                type="button"
                onClick={back}
                className="rounded-lg px-3 py-1.5 text-sm font-medium text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 focus:outline-none focus:ring-2 focus:ring-brand-500"
              >
                Back
              </button>
            )}
            {!isLast && (
              <button
                type="button"
                onClick={onClose}
                className="rounded-lg px-3 py-1.5 text-sm font-medium text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 focus:outline-none focus:ring-2 focus:ring-brand-500"
              >
                Skip
              </button>
            )}
            <button
              type="button"
              onClick={next}
              className="rounded-lg bg-brand-600 px-4 py-1.5 text-sm font-semibold text-white hover:bg-brand-700 focus:outline-none focus:ring-2 focus:ring-brand-500 focus:ring-offset-2 dark:focus:ring-offset-gray-900"
            >
              {isLast ? 'Get Started' : 'Next'}
            </button>
          </div>
        </div>
      </div>
    </div>,
    document.body
  )
}
