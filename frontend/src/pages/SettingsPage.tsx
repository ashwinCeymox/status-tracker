import { useState } from 'react';
import { Shield, Bell, Database, Check } from 'lucide-react';

export default function SettingsPage() {
  const [saved, setSaved] = useState(false);

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  return (
    <div className="max-w-4xl space-y-8">
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
                defaultValue="http://127.0.0.1:20128"
                className="w-full bg-[var(--color-surface)] border border-[var(--color-border)] rounded-md px-3 py-2 text-[var(--color-text-primary)] focus:outline-none focus:ring-1 focus:ring-[var(--color-accent)]"
              />
            </div>
            <div>
              <label className="block text-[var(--color-text-secondary)] mb-1.5 font-medium">Event Collector Port</label>
              <input
                type="text"
                defaultValue="20131"
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
