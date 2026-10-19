#!/usr/bin/env node
const http = require('http');
const fs = require('fs');
const path = require('path');
const { spawn, spawnSync, execSync } = require('child_process');

const viewerDir = path.resolve(__dirname, '../viewer/');
const uiPort = 3001;
const apiPort = 8000;

// Kill port helper
function killOnPort(port) {
  try {
    const pids = execSync(`lsof -t -i:${port}`).toString().trim().split('\n');
    for (const pid of pids) {
      if (pid) {
        console.log(`Killing process ${pid} on port ${port}`);
        process.kill(parseInt(pid, 10), 'SIGKILL');
      }
    }
  } catch (e) {}
}

function isFastApiRunning(port = 8000) {
  try {
    const res = execSync(`curl -s -m 1 http://127.0.0.1:${port}/api/health`, { stdio: ['pipe', 'pipe', 'ignore'] }).toString();
    return res.includes('healthy');
  } catch (e) {
    return false;
  }
}

// 1. Automatically ensure project prerequisites and state exist on the fly
const { ensureProjectInitialized } = require('./init-project.js');
ensureProjectInitialized(process.cwd(), path.resolve(__dirname, '..'));

const planFilePath = path.resolve(process.cwd(), '.planner/plan.json');
const projectsFilePath = path.resolve(process.cwd(), '.planner/projects.json');
const dashboardFilePath = path.resolve(process.cwd(), '.planner/dashboard.json');
const activityFilePath = path.resolve(process.cwd(), '.planner/activity.json');

const { buildActivityData, setupSessionWatcher } = require('./activity-pipeline.js');
const { ingestOmniRouteLogs, computeDashboardFromLedger, reconcileWithCcusage, syncFromSqlite } = require('./usage-ledger.js');
const { scanProject: reconcilePlan } = require('./generate-plan.js');

// 2. Reconcile plan and sync SQLite usage records
reconcilePlan(process.cwd());
syncFromSqlite(process.cwd());

// Handle subcommands: /planning sync, /planning status
const args = process.argv.slice(2);
if (args.includes('sync')) {
  buildActivityData(process.cwd()).then(() => {
    console.log('✅ Synchronized workspace plan, usage ledger, and session activity.');
    process.exit(0);
  }).catch(() => process.exit(0));
  return;
}

if (args.includes('status')) {
  const dash = computeDashboardFromLedger(path.resolve(process.cwd(), '.planner/usage.jsonl'), path.basename(process.cwd()));
  const projPath = path.resolve(process.cwd(), '.planner/projects.json');
  let projName = path.basename(process.cwd());
  let modCount = 0;
  if (fs.existsSync(projPath)) {
    try {
      const p = JSON.parse(fs.readFileSync(projPath, 'utf8'));
      projName = p.name || projName;
      modCount = p.modules?.length || 0;
    } catch(e) {}
  }
  console.log('=== Planning Studio Status ===');
  console.log(`Project:        ${projName}`);
  console.log(`Modules:        ${modCount} modules tracked`);
  console.log(`Tokens (in/out): ${dash.total_input_tokens !== null ? dash.total_input_tokens.toLocaleString() + ' in / ' + (dash.total_output_tokens || 0).toLocaleString() + ' out' : 'No data yet'}`);
  console.log(`Cost:           ${dash.total_cost !== null ? '$' + dash.total_cost.toFixed(2) : 'No data yet'}`);
  console.log(`Ledger Status:  ${dash.status}`);
  process.exit(0);
}

// Starting UI Server: ensure UI port 3001 is clean
killOnPort(uiPort);

// Only kill port 8000 if FastAPI is NOT running
const fastApiActive = isFastApiRunning(apiPort);
if (!fastApiActive) {
  killOnPort(apiPort);
}

// Build initial activity.json and setup watch on session files
buildActivityData(process.cwd()).catch(() => {});
setupSessionWatcher(process.cwd());

const getActivityData = () => {
  if (fs.existsSync(activityFilePath)) {
    try {
      return JSON.parse(fs.readFileSync(activityFilePath, 'utf8'));
    } catch (e) {}
  }
  return { project: process.cwd(), generatedAt: new Date().toISOString(), sessions: [] };
};

const getPlanData = () => {
  if (fs.existsSync(planFilePath)) {
    try {
      return JSON.parse(fs.readFileSync(planFilePath, 'utf8'));
    } catch (e) {}
  }
  return { productIdea: path.basename(process.cwd()), domains: [] };
};

function getProjectCreationDate(dir = process.cwd()) {
  try {
    const stat = fs.statSync(dir);
    if (stat.birthtime && !isNaN(stat.birthtime.getTime()) && stat.birthtime.getTime() > 0) {
      return stat.birthtime.toISOString();
    }
    return stat.ctime.toISOString();
  } catch (e) {
    return new Date().toISOString();
  }
}

const getProjectsData = () => {
  if (fs.existsSync(projectsFilePath)) {
    try {
      const parsed = JSON.parse(fs.readFileSync(projectsFilePath, 'utf8'));
      if (!parsed.created_at) parsed.created_at = getProjectCreationDate(process.cwd());
      return parsed;
    } catch (e) {}
  }
  const rootDir = process.cwd();
  const projectName = path.basename(rootDir);
  const plan = getPlanData();
  return {
    id: 1,
    name: projectName,
    description: `Architecture, execution tasks, and services for ${projectName}.`,
    repository_path: rootDir,
    status: 'active',
    stage: 'execution',
    created_at: getProjectCreationDate(rootDir),
    modules: (plan.domains || []).flatMap((d, dIdx) => (d.modules || []).map((m, mIdx) => ({
      id: dIdx * 10 + mIdx + 1,
      name: m.title,
      category: m.category || d.category || 'infra',
      status: 'completed',
      tasks: (m.tasks || []).map((t, tIdx) => ({
        id: tIdx + 1,
        title: t.title,
        status: t.status || 'completed'
      }))
    })))
  };
};

function getLogsFromDb() {
  try {
    const dbPath = path.resolve(process.cwd(), 'app.db');
    if (fs.existsSync(dbPath)) {
      const { DatabaseSync } = require('node:sqlite');
      const db = new DatabaseSync(dbPath);
      const rows = db.prepare(`
        SELECT a.id, a.project_id, a.session_id, a.model_name, a.event_type, a.status, a.summary, a.details, a.timestamp,
               COALESCE(s.summary, 'Session ' || COALESCE(a.session_id, 1)) as session_name
        FROM activitylog a
        LEFT JOIN sessionrecord s ON a.session_id = s.id
        ORDER BY a.timestamp DESC
      `).all();
      db.close();
      if (rows && rows.length > 0) return rows;
    }
  } catch (e) {}
  return [];
}

function saveChatToDb(userMessage, aiReply, modelName = 'claude-3-5-sonnet', sessionId = 1) {
  try {
    const dbPath = path.resolve(process.cwd(), 'app.db');
    if (fs.existsSync(dbPath)) {
      const { DatabaseSync } = require('node:sqlite');
      const db = new DatabaseSync(dbPath);
      const sess = db.prepare('SELECT id FROM sessionrecord WHERE id = ?').get(sessionId);
      if (!sess) {
        db.prepare('INSERT INTO sessionrecord (id, session_uuid, project_id, status, started_at, summary) VALUES (?, ?, 1, \'active\', datetime(\'now\'), ?)').run(sessionId, `session-${sessionId}`, 'Claude Session');
      }
      db.prepare('INSERT INTO activitylog (project_id, session_id, model_name, event_type, status, summary, details, timestamp) VALUES (1, ?, ?, \'chat\', \'success\', ?, ?, datetime(\'now\'))').run(sessionId, modelName, (userMessage || '').slice(0, 100), `User: ${userMessage}\nAI: ${aiReply}`);
      db.close();
    }
  } catch (e) {
    console.error('Error saving chat to db:', e);
  }
}
function getClaudeConfigDir() {
  if (process.env.CLAUDE_CONFIG_DIR) return process.env.CLAUDE_CONFIG_DIR;
  return path.join(require('os').homedir(), '.claude');
}

function getAuthToken() {
  try {
    const settingsPath = path.resolve(process.cwd(), '.claude/settings.local.json');
    if (fs.existsSync(settingsPath)) {
      const sData = JSON.parse(fs.readFileSync(settingsPath, 'utf8'));
      const envDict = sData.env || {};
      const fileToken = envDict.ANTHROPIC_AUTH_TOKEN || envDict.OMNIROUTE_API_KEY;
      if (fileToken) return fileToken;
    }
  } catch (e) {}

  if (process.env.ANTHROPIC_AUTH_TOKEN || process.env.OMNIROUTE_API_KEY || process.env.ANTHROPIC_API_KEY) {
    return process.env.ANTHROPIC_AUTH_TOKEN || process.env.OMNIROUTE_API_KEY || process.env.ANTHROPIC_API_KEY;
  }

  try {
    const globalSettingsPath = path.join(getClaudeConfigDir(), 'settings.json');
    if (fs.existsSync(globalSettingsPath)) {
      const gData = JSON.parse(fs.readFileSync(globalSettingsPath, 'utf8'));
      const envDict = gData.env || {};
      const gToken = envDict.ANTHROPIC_AUTH_TOKEN || envDict.OMNIROUTE_API_KEY;
      if (gToken) return gToken;
    }
  } catch (e) {}

  return '';
}

function getProxyBaseUrl() {
  try {
    const settingsPath = path.resolve(process.cwd(), '.claude/settings.local.json');
    if (fs.existsSync(settingsPath)) {
      const sData = JSON.parse(fs.readFileSync(settingsPath, 'utf8'));
      const envDict = sData.env || {};
      if (envDict.ANTHROPIC_BASE_URL) return envDict.ANTHROPIC_BASE_URL.replace(/\/+$/, '');
    }
  } catch (e) {}

  if (process.env.ANTHROPIC_BASE_URL) {
    return process.env.ANTHROPIC_BASE_URL.replace(/\/+$/, '');
  }

  try {
    const globalSettingsPath = path.join(getClaudeConfigDir(), 'settings.json');
    if (fs.existsSync(globalSettingsPath)) {
      const gData = JSON.parse(fs.readFileSync(globalSettingsPath, 'utf8'));
      const envDict = gData.env || {};
      if (envDict.ANTHROPIC_BASE_URL) return envDict.ANTHROPIC_BASE_URL.replace(/\/+$/, '');
    }
  } catch (e) {}

  return 'http://localhost:20128';
}

// Fetch and filter billable call-logs from OmniRoute
function fetchCallLogs(callback) {
  const http2 = require('http');
  const token = getAuthToken();
  const headers = token ? { 'Authorization': `Bearer ${token}` } : {};
  const proxyUrl = getProxyBaseUrl();
  const req = http2.get(`${proxyUrl}/api/usage/call-logs`, { headers }, (r) => {
    let body = '';
    r.on('data', c => body += c);
    r.on('end', () => {
      try {
        let data = JSON.parse(body);
        if (!Array.isArray(data)) {
          // unwrap common envelope shapes
          for (const key of ['logs','data','items','results']) {
            if (Array.isArray(data[key])) { data = data[key]; break; }
          }
        }
        const billable = (Array.isArray(data) ? data : []).filter(c =>
          c.status === 200 &&
          c.model !== 'connection-test' &&
          c.apiKeyName !== 'Internal self-loop' &&
          c.usageProvenance === 'reported' &&
          c.timestamp
        );
        callback(null, billable);
      } catch (e) { callback(e, []); }
    });
  });
  req.on('error', e => callback(e, []));
  req.setTimeout(5000, () => { req.destroy(); callback(new Error('timeout'), []); });
}

const getDashboardData = () => {
  const ledgerPath = path.resolve(process.cwd(), '.planner/usage.jsonl');
  return computeDashboardFromLedger(ledgerPath, path.basename(process.cwd()));
};

// Request handler for API (port 8000 and 3001 /api)
const handleApiRequest = (req, res) => {
  let parsedUrl = (req.url || '/').split('?')[0];
  res.setHeader('Content-Type', 'application/json');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return;
  }

  if (parsedUrl === '/api/projects/plan' || parsedUrl === '/api/plan' || parsedUrl === '/api/project') {
    res.writeHead(200);
    res.end(JSON.stringify(getPlanData()));
    return;
  }

  if (parsedUrl === '/api/projects' || parsedUrl === '/api/projects/') {
    res.writeHead(200);
    res.end(JSON.stringify([getProjectsData()]));
    return;
  }

  if (parsedUrl === '/api/projects/1/hierarchy' || parsedUrl === '/api/projects/hierarchy') {
    res.writeHead(200);
    res.end(JSON.stringify(getProjectsData()));
    return;
  }

  if (parsedUrl === '/api/dashboard/summary') {
    fetchCallLogs((err, logs) => {
      if (!err && logs.length > 0) {
        try {
          ingestOmniRouteLogs(logs, process.cwd());
        } catch (e) {}
      }
      const dash = getDashboardData();
      const proj = getProjectsData();
      res.writeHead(200);
      res.end(JSON.stringify({
        ...dash,
        started_at: proj.created_at || getProjectCreationDate(process.cwd())
      }));
    });
    return;
  }

  if (parsedUrl === '/api/dashboard/reconcile') {
    const report = reconcileWithCcusage(process.cwd());
    res.writeHead(200);
    res.end(JSON.stringify(report));
    return;
  }

  if (parsedUrl === '/api/dashboard/token-usage-over-time') {
    const ledgerPath = path.resolve(process.cwd(), '.planner/usage.jsonl');
    if (fs.existsSync(ledgerPath)) {
      const byDate = {};
      const lines = fs.readFileSync(ledgerPath, 'utf8').split('\n').filter(Boolean);
      for (const line of lines) {
        try {
          const row = JSON.parse(line);
          const date = (row.ts || '').split('T')[0];
          if (!date) continue;
          if (!byDate[date]) byDate[date] = { date, input: 0, output: 0, cost: 0 };
          byDate[date].input += row.input_tokens || 0;
          byDate[date].output += row.output_tokens || 0;
          if (typeof row.cost_usd === 'number') byDate[date].cost += row.cost_usd;
        } catch (e) {}
      }
      const chartArr = Object.values(byDate).sort((a, b) => a.date.localeCompare(b.date));
      res.writeHead(200);
      res.end(JSON.stringify(chartArr));
      return;
    }
    res.writeHead(200);
    res.end(JSON.stringify([]));
    return;
  }

  if (parsedUrl === '/api/models/' || parsedUrl === '/api/models') {
    const http2 = require('http');
    const token = getAuthToken();
    const headers = token ? { 'Authorization': `Bearer ${token}` } : {};
    const proxyUrl = getProxyBaseUrl();
    const proxyReq = http2.get(`${proxyUrl}/v1/models`, { headers }, (proxyRes) => {
      let body = '';
      proxyRes.on('data', chunk => body += chunk);
      proxyRes.on('end', () => {
        try {
          const data = JSON.parse(body);
          const metaList = (data.data || []).filter(item => item.owned_by === 'antigravity' || (item.id || '').startsWith('antigravity/'));

          fetchCallLogs((err, logs) => {
            const usageMap = {};
            for (const c of logs) {
              const mName = c.model || c.requestedModel;
              if (!mName) continue;
              if (!usageMap[mName]) {
                usageMap[mName] = { input: 0, output: 0, lastTs: null };
              }
              usageMap[mName].input += (c.tokens && c.tokens.in) || 0;
              usageMap[mName].output += (c.tokens && c.tokens.out) || 0;
              if (!usageMap[mName].lastTs || c.timestamp > usageMap[mName].lastTs) {
                usageMap[mName].lastTs = c.timestamp;
              }
            }

            const models = metaList.map(item => {
              const cleanId = item.id;
              const shortId = cleanId.replace(/^antigravity\//, '');
              const stats = usageMap[cleanId] || usageMap[shortId] || { input: 0, output: 0, lastTs: null };
              const pIn = (item.pricing || {}).input || 0;
              const pOut = (item.pricing || {}).output || 0;
              const estCost = ((stats.input / 1000000) * pIn) + ((stats.output / 1000000) * pOut);
              return {
                id: item.id,
                name: item.name || item.id,
                provider: item.owned_by || 'antigravity',
                capabilities: Object.entries(item.capabilities || {}).filter(([,v]) => v).map(([k]) => k).join(', ') || 'general',
                availability: 'available',
                context_length: item.context_length || 0,
                max_output_tokens: item.max_output_tokens || 0,
                pricing_input: pIn,
                pricing_output: pOut,
                pricing_cached: (item.pricing || {}).cached || 0,
                last_used_timestamp: stats.lastTs,
                input_tokens: stats.input,
                output_tokens: stats.output,
                total_tokens: stats.input + stats.output,
                estimated_cost: Math.round(estCost * 10000) / 10000,
                feature_worked_on: stats.lastTs ? 'Active Execution & Feature Build' : 'Available in anti-gravity combo',
                task_objective: stats.lastTs ? 'Completed model request execution' : 'Ready for assignment'
              };
            });
            res.writeHead(200);
            res.end(JSON.stringify(models));
          });
        } catch (e) {
          res.writeHead(200);
          res.end(JSON.stringify([]));
        }
      });
    });
    proxyReq.on('error', () => {
      res.writeHead(200);
      res.end(JSON.stringify([]));
    });
    proxyReq.setTimeout(3000, () => { proxyReq.destroy(); res.writeHead(200); res.end(JSON.stringify([])); });
    return;
  }

  if (parsedUrl === '/api/activity' || parsedUrl === '/api/activity.json') {
    res.writeHead(200);
    res.end(JSON.stringify(getActivityData()));
    return;
  }

  if (parsedUrl === '/api/dashboard/recent-requests') {
    fetchCallLogs((err, logs) => {
      const sorted = (logs || []).sort((a, b) => new Date(b.timestamp || 0) - new Date(a.timestamp || 0)).slice(0, 15);
      res.writeHead(200);
      res.end(JSON.stringify(sorted));
    });
    return;
  }

  if (parsedUrl === '/api/logs/' || parsedUrl === '/api/logs') {
    const act = getActivityData();
    const allLogs = (act.sessions || []).flatMap(s => (s.messages || []).map((m, mIdx) => ({
      id: `${s.id}-${mIdx}`,
      session_id: s.id,
      session_name: s.label,
      timestamp: m.timestamp || s.startedAt,
      event_type: m.role === 'user' ? 'user_prompt' : 'ai_response',
      model_name: 'claude',
      status: 'success',
      summary: (m.text || '').slice(0, 100).replace(/\n/g, ' '),
      details: m.text
    }))).sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
    res.writeHead(200);
    res.end(JSON.stringify(allLogs));
    return;
  }

  if (parsedUrl === '/api/chat' || parsedUrl === '/api/messages' || parsedUrl === '/api/logs/chat') {
    if (req.method === 'POST') {
      let body = '';
      req.on('data', chunk => body += chunk);
      req.on('end', () => {
        let payload = {};
        try { payload = JSON.parse(body); } catch(e) {}
        const userMsg = payload.message || payload.prompt || payload.user || 'User prompt';
        const aiMsg = payload.reply || payload.response || payload.ai || 'Plan processed successfully.';
        const model = payload.model || payload.model_name || 'claude-3-5-sonnet';
        saveChatToDb(userMsg, aiMsg, model);
        res.writeHead(200);
        res.end(JSON.stringify({ success: true, reply: aiMsg }));
      });
      return;
    }
    const dbLogs = getLogsFromDb().filter(l => l.event_type === 'chat');
    res.writeHead(200);
    res.end(JSON.stringify(dbLogs));
    return;
  }

  res.writeHead(200);
  res.end(JSON.stringify({ success: true }));
};

// 2. Start API Server on port 8000 (if FastAPI is not already running)
let apiServer = null;
if (!fastApiActive) {
  apiServer = http.createServer(handleApiRequest);
  apiServer.on('error', (err) => {
    if (err.code === 'EADDRINUSE') {
      console.log(`Port ${apiPort} in use, forcing cleanup and retrying...`);
      killOnPort(apiPort);
      setTimeout(() => {
        apiServer.close();
        apiServer.listen(apiPort, '0.0.0.0');
      }, 400);
    } else {
      console.error('API server error:', err);
    }
  });
  apiServer.listen(apiPort, '0.0.0.0', () => {
    console.log(`🔌 API server running at http://localhost:${apiPort}`);
  });
} else {
  console.log(`🔌 Connected to active FastAPI server on http://localhost:${apiPort}`);
}

// 3. Start UI Static Server on port 3001
const uiServer = http.createServer((req, res) => {
  try {
    let parsedUrl = (req.url || '/').split('?')[0];

    if (parsedUrl.startsWith('/api/')) {
      handleApiRequest(req, res);
      return;
    }

    let filePath = path.join(viewerDir, parsedUrl === '/' ? 'index.html' : parsedUrl);

    if (!filePath.startsWith(viewerDir)) {
      res.writeHead(403);
      res.end('Access denied');
      return;
    }

    if (!fs.existsSync(filePath) || fs.statSync(filePath).isDirectory()) {
      filePath = path.join(viewerDir, 'index.html');
    }

    const extname = path.extname(filePath);
    const contentType = {
      '.html': 'text/html',
      '.js': 'text/javascript',
      '.css': 'text/css',
      '.svg': 'image/svg+xml',
      '.json': 'application/json',
      '.ico': 'image/x-icon',
      '.png': 'image/png'
    }[extname] || 'application/octet-stream';

    fs.readFile(filePath, (err, content) => {
      if (err) {
        res.writeHead(404, { 'Content-Type': 'text/plain' });
        res.end('Not found');
      } else {
        if (filePath.endsWith('index.html')) {
          let html = content.toString('utf8');
          const planData = getPlanData();
          const projectsData = getProjectsData();
          const dashboardData = getDashboardData();
          const activityData = getActivityData();
          const injection = `<script>
            window.__PLAN_DATA__ = ${JSON.stringify(planData)};
            window.__PROJECTS_DATA__ = ${JSON.stringify(projectsData)};
            window.__DASHBOARD_DATA__ = ${JSON.stringify(dashboardData)};
            window.__ACTIVITY_DATA__ = ${JSON.stringify(activityData)};
          </script>`;
          html = html.replace('</head>', `${injection}\n</head>`);
          res.writeHead(200, { 'Content-Type': contentType, 'Access-Control-Allow-Origin': '*' });
          res.end(html);
        } else {
          res.writeHead(200, { 'Content-Type': contentType, 'Access-Control-Allow-Origin': '*' });
          res.end(content);
        }
      }
    });
  } catch (err) {
    res.writeHead(500, { 'Content-Type': 'text/plain' });
    res.end('Internal Server Error');
  }
});

uiServer.on('error', (err) => {
  if (err.code === 'EADDRINUSE') {
    console.log(`Port ${uiPort} in use, forcing cleanup and retrying...`);
    killOnPort(uiPort);
    setTimeout(() => {
      uiServer.close();
      uiServer.listen(uiPort, '0.0.0.0');
    }, 400);
  } else {
    console.error('UI server error:', err);
  }
});

uiServer.listen(uiPort, '0.0.0.0', () => {
  console.log(`🚀 Planning Studio UI running at http://localhost:${uiPort}`);
  const open = process.platform === 'darwin' ? 'open' : process.platform === 'win32' ? 'start' : 'xdg-open';
  try {
    spawn(open, [`http://localhost:${uiPort}`]);
  } catch (e) {}
});

process.on('SIGINT', () => {
  if (apiServer) apiServer.close();
  uiServer.close();
  process.exit(0);
});
