import { useState, useEffect } from 'react';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { Cpu, DollarSign, Calendar, Clock, FolderGit2, ArrowUpRight } from 'lucide-react';

interface RequestItem {
  id: string;
  timestamp: string;
  status: number;
  model: string;
  requestedModel: string;
  tokens: { in: number; out: number; cacheRead?: number };
}

export default function Dashboard() {
  const [summary, setSummary] = useState<any>(null);
  const [chartData, setChartData] = useState<any[]>([]);
  const [recentRequests, setRecentRequests] = useState<RequestItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const injected = (window as any).__DASHBOARD_DATA__;
    if (injected) {
      setSummary((prev: any) => ({ ...injected, ...prev }));
      setLoading(false);
    }

    const fetchDashboard = () => {
      Promise.all([
        fetch('/api/dashboard/summary').catch(() => fetch('http://127.0.0.1:8000/api/dashboard/summary')).then(res => res.json()),
        fetch('/api/dashboard/token-usage-over-time').catch(() => fetch('http://127.0.0.1:8000/api/dashboard/token-usage-over-time')).then(res => res.json()),
        fetch('/api/dashboard/recent-requests').catch(() => fetch('http://127.0.0.1:8000/api/dashboard/recent-requests')).then(res => res.json())
      ]).then(([summaryData, chartDataRes, requestsRes]) => {
        setSummary(summaryData);
        setChartData(Array.isArray(chartDataRes) ? chartDataRes : []);
        setRecentRequests(Array.isArray(requestsRes) ? requestsRes : []);
        setLoading(false);
      }).catch(err => {
        console.error("Failed to load dashboard data", err);
        if (!injected) setLoading(false);
      });
    };

    fetchDashboard();
    const interval = setInterval(fetchDashboard, 5000);
    return () => clearInterval(interval);
  }, []);

  if (loading) {
    return <div className="p-12 text-center text-sm text-[var(--color-text-secondary)]">Loading metrics...</div>;
  }

  const now = new Date();
  const currentDateStr = now.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  const currentDayOfWeek = now.toLocaleDateString('en-US', { weekday: 'long' });

  const rawStarted = summary?.started_at || (window as any).__PROJECTS_DATA__?.created_at || '2026-10-13T05:17:26.642Z';
  const startedDate = new Date(rawStarted);
  const startedDateStr = isNaN(startedDate.getTime()) ? 'Oct 13, 2026' : startedDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  const msElapsed = Math.max(0, now.getTime() - (isNaN(startedDate.getTime()) ? new Date('2026-10-13').getTime() : startedDate.getTime()));
  const daysElapsed = Math.max(1, Math.floor(msElapsed / (1000 * 60 * 60 * 24)));

  const formatMetricValue = (val: number | null | undefined) => {
    if (val === null || val === undefined) return 'No data yet';
    return val.toLocaleString();
  };

  const formatCostValue = (val: number | null | undefined) => {
    if (val === null || val === undefined) return 'No data yet';
    return `$${val.toFixed(2)}`;
  };

  const metrics = [
    { title: 'Project Build Input Tokens', value: formatMetricValue(summary?.total_input_tokens), icon: Cpu, change: summary?.row_count ? `${summary.row_count} calls ingested` : 'Measured' },
    { title: 'Project Build Output Tokens', value: formatMetricValue(summary?.total_output_tokens), icon: Cpu, change: summary?.total_reasoning ? `${summary.total_reasoning.toLocaleString()} reasoning` : 'Measured' },
    { title: 'Project Build Cost', value: formatCostValue(summary?.total_cost), icon: DollarSign, change: 'OmniRoute ledger' },
    { title: 'Current Date', value: currentDateStr, icon: Calendar, change: currentDayOfWeek },
    { title: 'Target Project', value: (window as any).__DASHBOARD_DATA__?.project_name || summary?.project_name || summary?.target_project || 'Current Project', icon: FolderGit2, change: summary?.status === 'no_data' ? 'Pending data' : 'Active ledger' },
    { title: 'Project Started', value: startedDateStr, icon: Clock, change: `${daysElapsed} day${daysElapsed === 1 ? '' : 's'} elapsed` },
  ];

  const formatTimeAgo = (isoString: string, active = true) => {
    if (!active) return '...';
    if (!isoString) return '...';
    const diffMs = Date.now() - new Date(isoString).getTime();
    const diffSecs = Math.floor(diffMs / 1000);
    if (diffSecs < 60) return `${Math.max(1, diffSecs)}s`;
    const diffMins = Math.floor(diffSecs / 60);
    if (diffMins < 60) return `${diffMins}m`;
    const diffHours = Math.floor(diffMins / 60);
    if (diffHours < 24) return `${diffHours}h`;
    return `${Math.floor(diffHours / 24)}d`;
  };

  const formatTokens = (n: number) => {
    if (!n || n <= 0) return '0';
    if (n >= 1000000) return `${(n / 1000000).toFixed(1)}M`;
    if (n >= 1000) return `${(n / 1000).toFixed(1)}K`;
    return `${n}`;
  };

  return (
    <div className="max-w-5xl mx-auto space-y-8">
      {/* Unpriced models alert */}
      {summary?.unpriced_models && summary.unpriced_models.length > 0 && (
        <div className="bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 text-amber-800 dark:text-amber-300 p-3.5 rounded-md text-xs flex items-center gap-2">
          <span>⚠️ <strong>Unpriced Model Warning:</strong> Calls using {summary.unpriced_models.join(', ')} are excluded from cost totals until added to <code>.planner/prices.json</code>.</span>
        </div>
      )}

      {/* Metrics Row */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-semibold text-[var(--color-text-primary)]">Key Metrics</h3>
          {summary?.last_updated && (
            <span className="text-[11px] font-mono text-[var(--color-text-muted)]">
              Last synced: {new Date(summary.last_updated).toLocaleTimeString()}
            </span>
          )}
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {metrics.map((m, idx) => {
            const Icon = m.icon;
            return (
              <div
                key={idx}
                className="bg-[var(--color-page)] p-4 rounded-md border border-[var(--color-border)] hover:bg-[var(--color-hover)] transition-colors flex items-start justify-between"
              >
                <div>
                  <p className="text-xs text-[var(--color-text-secondary)] font-normal">{m.title}</p>
                  <p className="text-xl font-semibold text-[var(--color-text-primary)] mt-1">{m.value}</p>
                  <div className="flex items-center gap-1 mt-1 text-[11px] text-emerald-700 dark:text-emerald-400">
                    <ArrowUpRight className="w-3 h-3" />
                    <span>{m.change}</span>
                  </div>
                </div>
                <div className="w-8 h-8 rounded-md bg-[var(--color-surface)] border border-[var(--color-border)] flex items-center justify-center text-[var(--color-text-secondary)]">
                  <Icon className="w-4 h-4 stroke-[1.75]" />
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Chart Section */}
      <div className="bg-[var(--color-page)] p-5 rounded-md border border-[var(--color-border)] space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-sm font-semibold text-[var(--color-text-primary)]">Project Build Token Consumption</h3>
            <p className="text-xs text-[var(--color-text-secondary)] mt-0.5">Tokens spent executing and building project features across phases</p>
          </div>
          <span className="text-xs bg-[var(--color-surface)] text-[var(--color-text-secondary)] border border-[var(--color-border)] px-2.5 py-1 rounded-md">
            7 Days
          </span>
        </div>

        <div className="h-64 w-full pt-2">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={chartData} margin={{ top: 5, right: 10, left: -20, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
              <XAxis dataKey="date" stroke="var(--color-text-muted)" fontSize={11} tickLine={false} />
              <YAxis stroke="var(--color-text-muted)" fontSize={11} tickLine={false} />
              <Tooltip
                contentStyle={{
                  background: 'var(--color-surface)',
                  borderColor: 'var(--color-border)',
                  borderRadius: '6px',
                  color: 'var(--color-text-primary)',
                  fontSize: '12px'
                }}
              />
              <Area type="monotone" dataKey="input" name="Input Tokens" stroke="#2383E2" fill="#2383E2" fillOpacity={0.08} strokeWidth={1.5} />
              <Area type="monotone" dataKey="output" name="Output Tokens" stroke="#9B9A97" fill="#9B9A97" fillOpacity={0.12} strokeWidth={1.5} />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Recent Requests Section */}
      <div className="bg-[var(--color-page)] rounded-lg border border-[var(--color-border)] p-5 space-y-4">
        <h3 className="text-xs font-semibold uppercase tracking-wider text-[var(--color-text-secondary)]">Recent Requests</h3>

        {recentRequests.length === 0 ? (
          <div className="p-8 text-center text-xs text-[var(--color-text-secondary)]">No recent requests recorded.</div>
        ) : (
          <div className="overflow-x-auto max-h-[420px]">
            <table className="w-full text-left text-xs">
              <thead className="text-[var(--color-text-secondary)] border-b border-[var(--color-border)]">
                <tr>
                  <th className="py-2.5 font-medium">Model</th>
                  <th className="py-2.5 font-medium text-right">In / Out</th>
                  <th className="py-2.5 font-medium text-right w-16">When</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--color-border)]/50">
                {recentRequests.map((req, idx) => {
                  const modelName = (req.model || req.requestedModel || 'unknown').replace(/^antigravity\//, '');
                  const hasTokens = (req.tokens?.in || 0) > 0 || (req.tokens?.out || 0) > 0;
                  const isOk = req.status === 200 && hasTokens;
                  return (
                    <tr key={req.id || idx} className="hover:bg-[var(--color-hover)] transition-colors">
                      <td className="py-2.5 align-middle">
                        <div className="flex items-center gap-2">
                          <span
                            className={`inline-block w-1.5 h-1.5 rounded-full shrink-0 ${isOk ? 'bg-emerald-400 shadow-[0_0_6px_rgba(52,211,153,0.9)]' : 'bg-rose-500 shadow-[0_0_6px_rgba(244,63,94,0.9)]'}`}
                          />
                          <span className="font-mono text-xs text-[var(--color-text-primary)]">{modelName}</span>
                        </div>
                      </td>
                      <td className="py-2.5 align-middle text-right font-mono text-xs">
                        <span className="text-rose-500 dark:text-rose-400 mr-2">{formatTokens(req.tokens?.in || 0)}↑</span>
                        <span className="text-emerald-500 dark:text-emerald-400">{formatTokens(req.tokens?.out || 0)}↓</span>
                      </td>
                      <td className="py-2.5 align-middle text-right text-[var(--color-text-muted)] font-mono text-xs whitespace-nowrap">
                        {formatTimeAgo(req.timestamp, isOk)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
