import { ClipboardDocumentListIcon, XMarkIcon } from '@heroicons/react/24/outline'
import { createPortal } from 'react-dom'
import { avatarGradient } from '../../utils/avatarColor'
import { initials } from '../../utils/formatters'
import { RISK_TAG_CLASSES, RISK_TAG_LABELS, STATUS_CLASSES } from '../../utils/riskColors'

function formatDate(iso) {
  return new Date(iso).toLocaleDateString('en-US')
}

function buildDrilldown(kpi, sprint) {
  const { tickets, totalCommitted, pointsDone, daysElapsed, daysRemaining, velocity, projectedCompletion } = sprint
  const totalDays = daysElapsed + daysRemaining
  const dailyBurn = daysElapsed > 0 ? Math.round((pointsDone / daysElapsed) * 100) / 100 : 0
  const doneTickets = tickets.filter((t) => t.status === 'Done')
  const atRiskTickets = tickets.filter((t) => t.riskTags?.length > 0)
  const blocked = tickets.filter((t) => t.riskTags?.includes('BLOCKED'))
  const stale = tickets.filter((t) => t.riskTags?.includes('STALE'))
  const ticketsDonePct = tickets.length ? Math.round((doneTickets.length / tickets.length) * 100) : 0

  const projectionFormula = [
    `velocity = ${pointsDone} / ${totalCommitted} = ${velocity}%`,
    `projected = burn × daysRemaining + done`,
    `          = ${dailyBurn} × ${daysRemaining} + ${pointsDone}`,
    `          = ${projectedCompletion}`,
  ]

  const subtitle = `Day ${daysElapsed} of ${totalDays}`

  switch (kpi) {
    case 'storyPoints':
      return {
        subtitle,
        title: 'Story points completion',
        explanation: `Out of ${totalCommitted} committed points, ${pointsDone} are Done — that's ${velocity}%. At the current daily burn (${dailyBurn} pts/day), the team will project to ${projectedCompletion} pts by sprint end.`,
        formula: projectionFormula,
        tickets: doneTickets,
      }
    case 'ticketsDone':
      return {
        subtitle,
        title: 'Tickets done',
        explanation: `${doneTickets.length} of ${tickets.length} tickets are Done this sprint — that's ${ticketsDonePct}%.`,
        formula: [`doneTickets / totalTickets = ${doneTickets.length} / ${tickets.length} = ${ticketsDonePct}%`],
        tickets: doneTickets,
      }
    case 'atRisk':
      return {
        subtitle,
        title: 'At-risk tickets',
        explanation: `${atRiskTickets.length} ticket(s) carry at least one risk tag — ${blocked.length} blocked, ${stale.length} stale.`,
        formula: [
          `atRisk = tickets where riskTags.length > 0`,
          `       = ${atRiskTickets.length} of ${tickets.length}`,
        ],
        tickets: atRiskTickets,
        showRiskTags: true,
      }
    case 'velocity':
    default:
      return {
        subtitle,
        title: 'Velocity & projection',
        explanation: 'Velocity is points done divided by total committed points, projected forward using the current daily burn rate.',
        formula: projectionFormula,
        tickets: doneTickets,
      }
  }
}

export default function KPIDrilldownModal({ kpi, sprint, onClose }) {
  const d = buildDrilldown(kpi, sprint)

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-gray-900/50 backdrop-blur-sm p-4" onClick={onClose}>
      <div
        role="dialog"
        aria-modal="true"
        aria-label={d.title}
        onClick={(e) => e.stopPropagation()}
        className="max-h-[85vh] w-full max-w-xl overflow-y-auto rounded-2xl border border-gray-100 dark:border-gray-800 bg-white dark:bg-gray-900 shadow-lg"
      >
        <div className="flex items-start justify-between border-b border-gray-100 dark:border-gray-800 px-6 py-4">
          <div>
            <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">{d.title}</h2>
            <p className="text-sm text-gray-400">{d.subtitle}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1 text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800"
            aria-label="Close"
          >
            <XMarkIcon className="w-5 h-5" />
          </button>
        </div>

        <div className="px-6 py-5 space-y-5">
          <div className="rounded-xl bg-gray-50 dark:bg-gray-800/60 p-4">
            <p className="mb-1.5 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
              <ClipboardDocumentListIcon className="w-4 h-4" />
              Explanation
            </p>
            <p className="text-sm text-gray-700 dark:text-gray-300">{d.explanation}</p>
          </div>

          <div>
            <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">Formula</p>
            <pre className="overflow-x-auto rounded-xl bg-gray-900 dark:bg-black px-4 py-3 text-xs leading-relaxed text-emerald-400 font-mono">
              {d.formula.join('\n')}
            </pre>
          </div>

          <div>
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
              Underlying tickets ({d.tickets.length})
            </p>
            {d.tickets.length === 0 ? (
              <p className="text-sm text-gray-400">No tickets contribute to this number yet.</p>
            ) : (
              <ul className="space-y-2">
                {d.tickets.map((t) => (
                  <li key={t.id} className="rounded-lg border border-gray-100 dark:border-gray-800 px-3 py-2">
                    <div className="flex items-center justify-between gap-2">
                      <span className="flex items-center gap-2 min-w-0">
                        <span className="font-mono text-sm font-semibold text-gray-900 dark:text-gray-100">{t.id}</span>
                        <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_CLASSES[t.status] ?? ''}`}>{t.status}</span>
                      </span>
                      <span className="text-xs text-gray-400 shrink-0">{formatDate(t.lastUpdated)}</span>
                    </div>
                    <p className="mt-1 text-sm text-gray-600 dark:text-gray-300 truncate">{t.summary}</p>
                    <div className="mt-1.5 flex items-center justify-between">
                      <span className="flex items-center gap-1.5 text-xs text-gray-500 dark:text-gray-400">
                        <span className={`flex h-5 w-5 items-center justify-center rounded-full ${avatarGradient(t.assignee?.email)} text-[9px] font-semibold text-white`}>
                          {initials(t.assignee?.name)}
                        </span>
                        {t.assignee?.name || 'Unassigned'}
                      </span>
                      {d.showRiskTags && t.riskTags?.length > 0 && (
                        <span className="flex gap-1">
                          {t.riskTags.map((tag) => (
                            <span key={tag} className={`rounded-full px-1.5 py-0.5 text-[10px] font-medium ${RISK_TAG_CLASSES[tag]}`}>
                              {RISK_TAG_LABELS[tag]}
                            </span>
                          ))}
                        </span>
                      )}
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </div>
    </div>,
    document.body
  )
}
