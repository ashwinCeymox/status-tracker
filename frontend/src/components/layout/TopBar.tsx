import { useLocation } from 'react-router-dom';
import { Sun, Moon, RefreshCw, ShieldCheck } from 'lucide-react';
import { useState, useEffect } from 'react';

export default function TopBar() {
  const location = useLocation();
  const [darkMode, setDarkMode] = useState(false);
  const [syncing, setSyncing] = useState(false);

  useEffect(() => {
    if (darkMode) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [darkMode]);

  const getTitle = () => {
    switch (location.pathname) {
      case '/dashboard': return 'Overview Dashboard';
      case '/models': return 'Models & Usage';
      case '/planning': return 'Planning Studio';
      case '/projects': return 'Projects Workspace';
      case '/logs': return 'Activity Logs';
      case '/settings': return 'Settings & Credentials';
      default: return 'Control Center';
    }
  };

  const handleSync = () => {
    setSyncing(true);
    setTimeout(() => setSyncing(false), 1000);
  };

  return (
    <header className="h-14 bg-[var(--color-page)] border-b border-[var(--color-border)] px-6 flex items-center justify-between">
      <div className="flex items-center gap-3">
        <h2 className="text-base font-semibold text-[var(--color-text-primary)]">{getTitle()}</h2>
        <span className="text-[11px] bg-[var(--color-hover)] text-[var(--color-text-secondary)] px-2 py-0.5 rounded font-normal border border-[var(--color-border)]">
          Live Sync
        </span>
      </div>

      <div className="flex items-center gap-3">

        <button
          onClick={handleSync}
          className="flex items-center gap-1.5 text-xs text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] bg-[var(--color-surface)] hover:bg-[var(--color-hover)] px-2.5 py-1.5 rounded-md border border-[var(--color-border)] transition-colors"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${syncing ? 'animate-spin' : ''}`} />
          {syncing ? 'Syncing...' : 'Sync'}
        </button>

        <div className="flex items-center gap-1.5 text-xs text-emerald-700 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/40 px-2.5 py-1.5 rounded-md border border-emerald-200/60 dark:border-emerald-900/40">
          <ShieldCheck className="w-3.5 h-3.5" />
          OmniRoute
        </div>

        <button
          onClick={() => setDarkMode(!darkMode)}
          className="p-1.5 text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] hover:bg-[var(--color-hover)] rounded-md transition-colors"
          title="Toggle theme"
        >
          {darkMode ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
        </button>
      </div>
    </header>
  );
}
