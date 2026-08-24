import clsx from 'clsx'
import { useState } from 'react'
import { NavLink } from 'react-router-dom'
import { NAV_ITEMS } from '../../utils/navItems'

export default function Sidebar() {
  const [collapsed, setCollapsed] = useState(false)

  return (
    <aside
      className={clsx(
        'hidden sm:flex sm:flex-col shrink-0 h-full overflow-hidden border-r border-gray-100 dark:border-gray-800 bg-white dark:bg-gray-900 transition-all duration-150',
        collapsed ? 'w-16' : 'w-60'
      )}
    >
      <nav className="flex flex-1 flex-col gap-1 overflow-y-auto p-2 lg:p-3" aria-label="Primary">
        {NAV_ITEMS.map(({ label, to, icon: Icon }) => (
          <NavLink
            key={to}
            to={to}
            end={to === '/'}
            className={({ isActive }) =>
              clsx(
                'group flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-all duration-150',
                'focus:outline-none focus:ring-2 focus:ring-brand-500 focus:ring-offset-2 dark:focus:ring-offset-gray-900',
                isActive
                  ? 'bg-brand-50 text-brand-700 border-l-4 border-brand-500 dark:bg-brand-500/10 dark:text-brand-400'
                  : 'text-gray-600 hover:bg-gray-50 border-l-4 border-transparent dark:text-gray-400 dark:hover:bg-gray-800'
              )
            }
          >
            <Icon className="w-6 h-6 shrink-0" />
            {!collapsed && <span>{label}</span>}
          </NavLink>
        ))}
      </nav>
      <div className="shrink-0 border-t border-gray-100 dark:border-gray-800 p-2 lg:p-3 flex items-center justify-between gap-2">
        {!collapsed && <span className="text-xs text-gray-400 dark:text-gray-500">v0.2.0 · Sprint Agent</span>}
        <button
          type="button"
          onClick={() => setCollapsed((c) => !c)}
          className="rounded-lg px-2 py-1 text-xs font-medium text-brand-600 hover:bg-gray-50 dark:text-brand-400 dark:hover:bg-gray-800 focus:outline-none focus:ring-2 focus:ring-brand-500"
        >
          {collapsed ? '»' : '« Collapse'}
        </button>
      </div>
    </aside>
  )
}
