import clsx from 'clsx'

export default function Skeleton({ className }) {
  return <div className={clsx('animate-pulse rounded-lg bg-gray-200 dark:bg-gray-800', className)} />
}
