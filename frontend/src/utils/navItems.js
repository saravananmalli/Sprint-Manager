import {
  ChartBarIcon,
  ChatBubbleLeftRightIcon,
  Cog6ToothIcon,
  GlobeAltIcon,
  RectangleStackIcon,
  Squares2X2Icon,
  UserGroupIcon,
  ViewColumnsIcon,
} from '@heroicons/react/24/outline'

// Single source of truth for primary navigation — used by Sidebar, the
// command palette, and the `g <key>` shortcut handler in App.jsx.
export const NAV_ITEMS = [
  { label: 'Dashboard', to: '/', icon: Squares2X2Icon, key: 'd' },
  { label: 'All projects', to: '/all-projects', icon: GlobeAltIcon, key: 'o' },
  { label: 'Kanban', to: '/kanban', icon: ViewColumnsIcon, key: 'k' },
  { label: 'Team', to: '/team', icon: UserGroupIcon, key: 't' },
  { label: 'Reports', to: '/reports', icon: ChatBubbleLeftRightIcon, key: 'r' },
  { label: 'Analytics', to: '/analytics', icon: ChartBarIcon, key: 'a' },
  { label: 'Slack', to: '/slack', icon: RectangleStackIcon, key: 'l' },
  { label: 'Settings', to: '/settings', icon: Cog6ToothIcon, key: 's' },
]

export const GO_TO_ROUTES = Object.fromEntries(NAV_ITEMS.map((n) => [n.key, n.to]))
