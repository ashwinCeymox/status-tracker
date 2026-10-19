import { useState, useEffect, Fragment } from 'react';
import { Search, CheckCircle2, Info, ChevronDown, ChevronRight } from 'lucide-react';

export default function LogsPage() {
  const [logs, setLogs] = useState<any[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [expandedLogId, setExpandedLogId] = useState<string | number | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchLogs = () => {
      fetch('/api/logs/')
        .catch(() => fetch('http://127.0.0.1:8000/api/logs/'))
        .then(res => res.json())
        .then(data => {
          setLogs(Array.isArray(data) ? data : []);
          setLoading(false);
        })
        .catch(err => {
          console.error("Failed to load activity logs", err);
          setLoading(false);
        });
    };
    fetchLogs();
    const interval = setInterval(fetchLogs, 5000);
    return () => clearInterval(interval);
  }, []);

  const toggleExpand = (id: string | number) => {
    setExpandedLogId(expandedLogId === id ? null : id);
  };

  const filteredLogs = (Array.isArray(logs) ? logs : []).filter(log =>
    (log?.summary || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
    (log?.model_name && log.model_name.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  if (loading) {
    return <div className="p-12 text-center text-sm text-[var(--color-text-secondary)]">Loading activity logs...</div>;
  }

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      {/* Activity Logs Header and Filters */}
      <div className="bg-[var(--color-page)] rounded-md border border-[var(--color-border)] overflow-hidden">
        <div className="p-3 border-b border-[var(--color-border)] flex items-center justify-between">
          <div className="relative w-80">
            <Search className="w-3.5 h-3.5 absolute left-3 top-2.5 text-[var(--color-text-muted)]" />
            <input
              type="text"
              placeholder="Search lifecycle logs..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full bg-[var(--color-surface)] border border-[var(--color-border)] rounded-md pl-8 pr-3 py-1.5 text-xs text-[var(--color-text-primary)] focus:outline-none focus:ring-1 focus:ring-[var(--color-accent)] focus:border-[var(--color-accent)]"
            />
          </div>
          <span className="text-xs text-[var(--color-text-secondary)]">{filteredLogs.length} events</span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-[var(--color-surface)] text-[var(--color-text-secondary)] border-b border-[var(--color-border)]">
              <tr>
                <th className="px-3 py-2.5 font-medium w-6"></th>
                <th className="px-3 py-2.5 font-medium">Timestamp</th>
                <th className="px-3 py-2.5 font-medium">Event</th>
                <th className="px-3 py-2.5 font-medium">Model</th>
                <th className="px-3 py-2.5 font-medium">Status</th>
                <th className="px-3 py-2.5 font-medium">Summary</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--color-border)]">
              {filteredLogs.map((log, idx) => (
                <Fragment key={log.id || idx}>
                  <tr
                    onClick={() => toggleExpand(log.id || idx)}
                    className="hover:bg-[var(--color-hover)] cursor-pointer transition-colors h-11"
                  >
                    <td className="px-3 py-2 text-[var(--color-text-muted)]">
                      {expandedLogId === (log.id || idx) ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
                    </td>
                    <td className="px-3 py-2 text-[var(--color-text-secondary)] whitespace-nowrap">
                      {log.timestamp ? new Date(log.timestamp).toLocaleTimeString() : 'N/A'}
                    </td>
                    <td className="px-3 py-2">
                      <span className="font-mono text-[10px] bg-[var(--color-surface)] border border-[var(--color-border)] px-1.5 py-0.5 rounded text-[var(--color-text-secondary)]">
                        {log.event_type || 'event'}
                      </span>
                    </td>
                    <td className="px-3 py-2 font-medium text-[var(--color-text-primary)]">
                      {log.model_name || 'system'}
                    </td>
                    <td className="px-3 py-2">
                      <span className={`inline-flex items-center gap-1 text-[11px] ${
                        log.status === 'success' ? 'text-emerald-700 dark:text-emerald-400' : 'text-amber-700 dark:text-amber-400'
                      }`}>
                        {log.status === 'success' ? <CheckCircle2 className="w-3.5 h-3.5" /> : <Info className="w-3.5 h-3.5" />}
                        {log.status || 'info'}
                      </span>
                    </td>
                    <td className="px-3 py-2 text-[var(--color-text-primary)] truncate max-w-md">
                      {log.summary || 'No summary'}
                    </td>
                  </tr>

                  {expandedLogId === (log.id || idx) && (
                    <tr className="bg-[var(--color-surface)]/40">
                      <td colSpan={6} className="px-6 py-3 text-xs text-[var(--color-text-secondary)] font-mono">
                        <div className="bg-[var(--color-page)] p-3 rounded-md border border-[var(--color-border)] space-y-1">
                          <div><span className="text-[var(--color-text-muted)]">Details: </span>{log.details || 'No extended payload stored.'}</div>
                          <div><span className="text-[var(--color-text-muted)]">Storage: </span>Persisted in SQLite database</div>
                        </div>
                      </td>
                    </tr>
                  )}
                </Fragment>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
