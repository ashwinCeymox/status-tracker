import { useState } from 'react';
import { Shield, Bell, Database, Check, Download, FileText, CheckCircle2 } from 'lucide-react';

export default function SettingsPage() {
  const [saved, setSaved] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [exportStatus, setExportStatus] = useState<string | null>(null);

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  const handleExportChat = async () => {
    setExporting(true);
    setExportStatus(null);
    const dateStr = new Date().toISOString().slice(0, 10);
    const filename = `chat-export-${dateStr}.txt`;

    try {
      const res = await fetch('/api/logs/export').catch(() => fetch('http://127.0.0.1:8000/api/logs/export'));
      if (res && res.ok) {
        const text = await res.text();
        if (text && text.trim().length > 0) {
          const blob = new Blob([text], { type: 'text/plain;charset=utf-8' });
          const url = URL.createObjectURL(blob);
          const link = document.createElement('a');
          link.href = url;
          link.setAttribute('download', filename);
          document.body.appendChild(link);
          link.click();
          document.body.removeChild(link);
          URL.revokeObjectURL(url);
          setExportStatus('Chat history exported successfully as .txt!');
          setExporting(false);
          setTimeout(() => setExportStatus(null), 4000);
          return;
        }
      }
    } catch (e) {
      console.warn("Server export failed, attempting client generation", e);
    }

    try {
      const logsRes = await fetch('/api/logs/').catch(() => fetch('http://127.0.0.1:8000/api/logs/'));
      if (logsRes && logsRes.ok) {
        const logs = await logsRes.json();
        if (Array.isArray(logs) && logs.length > 0) {
          const lines = [
            '================================================================================',
            'TOKEN MONITOR & PLANNING STUDIO - CHAT HISTORY EXPORT',
            `Exported At:   ${new Date().toISOString()}`,
            `Total Records: ${logs.length}`,
            '================================================================================\n'
          ];
          logs.forEach((item: any) => {
            const ev = (item.event_type || '').toLowerCase();
            const role = (ev === 'user_prompt' || ev === 'user') ? 'USER' : 'AGENT';
            const modelInfo = item.model_name ? ` (${item.model_name})` : '';
            lines.push(`[${item.timestamp || 'N/A'}] ${role}${modelInfo}:`);
            lines.push(item.details || item.summary || '');
            lines.push('--------------------------------------------------------------------------------\n');
          });
          const blob = new Blob([lines.join('\n')], { type: 'text/plain;charset=utf-8' });
          const url = URL.createObjectURL(blob);
          const link = document.createElement('a');
          link.href = url;
          link.setAttribute('download', filename);
          document.body.appendChild(link);
          link.click();
          document.body.removeChild(link);
          URL.revokeObjectURL(url);
          setExportStatus('Chat history exported successfully as .txt!');
          setExporting(false);
          setTimeout(() => setExportStatus(null), 4000);
          return;
        }
      }
    } catch (err) {
      console.error('Client fallback export failed', err);
    }

    window.open('/api/logs/export', '_blank');
    setExporting(false);
    setExportStatus('Export file requested from server.');
    setTimeout(() => setExportStatus(null), 4000);
  };

  return (
    <div className="max-w-4xl space-y-8">
      {/* Chat & Activity Export Section */}
      <div className="bg-[var(--color-page)] p-6 rounded-md border border-[var(--color-border)] space-y-4 shadow-xs">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <FileText className="w-4 h-4 text-[var(--color-accent)] stroke-[1.75]" />
            <div>
              <h3 className="text-sm font-semibold text-[var(--color-text-primary)]">Chat History & Activity Export</h3>
              <p className="text-xs text-[var(--color-text-secondary)] mt-0.5">
                Download the complete conversation transcript between User and Agent along with timestamps in .txt format.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={handleExportChat}
            disabled={exporting}
            id="export-chat-settings-btn"
            className="flex items-center gap-2 bg-[var(--color-surface)] hover:bg-[var(--color-hover)] text-[var(--color-text-primary)] border border-[var(--color-border)] px-3.5 py-2 rounded-md text-xs font-medium transition-all shadow-xs cursor-pointer disabled:opacity-50"
            title="Export all chat conversations to a .txt file"
          >
            <Download className={`w-3.5 h-3.5 text-[var(--color-accent)] ${exporting ? 'animate-bounce' : ''}`} />
            <span>{exporting ? 'Generating .txt...' : 'Export Chat History (.txt)'}</span>
          </button>
        </div>

        {exportStatus && (
          <div className="flex items-center gap-2 text-xs text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/30 p-2.5 rounded border border-emerald-200 dark:border-emerald-800">
            <CheckCircle2 className="w-4 h-4 shrink-0" />
            <span>{exportStatus}</span>
          </div>
        )}
      </div>

      <form onSubmit={handleSave} className="space-y-8">
        {/* OmniRoute Connection */}
        <div className="bg-[var(--color-page)] p-6 rounded-md border border-[var(--color-border)] space-y-4">
          <div className="flex items-center gap-2">
            <Shield className="w-4 h-4 text-[var(--color-text-secondary)] stroke-[1.75]" />
            <h3 className="text-sm font-semibold text-[var(--color-text-primary)]">OmniRoute Proxy</h3>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
            <div>
              <label className="block text-[var(--color-text-secondary)] mb-1.5 font-medium">Local Proxy Endpoint</label>
              <input
                type="text"
                placeholder="Proxy URL (optional)"
                className="w-full bg-[var(--color-surface)] border border-[var(--color-border)] rounded-md px-3 py-2 text-[var(--color-text-primary)] focus:outline-none focus:ring-1 focus:ring-[var(--color-accent)]"
              />
            </div>
            <div>
              <label className="block text-[var(--color-text-secondary)] mb-1.5 font-medium">Event Collector Port</label>
              <input
                type="text"
                placeholder="Port (optional)"
                className="w-full bg-[var(--color-surface)] border border-[var(--color-border)] rounded-md px-3 py-2 text-[var(--color-text-primary)] focus:outline-none focus:ring-1 focus:ring-[var(--color-accent)]"
              />
            </div>
          </div>
        </div>

        {/* Budget & Quota Constraints */}
        <div className="bg-[var(--color-page)] p-6 rounded-md border border-[var(--color-border)] space-y-4">
          <div className="flex items-center gap-2">
            <Bell className="w-4 h-4 text-[var(--color-text-secondary)] stroke-[1.75]" />
            <h3 className="text-sm font-semibold text-[var(--color-text-primary)]">Budget & Alerts</h3>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
            <div>
              <label className="block text-[var(--color-text-secondary)] mb-1.5 font-medium">Daily Budget Limit ($)</label>
              <input
                type="number"
                defaultValue="50.00"
                step="5.00"
                className="w-full bg-[var(--color-surface)] border border-[var(--color-border)] rounded-md px-3 py-2 text-[var(--color-text-primary)] focus:outline-none focus:ring-1 focus:ring-[var(--color-accent)]"
              />
            </div>
            <div>
              <label className="block text-[var(--color-text-secondary)] mb-1.5 font-medium">Quota Warning Alert (%)</label>
              <input
                type="number"
                defaultValue="80"
                className="w-full bg-[var(--color-surface)] border border-[var(--color-border)] rounded-md px-3 py-2 text-[var(--color-text-primary)] focus:outline-none focus:ring-1 focus:ring-[var(--color-accent)]"
              />
            </div>
            <div>
              <label className="block text-[var(--color-text-secondary)] mb-1.5 font-medium">Assignment Strategy</label>
              <select className="w-full bg-[var(--color-surface)] border border-[var(--color-border)] rounded-md px-3 py-2 text-[var(--color-text-primary)] focus:outline-none focus:ring-1 focus:ring-[var(--color-accent)]">
                <option>AI Recommendation w/ Approval</option>
                <option>Manual Assignment Only</option>
                <option>Automatic within Budget</option>
              </select>
            </div>
          </div>
        </div>

        {/* Data Retention */}
        <div className="bg-[var(--color-page)] p-6 rounded-md border border-[var(--color-border)] space-y-4">
          <div className="flex items-center gap-2">
            <Database className="w-4 h-4 text-[var(--color-text-secondary)] stroke-[1.75]" />
            <h3 className="text-sm font-semibold text-[var(--color-text-primary)]">Retention & Privacy</h3>
          </div>
          <div className="text-xs space-y-2.5">
            <div className="flex items-center gap-2.5">
              <input type="checkbox" defaultChecked className="rounded border-[var(--color-border)] text-[var(--color-accent)] focus:ring-[var(--color-accent)]" id="sanitize" />
              <label htmlFor="sanitize" className="text-[var(--color-text-secondary)]">Redact prompt secrets/credentials</label>
            </div>
            <div className="flex items-center gap-2.5">
              <input type="checkbox" defaultChecked className="rounded border-[var(--color-border)] text-[var(--color-accent)] focus:ring-[var(--color-accent)]" id="persist" />
              <label htmlFor="persist" className="text-[var(--color-text-secondary)]">Persist execution history locally</label>
            </div>
          </div>
        </div>

        <div className="flex justify-end gap-3 pt-2">
          <button
            type="submit"
            className="flex items-center gap-2 bg-[var(--color-text-primary)] text-[var(--color-page)] px-4 py-2 rounded-md text-xs font-semibold hover:opacity-90 transition-opacity"
          >
            {saved ? <Check className="w-3.5 h-3.5" /> : null}
            {saved ? 'Saved' : 'Save Preferences'}
          </button>
        </div>
      </form>
    </div>
  );
}
