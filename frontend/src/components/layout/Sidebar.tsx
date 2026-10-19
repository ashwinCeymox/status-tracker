import { NavLink } from 'react-router-dom';
import { LayoutDashboard, Network, Terminal, Settings, CheckCircle2 } from 'lucide-react';

export default function Sidebar() {
  const navItems = [
    { to: '/dashboard', label: 'Overview', icon: LayoutDashboard },
    { to: '/planning', label: 'Planning Studio', icon: Network },
    { to: '/logs', label: 'Activity Logs', icon: Terminal },
    { to: '/settings', label: 'Settings', icon: Settings },
  ];

  return (
    <aside className="w-60 bg-[var(--color-surface)] border-r border-[var(--color-border)] flex flex-col justify-between select-none">
      <div>
        <div className="p-4 border-b border-[var(--color-border)]">
          <h1 className="text-sm font-semibold tracking-tight text-[var(--color-text-primary)] flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-emerald-500 inline-block"></span>
            OmniRoute Center
          </h1>
          <p className="text-xs text-[var(--color-text-secondary)] mt-0.5">Model Ops & Planning</p>
        </div>

        <nav className="p-3 space-y-0.5">
          {navItems.map((item) => {
            const Icon = item.icon;
            return (
              <NavLink
                key={item.to}
                to={item.to}
                className={({ isActive }) =>
                  `flex items-center gap-2.5 px-3 py-2 rounded-md text-sm transition-colors ${
                    isActive
                      ? 'bg-[var(--color-hover)] text-[var(--color-text-primary)] font-medium'
                      : 'text-[var(--color-text-secondary)] hover:bg-[var(--color-hover)] hover:text-[var(--color-text-primary)]'
                  }`
                }
              >
                <Icon className="w-4 h-4 text-[var(--color-text-secondary)] stroke-[1.75]" />
                {item.label}
              </NavLink>
            );
          })}
        </nav>
      </div>

      <div className="p-3 border-t border-[var(--color-border)] text-xs">
        <div className="bg-[var(--color-page)] p-3 rounded-md border border-[var(--color-border)] space-y-1.5 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-[var(--color-text-secondary)]">OmniRoute Proxy</span>
            <span className="flex items-center gap-1 text-emerald-600 dark:text-emerald-400 font-medium">
              <CheckCircle2 className="w-3.5 h-3.5" /> Live
            </span>
          </div>
          <div className="flex items-center justify-between text-[var(--color-text-muted)]">
            <span>Event Collector</span>
            <span className="text-emerald-600 dark:text-emerald-400">Active</span>
          </div>
        </div>
      </div>
    </aside>
  );
}
