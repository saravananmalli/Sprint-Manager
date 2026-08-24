import clsx from 'clsx'

export default function Card({ as: Tag = 'div', className, children, ...rest }) {
  return (
    <Tag
      className={clsx(
        'bg-white dark:bg-gray-900 rounded-2xl border border-gray-100 dark:border-gray-800 shadow-sm',
        className
      )}
      {...rest}
    >
      {children}
    </Tag>
  )
}
