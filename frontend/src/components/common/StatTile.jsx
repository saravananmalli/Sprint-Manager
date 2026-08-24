import Card from './Card'

export default function StatTile({ label, icon: Icon, value, suffix, sublabel, sublabelClass, iconClass, iconBg, valueClass, onClick }) {
  const content = (
    <>
      <div className="flex items-center justify-between">
        <span className="text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">{label}</span>
        {Icon && (
          <span className={`flex h-9 w-9 items-center justify-center rounded-lg ${iconBg ?? 'bg-gray-100 dark:bg-gray-800'}`}>
            <Icon className={`w-5 h-5 ${iconClass ?? 'text-gray-400 dark:text-gray-500'}`} />
          </span>
        )}
      </div>
      <p className={`mt-3 text-4xl font-bold ${valueClass ?? 'text-gray-900 dark:text-gray-100'}`}>
        {value}
        {suffix && <span className="ml-1 text-lg font-medium text-gray-400 dark:text-gray-500">{suffix}</span>}
      </p>
      {sublabel && <p className={`mt-1 text-xs ${sublabelClass ?? 'text-gray-500 dark:text-gray-400'}`}>{sublabel}</p>}
    </>
  )

  if (!onClick) {
    return <Card className="p-6">{content}</Card>
  }

  return (
    <Card
      as="button"
      onClick={onClick}
      className="p-6 text-left w-full hover:border-brand-300 dark:hover:border-brand-700 focus:outline-none focus:ring-2 focus:ring-brand-500 focus:ring-offset-2 dark:focus:ring-offset-gray-950 transition-colors"
    >
      {content}
    </Card>
  )
}
