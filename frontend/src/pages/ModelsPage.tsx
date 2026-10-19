import { useState, useEffect } from 'react';
import { Search, CheckCircle2, ShieldAlert, AlertTriangle, RefreshCw, Clock } from 'lucide-react';

interface RecentModelItem {
  id: string;
  name: string;
  provider: string;
  capabilities: string;
  availability: string;
  context_length: number;
  max_output_tokens: number;
  last_used_timestamp: string | null;
  input_tokens: number;
  output_tokens: number;
  total_tokens: number;
  feature_worked_on: string;
  task_objective: string;
  pricing_input: number;
  pricing_output: number;
  pricing_cached: number;
  estimated_cost?: number;
}

export default function ModelsPage() {
  const [models, setModels] = useState<RecentModelItem[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchData = () => {
    setLoading(true);
    setError(null);
    fetch('http://127.0.0.1:8000/api/models/')
      .then(res => {
        if (!res.ok) {
          throw new Error(`OmniRoute error: ${res.statusText}`);
        }
        return res.json();
      })
      .then(data => {
        setModels(data);
        setLoading(false);
      })
      .catch(err => {
        setError(err.message || 'OmniRoute unreachable');
        setLoading(false);
      });
  };

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 30000);
    return () => clearInterval(interval);
  }, []);

  const filteredModels = models.filter(m =>
    m.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    m.feature_worked_on.toLowerCase().includes(searchTerm.toLowerCase()) ||
    m.provider.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="max-w-5xl mx-auto space-y-8">
      {/* Overview Header */}
      <div className="bg-[var(--color-page)] p-5 rounded-md border border-[var(--color-border)] space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <ShieldAlert className="w-4 h-4 text-emerald-600 dark:text-emerald-400 stroke-[1.75]" />
            <h3 className="text-sm font-semibold text-[var(--color-text-primary)]">Anti-Gravity Combo — Recently Used Models & Features</h3>
          </div>
          <button
            onClick={fetchData}
            className="flex items-center gap-1.5 text-xs text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] px-2.5 py-1 rounded border border-[var(--color-border)] hover:bg-[var(--color-hover)] transition-colors"
          >
            <RefreshCw className="w-3 h-3" />
            Refresh
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <div className="bg-[var(--color-surface)] p-3 rounded-md border border-[var(--color-border)] space-y-1">
            <span className="text-xs text-[var(--color-text-secondary)]">Active Combo</span>
            <p className="text-lg font-semibold text-[var(--color-text-primary)]">anti-gravity (Round-robin)</p>
          </div>
          <div className="bg-[var(--color-surface)] p-3 rounded-md border border-[var(--color-border)] space-y-1">
            <span className="text-xs text-[var(--color-text-secondary)]">Models Tracked</span>
            <p className="text-lg font-semibold text-[var(--color-text-primary)]">{models.length}</p>
          </div>
          <div className="bg-[var(--color-surface)] p-3 rounded-md border border-[var(--color-border)] space-y-1">
            <span className="text-xs text-[var(--color-text-secondary)]">Status</span>
            <p className="text-lg font-semibold text-emerald-600 dark:text-emerald-400 flex items-center gap-1.5">
              <CheckCircle2 className="w-4 h-4" /> Operational
            </p>
          </div>
        </div>
      </div>

      {/* Recently Used Models & Features Table */}
      <div className="bg-[var(--color-page)] rounded-md border border-[var(--color-border)] overflow-hidden">
        <div className="p-3 border-b border-[var(--color-border)] flex items-center justify-between">
          <div className="relative w-80">
            <Search className="w-3.5 h-3.5 absolute left-3 top-2.5 text-[var(--color-text-muted)]" />
            <input
              type="text"
              placeholder="Search by model, feature, or provider..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full bg-[var(--color-surface)] border border-[var(--color-border)] rounded-md pl-8 pr-3 py-1.5 text-xs text-[var(--color-text-primary)] focus:outline-none focus:ring-1 focus:ring-[var(--color-accent)] focus:border-[var(--color-accent)]"
            />
          </div>
          <span className="text-xs text-[var(--color-text-secondary)]">{filteredModels.length} entries</span>
        </div>

        {loading ? (
          <div className="p-12 text-center text-xs text-[var(--color-text-secondary)]">Loading model execution history...</div>
        ) : error ? (
          <div className="p-8 text-center text-xs text-amber-700 dark:text-amber-400 bg-amber-50/50 dark:bg-amber-950/20 flex flex-col items-center justify-center gap-2">
            <AlertTriangle className="w-5 h-5 text-amber-600 dark:text-amber-400" />
            <span>Error: {error}</span>
          </div>
        ) : (
          <div className="overflow-x-auto max-h-[550px]">
            <table className="w-full text-left text-xs">
              <thead className="bg-[var(--color-surface)] text-[var(--color-text-secondary)] border-b border-[var(--color-border)] sticky top-0">
                <tr>
                  <th className="px-4 py-2.5 font-medium">Model Name</th>
                  <th className="px-4 py-2.5 font-medium">Feature / Task Worked On</th>
                  <th className="px-4 py-2.5 font-medium">Tokens Used</th>
                  <th className="px-4 py-2.5 font-medium">Pricing & Est. Cost</th>
                  <th className="px-4 py-2.5 font-medium">Context / Output</th>
                  <th className="px-4 py-2.5 font-medium">Last Used (Date & Time)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--color-border)]">
                {filteredModels.map((m) => (
                  <tr key={m.id} className="hover:bg-[var(--color-hover)] transition-colors">
                    <td className="px-4 py-3 align-top">
                      <div className="font-mono text-[11px] font-medium text-[var(--color-text-primary)]">{m.name}</div>
                      <div className="text-[10px] text-[var(--color-text-muted)] mt-0.5">{m.provider}</div>
                    </td>
                    <td className="px-4 py-3 align-top max-w-xs">
                      <div className="font-medium text-[var(--color-text-primary)]">{m.feature_worked_on}</div>
                      <div className="text-[11px] text-[var(--color-text-secondary)] mt-0.5 truncate">{m.task_objective}</div>
                    </td>
                    <td className="px-4 py-3 align-top">
                      {m.total_tokens > 0 ? (
                        <div className="space-y-0.5 font-mono text-[11px]">
                          <div className="text-[var(--color-text-primary)]">{(m.total_tokens).toLocaleString()} total</div>
                          <div className="text-[10px] text-[var(--color-text-muted)]">
                            (in: {m.input_tokens.toLocaleString()} / out: {m.output_tokens.toLocaleString()})
                          </div>
                        </div>
                      ) : (
                        <span className="text-[var(--color-text-muted)] italic">Ready</span>
                      )}
                    </td>
                    <td className="px-4 py-3 align-top font-mono text-[11px]">
                      <div className="text-[var(--color-text-primary)]">Est: ${((m.estimated_cost || 0)).toFixed(4)}</div>
                      <div className="text-[10px] text-[var(--color-text-muted)]">In: ${m.pricing_input.toFixed(2)} | Out: ${m.pricing_output.toFixed(2)} /M</div>
                    </td>
                    <td className="px-4 py-3 align-top text-[var(--color-text-secondary)] font-mono text-[11px]">
                      <div>Ctx: {(m.context_length / 1024).toFixed(0)}k</div>
                      <div className="text-[10px] text-[var(--color-text-muted)] mt-0.5">Max Out: {(m.max_output_tokens / 1024).toFixed(0)}k</div>
                    </td>
                    <td className="px-4 py-3 align-top text-[var(--color-text-secondary)] whitespace-nowrap">
                      {m.last_used_timestamp ? (
                        <div className="space-y-0.5 text-[11px]">
                          <div className="font-medium text-[var(--color-text-primary)]">
                            {new Date(m.last_used_timestamp).toLocaleDateString([], { year: 'numeric', month: 'short', day: 'numeric' })}
                          </div>
                          <div className="flex items-center gap-1 text-[10px] text-[var(--color-text-muted)]">
                            <Clock className="w-3 h-3" />
                            {new Date(m.last_used_timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                          </div>
                        </div>
                      ) : (
                        <span className="text-[var(--color-text-muted)]">Never</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
