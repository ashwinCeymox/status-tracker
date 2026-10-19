import { useState, useEffect } from 'react';
import { FolderGit2, GitBranch, GitCommit, HardDrive, Layers } from 'lucide-react';

export default function ProjectsPage() {
  const [projects, setProjects] = useState<any[]>([]);
  const [hierarchy, setHierarchy] = useState<any>(null);
  const [activeTab, setActiveTab] = useState('Overview');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const injected = (window as any).__PROJECTS_DATA__;
    if (injected) {
      setProjects([injected]);
      setHierarchy(injected);
      setLoading(false);
    }

    const fetchProjects = () => {
      Promise.all([
        fetch('/api/projects/').catch(() => fetch('http://127.0.0.1:8000/api/projects/')).then(r => r.json()),
        fetch('/api/projects/1/hierarchy').catch(() => fetch('http://127.0.0.1:8000/api/projects/1/hierarchy')).then(r => r.json())
      ])
        .then(([pData, hData]) => {
          setProjects(Array.isArray(pData) ? pData : [pData]);
          setHierarchy(hData);
          setLoading(false);
        })
        .catch(err => {
          console.error("Failed to load project data", err);
          if (!injected) setLoading(false);
        });
    };

    fetchProjects();
    const interval = setInterval(fetchProjects, 5000);
    return () => clearInterval(interval);
  }, []);

  const project = projects[0];

  const tabs = ['Overview', 'Modules', 'Tasks', 'Model Usage'];

  if (loading) {
    return <div className="p-12 text-center text-sm text-[var(--color-text-secondary)]">Loading workspace...</div>;
  }

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      {/* Project Header Card */}
      <div className="bg-[var(--color-page)] p-5 rounded-md border border-[var(--color-border)] space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-md bg-[var(--color-surface)] border border-[var(--color-border)] flex items-center justify-center text-[var(--color-text-secondary)]">
              <FolderGit2 className="w-4 h-4 stroke-[1.75]" />
            </div>
            <div>
              <h2 className="text-base font-semibold text-[var(--color-text-primary)]">{project?.name}</h2>
              <p className="text-xs text-[var(--color-text-secondary)]">{project?.description}</p>
            </div>
          </div>
          <div>
            <span className="text-[11px] bg-emerald-50 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300 border border-emerald-200/50 dark:border-emerald-900/50 px-2 py-0.5 rounded capitalize font-medium">
              {project?.status}
            </span>
          </div>
        </div>

        <div className="pt-3 border-t border-[var(--color-border)] flex items-center gap-6 text-xs text-[var(--color-text-secondary)]">
          <div className="flex items-center gap-1.5">
            <HardDrive className="w-3.5 h-3.5 text-[var(--color-text-muted)]" />
            <span className="text-[var(--color-text-muted)]">Path:</span>
            <span className="font-mono text-[var(--color-text-primary)]">{project?.repository_path}</span>
          </div>
          <div className="flex items-center gap-1.5">
            <GitBranch className="w-3.5 h-3.5 text-[var(--color-text-muted)]" />
            <span className="text-[var(--color-text-muted)]">Branch:</span>
            <span className="text-[var(--color-text-primary)]">main</span>
          </div>
          <div className="flex items-center gap-1.5">
            <GitCommit className="w-3.5 h-3.5 text-[var(--color-text-muted)]" />
            <span className="text-[var(--color-text-muted)]">Stage:</span>
            <span className="capitalize text-[var(--color-text-primary)]">{project?.stage}</span>
          </div>
        </div>
      </div>

      {/* Workspace Tabs Navigation */}
      <div className="border-b border-[var(--color-border)] flex gap-2">
        {tabs.map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`pb-2 px-2 text-xs transition-colors border-b-2 ${
              activeTab === tab
                ? 'border-[var(--color-accent)] text-[var(--color-text-primary)] font-medium'
                : 'border-transparent text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] hover:border-[var(--color-border)]'
            }`}
          >
            {tab}
          </button>
        ))}
      </div>

      {/* Tab Content Display */}
      <div className="bg-[var(--color-page)] p-5 rounded-md border border-[var(--color-border)]">
        {activeTab === 'Overview' && (
          <div className="space-y-4">
            <h3 className="text-xs font-semibold text-[var(--color-text-primary)] uppercase tracking-wider">Execution Summary</h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <div className="p-3 bg-[var(--color-surface)] rounded-md border border-[var(--color-border)]">
                <span className="text-xs text-[var(--color-text-secondary)]">Total Modules</span>
                <p className="text-lg font-semibold text-[var(--color-text-primary)] mt-0.5">{hierarchy?.modules?.length || 0}</p>
              </div>
              <div className="p-3 bg-[var(--color-surface)] rounded-md border border-[var(--color-border)]">
                <span className="text-xs text-[var(--color-text-secondary)]">Total Tasks</span>
                <p className="text-lg font-semibold text-[var(--color-text-primary)] mt-0.5">
                    {hierarchy?.modules?.reduce((acc: number, m: any) => acc + (m.tasks?.length || 0), 0) || 0}
                </p>
              </div>
              <div className="p-3 bg-[var(--color-surface)] rounded-md border border-[var(--color-border)]">
                <span className="text-xs text-[var(--color-text-secondary)]">Active State</span>
                <p className="text-lg font-semibold text-[var(--color-text-primary)] mt-0.5 uppercase tracking-wider text-[var(--color-accent)]">{project?.stage}</p>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'Modules' && (
           <div className="space-y-3">
             <h3 className="text-xs font-semibold text-[var(--color-text-primary)] uppercase tracking-wider mb-2">Project Modules</h3>
             {hierarchy?.modules?.map((mod: any) => (
                <div key={mod.id} className="flex items-center justify-between p-3 bg-[var(--color-surface)] rounded-md border border-[var(--color-border)]">
                    <div className="flex items-center gap-2">
                        <Layers className="w-4 h-4 text-[var(--color-text-secondary)]" />
                        <span className="text-xs font-medium text-[var(--color-text-primary)]">{mod.name}</span>
                        <span className="text-[10px] text-[var(--color-text-muted)] bg-[var(--color-page)] px-1.5 py-0.5 rounded border border-[var(--color-border)]">{mod.category}</span>
                    </div>
                    <span className={`text-[10px] px-2 py-0.5 rounded capitalize ${mod.status === 'completed' ? 'text-emerald-700 bg-emerald-50' : 'text-sky-700 bg-sky-50'}`}>
                        {mod.status.replace('_', ' ')}
                    </span>
                </div>
             ))}
           </div>
        )}

        {activeTab === 'Tasks' && (
           <div className="space-y-3">
             <h3 className="text-xs font-semibold text-[var(--color-text-primary)] uppercase tracking-wider mb-2">All Tasks</h3>
             {hierarchy?.modules?.flatMap((m: any) => m.tasks || []).map((task: any) => (
                <div key={task.id} className="flex items-center justify-between p-3 bg-[var(--color-surface)] rounded-md border border-[var(--color-border)]">
                    <span className="text-xs text-[var(--color-text-primary)] truncate max-w-sm">{task.title}</span>
                    <span className={`text-[10px] px-2 py-0.5 rounded capitalize ${task.status === 'completed' ? 'text-emerald-700 bg-emerald-50' : 'text-sky-700 bg-sky-50'}`}>
                        {task.status.replace('_', ' ')}
                    </span>
                </div>
             ))}
           </div>
        )}

        {activeTab !== 'Overview' && activeTab !== 'Modules' && activeTab !== 'Tasks' && (
          <div className="py-12 text-center text-xs text-[var(--color-text-muted)]">
            Viewing records for <span className="font-medium text-[var(--color-text-secondary)]">{activeTab}</span>
          </div>
        )}
      </div>
    </div>
  );
}
