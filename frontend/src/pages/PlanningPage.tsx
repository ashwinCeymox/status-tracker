import { useState, useEffect } from 'react';
import { groupFlatPlanToDomains } from '../utils/planValidator';
import type { Plan } from '../utils/planValidator';
import { CheckCircle2 } from 'lucide-react';

export default function PlanningPage() {
  const [plan, setPlan] = useState<Plan | null>(null);
  const [activeTab, setActiveTab] = useState<'progress' | 'docs'>('progress');

  // Initialize plan from backend / .planner files
  useEffect(() => {
    const applyPlanData = (data: any) => {
      if (data && data.domains && Array.isArray(data.domains)) {
        const flatMods = data.domains.flatMap((d: any) => d.modules || []);
        const r = groupFlatPlanToDomains(flatMods, data.project_name || data.productIdea || 'Project Plan', data.globalNotes || '');
        if (r.plan) {
          setPlan(r.plan);
          return true;
        }
      }
      return false;
    };

    // 1. Immediately apply injected plan data if present
    if ((window as any).__PLAN_DATA__) {
      applyPlanData((window as any).__PLAN_DATA__);
    }

    // 2. Fetch live plan data from API
    const fetchPlan = async () => {
      try {
        const res = await fetch('/api/projects/plan').catch(() => fetch('http://127.0.0.1:8000/api/projects/plan'));
        const data = await res.json();
        applyPlanData(data);
      } catch (err) {
        console.error("Failed to load project plan:", err);
      }
    };
    fetchPlan();

    // Auto-refresh every 5 seconds so updates to .planner files reflect automatically
    const interval = setInterval(fetchPlan, 5000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="flex flex-col gap-6 p-6 h-full overflow-hidden">
      <div className="flex items-center justify-between gap-4">
        <h1 className="text-xl font-bold text-[var(--color-text-primary)]">Planning Studio & Architecture</h1>
        <div className="flex gap-2 bg-[var(--color-surface)] p-1 rounded-lg border border-[var(--color-border)]">
          {(['progress', 'docs'] as const).map(tab => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`px-3.5 py-1.5 text-xs font-semibold rounded-md capitalize ${activeTab === tab ? 'bg-[var(--color-page)] text-[var(--color-text-primary)] shadow-sm' : 'text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]'}`}
            >
              {tab === 'progress' ? 'Progress Info' : 'Docs'}
            </button>
          ))}
        </div>
      </div>

      {plan ? (
        <div className="flex-1 border border-[var(--color-border)] rounded-lg bg-[var(--color-page)] overflow-hidden flex flex-col">
          {/* 5.1 Progress Info (Compact view) */}
          {activeTab === 'progress' && (
            <div className="p-8 overflow-y-auto flex-1 max-w-4xl mx-auto w-full space-y-6">
              <div className="border-b border-[var(--color-border)] pb-4">
                <h2 className="text-lg font-bold text-[var(--color-text-primary)]">Progress Info</h2>
                <p className="text-xs text-[var(--color-text-secondary)] mt-1">Plan Title: <span className="font-semibold text-[var(--color-text-primary)]">{plan.productIdea || 'Project Plan'}</span></p>
              </div>

              <div className="space-y-3">
                <h3 className="text-xs font-semibold uppercase tracking-wider text-[var(--color-text-secondary)]">Feature List & State</h3>
                {plan.domains?.flatMap((d) => d.modules).map((mod, idx) => (
                  <div key={idx} className="bg-[var(--color-surface)] p-4 rounded-lg border border-[var(--color-border)] flex items-center justify-between gap-4">
                    <div className="flex items-center gap-3">
                      <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
                      <div>
                        <h4 className="text-xs font-semibold text-[var(--color-text-primary)]">{mod.title}</h4>
                        <p className="text-[11px] text-[var(--color-text-secondary)] truncate max-w-md">{mod.summary || mod.purpose}</p>
                      </div>
                    </div>
                    <span className="text-[10px] px-2 py-0.5 rounded bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-900 font-medium uppercase">
                      done
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* 5.2 Docs (Full view) */}
          {activeTab === 'docs' && (
            <div className="p-8 overflow-y-auto flex-1 max-w-3xl mx-auto w-full space-y-8 bg-[var(--color-page)]">
              <div className="border-b border-[var(--color-border)] pb-6">
                <h1 className="text-2xl font-bold text-[var(--color-text-primary)]">Project Implementation Plan (Full Specs)</h1>
                <p className="text-sm text-[var(--color-text-secondary)] mt-1">Comprehensive Roadmap, Goals, and File/Module Breakdown</p>
              </div>

              <div className="bg-[var(--color-surface)] p-6 rounded-lg border border-[var(--color-border)] space-y-4">
                <h3 className="text-sm font-semibold text-[var(--color-text-primary)] uppercase tracking-wider">Executive Summary & Goals</h3>
                <p className="text-xs text-[var(--color-text-secondary)] leading-relaxed">{plan.productIdea || 'No product idea specified.'}</p>
                {plan.globalNotes && (
                  <div className="pt-3 border-t border-[var(--color-border)] text-xs text-[var(--color-text-secondary)]">
                    <span className="font-semibold text-[var(--color-text-primary)]">Global Notes: </span>
                    {plan.globalNotes}
                  </div>
                )}
              </div>

              {plan.domains?.map((domain, index) => (
                <div key={index} className="space-y-4">
                  <h2 className="text-lg font-semibold text-[var(--color-text-primary)] border-b border-[var(--color-border)] pb-2 flex items-center justify-between">
                    <span>{index + 1}. {domain.title}</span>
                    <span className="text-xs font-mono text-[var(--color-text-muted)] font-normal uppercase">{domain.category}</span>
                  </h2>
                  <div className="space-y-4 pl-4">
                    {domain.modules?.map((mod, mIndex) => (
                      <div key={mIndex} className="bg-[var(--color-surface)] p-4 rounded-lg border border-[var(--color-border)] space-y-3">
                        <div className="flex items-center justify-between">
                          <h3 className="font-semibold text-sm text-[var(--color-text-primary)]">{mod.title}</h3>
                          <span className="text-xs px-2 py-0.5 rounded bg-[var(--color-page)] border border-[var(--color-border)] uppercase font-mono">
                            {mod.reviewStatus || 'approved'}
                          </span>
                        </div>
                        <div className="text-xs text-[var(--color-text-secondary)] bg-[var(--color-page)] p-3 rounded border border-[var(--color-border)] leading-relaxed">
                          <span className="font-semibold text-[var(--color-text-primary)] block mb-1">Module Objective & Description:</span>
                          {mod.summary || mod.purpose}
                        </div>

                        {mod.deliverables && mod.deliverables.length > 0 && (
                          <div className="text-xs text-[var(--color-text-secondary)] pt-1 space-y-1.5">
                            <div className="flex items-center justify-between">
                              <span className="font-semibold text-[var(--color-text-primary)]">File / Module Breakdown:</span>
                              <span className="text-[10px] bg-[var(--color-page)] px-2 py-0.5 rounded border border-[var(--color-border)] font-mono">
                                {mod.deliverables.length} files
                              </span>
                            </div>
                            <div className="max-h-48 overflow-y-auto bg-[var(--color-page)] p-2.5 rounded border border-[var(--color-border)] space-y-1">
                              {mod.deliverables.map((d: string, dIdx: number) => (
                                <div key={dIdx} className="font-mono text-[11px] text-[var(--color-text-primary)] flex items-center gap-1.5">
                                  <span className="text-[var(--color-text-muted)] select-none">📄</span>
                                  <span>{d}</span>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}

                        <div className="flex gap-4 text-xs font-mono pt-2 border-t border-[var(--color-border)]">
                          <div><span className="text-[var(--color-text-muted)]">Planned: </span><span className="text-amber-700 dark:text-amber-400 font-medium">{mod.complexity === 'high' ? '60,000' : '30,000'} tokens</span></div>
                          <div><span className="text-[var(--color-text-muted)]">Actual: </span><span className="text-emerald-700 dark:text-emerald-400 font-medium">Measured in usage.jsonl</span></div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      ) : (
        <div className="p-12 text-center text-[var(--color-text-secondary)] italic">
          No active project plan loaded. Try starting a new project.
        </div>
      )}
    </div>
  );
}
