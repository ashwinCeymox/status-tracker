import { useState, useEffect, useRef, Fragment } from 'react';
import {
  Search,
  CheckCircle2,
  Info,
  ChevronDown,
  ChevronRight,
  Download,
  MessageSquare,
  List,
  User,
  Bot,
  Copy,
  Check
} from 'lucide-react';

interface LogItem {
  id: string | number;
  timestamp?: string;
  event_type?: string;
  model_name?: string;
  status?: string;
  summary?: string;
  details?: string;
  session_name?: string;
  session_id?: string | number;
  role?: string;
}

export default function LogsPage() {
  const [logs, setLogs] = useState<LogItem[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [viewMode, setViewMode] = useState<'chat' | 'table'>('chat');
  const [expandedLogId, setExpandedLogId] = useState<string | number | null>(null);
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);
  const [copiedId, setCopiedId] = useState<string | number | null>(null);
  const [exportNotification, setExportNotification] = useState<string | null>(null);
  const bottomChatRef = useRef<HTMLDivElement>(null);
  const hasAutoScrolled = useRef(false);

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

  // When user opens Activity Logs, automatically smooth scroll down to the bottom of the chat
  useEffect(() => {
    if (!loading && logs.length > 0 && viewMode === 'chat' && !hasAutoScrolled.current) {
      hasAutoScrolled.current = true;
      const timer = setTimeout(() => {
        if (bottomChatRef.current) {
          bottomChatRef.current.scrollIntoView({ behavior: 'smooth', block: 'end' });
        }
      }, 400);
      return () => clearTimeout(timer);
    }
  }, [loading, logs, viewMode]);

  const toggleExpand = (id: string | number) => {
    setExpandedLogId(expandedLogId === id ? null : id);
  };

  const copyToClipboard = (text: string, id: string | number) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const triggerDownload = (content: string, filename: string) => {
    const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', filename);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const isUserEvent = (evType?: string) => {
    const t = (evType || '').toLowerCase();
    return t === 'user_prompt' || t === 'user';
  };

  const isAgentEvent = (evType?: string) => {
    const t = (evType || '').toLowerCase();
    return t === 'ai_response' || t === 'ai' || t === 'assistant' || t === 'chat';
  };

  const formatTimestamp = (ts?: string) => {
    if (!ts) return 'N/A';
    try {
      const d = new Date(ts);
      if (isNaN(d.getTime())) return ts;
      return d.toLocaleString(undefined, {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: false
      });
    } catch {
      return ts;
    }
  };

  const formatShortTime = (ts?: string) => {
    if (!ts) return '';
    try {
      const d = new Date(ts);
      if (isNaN(d.getTime())) return ts;
      return d.toLocaleTimeString(undefined, {
        hour: '2-digit',
        minute: '2-digit',
        hour12: false
      });
    } catch {
      return ts;
    }
  };

  const generateClientChatTxt = (items: LogItem[], sessionFilter?: string) => {
    const now = new Date().toISOString();
    let targetItems = [...items];
    if (sessionFilter) {
      targetItems = targetItems.filter(l => (l.session_name || 'Session 1') === sessionFilter);
    }

    const lines: string[] = [
      '================================================================================',
      'TOKEN MONITOR & PLANNING STUDIO - CHAT HISTORY EXPORT',
      `Exported At:   ${now}`,
      `Total Records: ${targetItems.length}`,
      ...(sessionFilter ? [`Session Scope: ${sessionFilter}`] : []),
      '================================================================================\n'
    ];

    if (!targetItems || targetItems.length === 0) {
      lines.push('No chat or activity log records found.\n');
      return lines.join('\n');
    }

    // Sort chronologically (oldest first for dialogue flow)
    const sorted = [...targetItems].sort((a, b) => {
      const ta = new Date(a.timestamp || 0).getTime();
      const tb = new Date(b.timestamp || 0).getTime();
      return ta - tb;
    });

    const bySession: { [key: string]: LogItem[] } = {};
    for (const log of sorted) {
      const sName = log.session_name || 'Session 1';
      if (!bySession[sName]) bySession[sName] = [];
      bySession[sName].push(log);
    }

    for (const [sName, sLogs] of Object.entries(bySession)) {
      lines.push('--------------------------------------------------------------------------------');
      lines.push(sName);
      lines.push('--------------------------------------------------------------------------------\n');

      for (const log of sLogs) {
        const ts = log.timestamp ? new Date(log.timestamp).toISOString() : 'N/A';
        const evType = (log.event_type || 'event').toUpperCase();
        const model = log.model_name ? ` (${log.model_name})` : '';

        let role = `${evType}${model}`;
        if (isUserEvent(log.event_type)) {
          role = 'USER';
        } else if (isAgentEvent(log.event_type)) {
          role = `AGENT${model}`;
        }

        const content = (log.details || log.summary || '(Empty content)').trim();
        lines.push(`[${ts}] ${role}:`);
        lines.push(content);
        lines.push('');
      }
      lines.push('');
    }

    return lines.join('\n');
  };

  const handleExportTxt = async (sessionScope?: string) => {
    setExporting(true);
    const dateStr = new Date().toISOString().slice(0, 10);
    const scopeLabel = sessionScope ? `-${sessionScope.toLowerCase().replace(/\s+/g, '-')}` : '';
    const filename = `chat-export${scopeLabel}-${dateStr}.txt`;

    try {
      // If there is an active search filter or session filter, generate export from the filtered in-memory dataset
      if ((searchTerm.trim() && filteredLogs.length > 0) || sessionScope) {
        const txt = generateClientChatTxt(filteredLogs, sessionScope);
        triggerDownload(txt, filename);
        showExportNotice(`Exported ${filteredLogs.length} events to ${filename}`);
        setExporting(false);
        return;
      }

      // Otherwise try calling the backend export endpoint
      const res = await fetch('/api/logs/export').catch(() => fetch('http://127.0.0.1:8000/api/logs/export'));
      if (res && res.ok) {
        const text = await res.text();
        triggerDownload(text, filename);
        showExportNotice(`Exported chat history to ${filename}`);
        setExporting(false);
        return;
      }
    } catch (e) {
      console.warn("Backend export request failed, falling back to browser generation", e);
    }

    // Client-side fallback
    const fallbackTxt = generateClientChatTxt(filteredLogs.length > 0 ? filteredLogs : logs, sessionScope);
    triggerDownload(fallbackTxt, filename);
    showExportNotice(`Exported chat history to ${filename}`);
    setExporting(false);
  };

  const showExportNotice = (msg: string) => {
    setExportNotification(msg);
    setTimeout(() => setExportNotification(null), 3500);
  };

  const filteredLogs = logs.filter(log => {
    const q = searchTerm.toLowerCase();
    return (
      (log?.summary || '').toLowerCase().includes(q) ||
      (log?.details || '').toLowerCase().includes(q) ||
      (log?.model_name && log.model_name.toLowerCase().includes(q)) ||
      (log?.event_type && log.event_type.toLowerCase().includes(q)) ||
      (log?.session_name && log.session_name.toLowerCase().includes(q))
    );
  });

  // Group filtered logs by session for Chat View
  // Sorted chronologically within each session
  const sessionGroups: { [name: string]: LogItem[] } = {};
  for (const log of filteredLogs) {
    const sName = log.session_name || 'Session 1';
    if (!sessionGroups[sName]) sessionGroups[sName] = [];
    sessionGroups[sName].push(log);
  }

  // Sort messages chronologically (oldest first for dialogue order)
  Object.keys(sessionGroups).forEach(sName => {
    sessionGroups[sName].sort((a, b) => {
      const ta = new Date(a.timestamp || 0).getTime();
      const tb = new Date(b.timestamp || 0).getTime();
      return ta - tb;
    });
  });

  if (loading) {
    return (
      <div className="p-12 text-center text-sm text-[var(--color-text-secondary)]">
        Loading activity &amp; chat logs...
      </div>
    );
  }

  return (
    <div className={`${viewMode === 'chat' ? 'max-w-[720px]' : 'max-w-5xl'} mx-auto space-y-5 transition-all duration-150`}>
      {/* Export Toast Notification */}
      {exportNotification && (
        <div className="bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-300 dark:border-emerald-700/50 text-emerald-800 dark:text-emerald-200 px-4 py-2.5 rounded-md text-xs flex items-center justify-between shadow-sm animate-fade-in">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
            <span className="font-medium">{exportNotification}</span>
          </div>
          <button
            onClick={() => setExportNotification(null)}
            className="text-emerald-600 dark:text-emerald-400 hover:opacity-75 text-xs font-semibold px-1"
          >
            ✕
          </button>
        </div>
      )}

      {/* Main Container */}
      <div className="bg-[var(--color-page)] rounded-md border border-[var(--color-border)] overflow-hidden shadow-sm">
        {/* Top Control Bar */}
        <div className="p-3 border-b border-[var(--color-border)] flex flex-wrap items-center justify-between gap-3 bg-[var(--color-surface)]/50">
          {/* Left: Search input */}
          <div className="relative w-72 sm:w-80">
            <Search className="w-3.5 h-3.5 absolute left-3 top-2.5 text-[var(--color-text-muted)]" />
            <input
              type="text"
              placeholder="Search chat & activity logs..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full bg-[var(--color-page)] border border-[var(--color-border)] rounded-md pl-8 pr-3 py-1.5 text-xs text-[var(--color-text-primary)] placeholder-[var(--color-text-muted)] focus:outline-none focus:ring-1 focus:ring-[var(--color-accent)] focus:border-[var(--color-accent)] transition-all"
            />
            {searchTerm && (
              <button
                onClick={() => setSearchTerm('')}
                className="absolute right-2.5 top-2 text-xs text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)]"
                title="Clear search"
              >
                ✕
              </button>
            )}
          </div>

          {/* Right: View Toggles & Export Button */}
          <div className="flex items-center gap-2.5">
            {/* View Switcher: Chat View vs Table View */}
            <div className="inline-flex rounded-md border border-[var(--color-border)] bg-[var(--color-page)] p-0.5 text-xs">
              <button
                onClick={() => setViewMode('chat')}
                className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded text-xs font-medium transition-colors cursor-pointer ${
                  viewMode === 'chat'
                    ? 'bg-[var(--color-accent)] text-white shadow-xs'
                    : 'text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] hover:bg-[var(--color-hover)]'
                }`}
                title="View as interactive conversation history between User and Agent"
              >
                <MessageSquare className="w-3.5 h-3.5" />
                <span>Chat View</span>
              </button>
              <button
                onClick={() => setViewMode('table')}
                className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded text-xs font-medium transition-colors cursor-pointer ${
                  viewMode === 'table'
                    ? 'bg-[var(--color-accent)] text-white shadow-xs'
                    : 'text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] hover:bg-[var(--color-hover)]'
                }`}
                title="View as structured event log table"
              >
                <List className="w-3.5 h-3.5" />
                <span>Table View</span>
              </button>
            </div>

            <span className="text-xs text-[var(--color-text-secondary)]">
              {filteredLogs.length} events
            </span>
          </div>
        </div>

        {/* Content Area */}
        {filteredLogs.length === 0 ? (
          <div className="p-12 text-center text-xs text-[var(--color-text-muted)] space-y-2">
            <MessageSquare className="w-8 h-8 mx-auto opacity-30 stroke-[1.5]" />
            <p className="font-medium text-[var(--color-text-secondary)]">No activity logs or chat records found</p>
            {searchTerm ? (
              <p>No records matching "{searchTerm}". Try clearing your search.</p>
            ) : (
              <p>Execute Claude commands or sync to start recording conversations.</p>
            )}
          </div>
        ) : viewMode === 'chat' ? (
          /* ========================================================================= */
          /* CHAT VIEW: WhatsApp-Style User vs Agent Conversation Stream               */
          /* ========================================================================= */
          <div className="p-3 sm:p-4 space-y-6 bg-slate-100/50 dark:bg-zinc-950/40">
            {Object.entries(sessionGroups).map(([sessionName, sessionLogs], sIdx) => (
              <div
                key={sessionName}
                className="bg-[var(--color-page)] p-4 sm:p-5 rounded-xl border border-[var(--color-border)] shadow-xs space-y-4 w-full"
              >
                {/* Session Header */}
                <div className="flex items-center justify-between pb-3 border-b border-[var(--color-border)]">
                  <div className="flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 inline-block shadow-[0_0_6px_rgba(16,185,129,0.5)]"></span>
                    <h3 className="text-xs font-bold uppercase tracking-wider text-[var(--color-text-primary)]">
                      {sessionName}
                    </h3>
                    <span className="text-[11px] text-[var(--color-text-muted)] font-mono bg-[var(--color-surface)] px-2 py-0.5 rounded-full border border-[var(--color-border)]">
                      {sessionLogs.length} turns
                    </span>
                  </div>
                  <button
                    onClick={() => handleExportTxt(sessionName)}
                    className="inline-flex items-center gap-1.5 text-xs text-[var(--color-text-primary)] hover:text-[var(--color-accent)] px-2.5 py-1 rounded-md border border-[var(--color-border)] bg-[var(--color-surface)] hover:bg-[var(--color-hover)] transition-colors cursor-pointer shadow-2xs font-medium"
                    title={`Export ${sessionName} chat history in .txt format`}
                  >
                    <Download className="w-3.5 h-3.5 text-[var(--color-accent)]" />
                    <span>Export Session (.txt)</span>
                  </button>
                </div>

                {/* Messages in this session */}
                <div className="space-y-3 pt-1">
                  {sessionLogs.map((log, idx) => {
                    const isUser = isUserEvent(log.event_type);
                    const isAgent = isAgentEvent(log.event_type);
                    const key = log.id || `${sessionName}-${idx}`;
                    const content = log.details || log.summary || '';

                    return (
                      <div
                        key={key}
                        className={`flex items-end gap-2 my-2 ${
                          isUser
                            ? 'justify-end'
                            : isAgent
                            ? 'justify-start'
                            : 'justify-center my-3'
                        }`}
                      >
                        {/* System / non-chat event: Centered WhatsApp pill badge */}
                        {!isUser && !isAgent ? (
                          <div className="bg-[var(--color-surface)] border border-[var(--color-border)] text-[var(--color-text-secondary)] text-[11px] font-mono px-3 py-1 rounded-full shadow-xs max-w-md text-center">
                            <span className="font-semibold uppercase mr-1">[{log.event_type || 'EVENT'}]</span>
                            <span>{content}</span>
                            <span className="opacity-60 ml-2 text-[10px]">({formatTimestamp(log.timestamp)})</span>
                          </div>
                        ) : (
                          <>
                            {/* Agent Avatar on the Left */}
                            {isAgent && (
                              <div
                                className="w-7 h-7 rounded-full bg-violet-600 dark:bg-violet-700 text-white flex items-center justify-center shrink-0 shadow-xs mb-1"
                                title="Claude Agent"
                              >
                                <Bot className="w-3.5 h-3.5" />
                              </div>
                            )}

                            {/* WhatsApp Speech Bubble */}
                            <div
                              className={`group relative w-fit max-w-[82%] sm:max-w-[70%] rounded-2xl px-3.5 py-2 shadow-xs transition-shadow ${
                                isUser
                                  ? 'bg-[#d9fdd3] dark:bg-[#005c4b] text-[#111b21] dark:text-[#e9edef] border border-[#bbf7d0]/80 dark:border-[#025144] rounded-br-xs'
                                  : 'bg-white dark:bg-[#202c33] text-[#111b21] dark:text-[#e9edef] border border-slate-200/90 dark:border-zinc-700/80 rounded-bl-xs'
                              }`}
                            >
                              {/* Floating Copy Button (appears on hover) */}
                              <button
                                onClick={() => copyToClipboard(content, key)}
                                className="opacity-0 group-hover:opacity-75 hover:!opacity-100 absolute top-1.5 right-1.5 p-1 rounded bg-black/5 dark:bg-white/10 hover:bg-black/10 dark:hover:bg-white/20 transition-all cursor-pointer z-10"
                                title="Copy message text"
                              >
                                {copiedId === key ? (
                                  <Check className="w-3 h-3 text-emerald-600 dark:text-emerald-400" />
                                ) : (
                                  <Copy className="w-3 h-3 text-[var(--color-text-muted)]" />
                                )}
                              </button>

                              {/* Agent Header: Sender label & model tag */}
                              {isAgent && (
                                <div className="flex items-center gap-1.5 mb-1 pr-6">
                                  <span className="text-[10px] font-bold tracking-wider uppercase text-violet-700 dark:text-violet-300">
                                    Claude
                                  </span>
                                  {log.model_name && (
                                    <span className="font-mono text-[9px] bg-slate-100 dark:bg-zinc-800 text-slate-600 dark:text-zinc-300 px-1.5 py-0.2 rounded border border-slate-200 dark:border-zinc-700">
                                      {log.model_name}
                                    </span>
                                  )}
                                </div>
                              )}

                              {/* Message Text Body */}
                              <div className={`text-[13px] leading-relaxed whitespace-pre-wrap font-sans break-words select-text ${isUser ? 'pr-2' : 'pr-4'}`}>
                                {content || <span className="italic opacity-50">(Empty message)</span>}
                              </div>

                              {/* Bubble Footer: Timestamp & WhatsApp double check ticks */}
                              <div
                                className={`flex items-center gap-1 text-[10px] font-mono mt-1 select-none ${
                                  isUser
                                    ? 'justify-end text-emerald-800/70 dark:text-emerald-300/70'
                                    : 'justify-end text-slate-400 dark:text-zinc-400'
                                }`}
                              >
                                <span title={formatTimestamp(log.timestamp)}>
                                  {formatShortTime(log.timestamp)}
                                </span>
                                {isUser && (
                                  <span className="text-emerald-600 dark:text-emerald-300 font-bold tracking-tighter" title="Delivered">
                                    ✓✓
                                  </span>
                                )}
                              </div>
                            </div>

                            {/* User Avatar on the Right */}
                            {isUser && (
                              <div
                                className="w-7 h-7 rounded-full bg-emerald-600 dark:bg-emerald-700 text-white flex items-center justify-center shrink-0 shadow-xs mb-1"
                                title="You (User)"
                              >
                                <User className="w-3.5 h-3.5" />
                              </div>
                            )}
                          </>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}

            {/* Bottom anchor to scroll to the end of chat */}
            <div ref={bottomChatRef} className="h-4" />
          </div>
        ) : (
          /* ========================================================================= */
          /* TABLE VIEW: Structured Event Log Table                                    */
          /* ========================================================================= */
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-[var(--color-surface)] text-[var(--color-text-secondary)] border-b border-[var(--color-border)]">
                <tr>
                  <th className="px-3 py-2.5 font-medium w-6"></th>
                  <th className="px-3 py-2.5 font-medium">Timestamp</th>
                  <th className="px-3 py-2.5 font-medium">Role / Event</th>
                  <th className="px-3 py-2.5 font-medium">Model</th>
                  <th className="px-3 py-2.5 font-medium">Status</th>
                  <th className="px-3 py-2.5 font-medium">Summary</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--color-border)]">
                {filteredLogs.map((log, idx) => {
                  const key = log.id || idx;
                  const isUser = isUserEvent(log.event_type);
                  const isAgent = isAgentEvent(log.event_type);

                  return (
                    <Fragment key={key}>
                      <tr
                        onClick={() => toggleExpand(key)}
                        className="hover:bg-[var(--color-hover)] cursor-pointer transition-colors h-11"
                      >
                        <td className="px-3 py-2 text-[var(--color-text-muted)]">
                          {expandedLogId === key ? (
                            <ChevronDown className="w-3.5 h-3.5" />
                          ) : (
                            <ChevronRight className="w-3.5 h-3.5" />
                          )}
                        </td>
                        <td className="px-3 py-2 text-[var(--color-text-secondary)] whitespace-nowrap font-mono text-[11px]">
                          {formatTimestamp(log.timestamp)}
                        </td>
                        <td className="px-3 py-2">
                          <div className="flex items-center gap-1.5">
                            <span
                              className={`font-mono text-[10px] px-1.5 py-0.5 rounded border ${
                                isUser
                                  ? 'bg-blue-50 dark:bg-blue-950/50 text-blue-700 dark:text-blue-300 border-blue-200 dark:border-blue-800'
                                  : isAgent
                                  ? 'bg-purple-50 dark:bg-purple-950/50 text-purple-700 dark:text-purple-300 border-purple-200 dark:border-purple-800'
                                  : 'bg-[var(--color-surface)] text-[var(--color-text-secondary)] border-[var(--color-border)]'
                              }`}
                            >
                              {isUser ? 'USER' : isAgent ? 'AGENT' : log.event_type || 'event'}
                            </span>
                            {log.session_name && (
                              <span className="text-[10px] text-[var(--color-text-muted)] font-mono">
                                {log.session_name}
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="px-3 py-2 font-medium text-[var(--color-text-primary)]">
                          {log.model_name || 'system'}
                        </td>
                        <td className="px-3 py-2">
                          <span
                            className={`inline-flex items-center gap-1 text-[11px] ${
                              log.status === 'success'
                                ? 'text-emerald-700 dark:text-emerald-400'
                                : 'text-amber-700 dark:text-amber-400'
                            }`}
                          >
                            {log.status === 'success' ? (
                              <CheckCircle2 className="w-3.5 h-3.5" />
                            ) : (
                              <Info className="w-3.5 h-3.5" />
                            )}
                            {log.status || 'info'}
                          </span>
                        </td>
                        <td className="px-3 py-2 text-[var(--color-text-primary)] truncate max-w-md">
                          {log.summary || 'No summary'}
                        </td>
                      </tr>

                      {expandedLogId === key && (
                        <tr className="bg-[var(--color-surface)]/40">
                          <td colSpan={6} className="px-6 py-3 text-xs text-[var(--color-text-secondary)]">
                            <div className="bg-[var(--color-page)] p-3 rounded-md border border-[var(--color-border)] space-y-2">
                              {log.session_name && (
                                <div className="text-[11px] text-[var(--color-text-muted)]">
                                  <span className="font-semibold text-[var(--color-text-primary)]">Session: </span>
                                  {log.session_name}
                                </div>
                              )}
                              <div>
                                <div className="font-semibold text-[var(--color-text-primary)] mb-1 text-[11px]">
                                  Full Message Details:
                                </div>
                                <div className="p-2.5 rounded bg-[var(--color-surface)] border border-[var(--color-border)] text-xs font-mono whitespace-pre-wrap max-h-60 overflow-y-auto">
                                  {log.details || log.summary || 'No extended payload stored.'}
                                </div>
                              </div>
                              <div className="flex justify-between items-center pt-1 text-[11px] text-[var(--color-text-muted)]">
                                <span>Storage: SQLite database &amp; session activity transcripts</span>
                                <button
                                  onClick={() => copyToClipboard(log.details || log.summary || '', `details-${key}`)}
                                  className="inline-flex items-center gap-1 text-xs text-[var(--color-accent)] hover:underline cursor-pointer"
                                >
                                  {copiedId === `details-${key}` ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                                  <span>{copiedId === `details-${key}` ? 'Copied' : 'Copy Text'}</span>
                                </button>
                              </div>
                            </div>
                          </td>
                        </tr>
                      )}
                    </Fragment>
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
