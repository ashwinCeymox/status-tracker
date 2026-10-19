const fs = require('fs');
const path = require('path');
const http = require('http');
const { execSync } = require('child_process');

/**
 * Usage Ledger & Cost Engine
 * - Ingests OmniRoute call logs into an append-only ledger (.planner/usage.jsonl)
 * - De-duplicates by request_id (idempotent ingestion)
 * - Subtracts cached tokens from Gemini input tokens to prevent double billing
 * - Accounts for reasoning/thinking tokens as output tokens
 * - Preserves prices_used on every ledger row
 * - Computes .planner/dashboard.json strictly from usage.jsonl (null when empty)
 */

function getPrices(projectDir = process.cwd()) {
  const localPrices = path.join(projectDir, '.planner', 'prices.json');
  const defaultPrices = path.join(__dirname, '../schema/prices.json');

  let pricesObj = {};
  if (fs.existsSync(localPrices)) {
    try {
      pricesObj = JSON.parse(fs.readFileSync(localPrices, 'utf8')).models || {};
    } catch (e) {}
  } else if (fs.existsSync(defaultPrices)) {
    try {
      pricesObj = JSON.parse(fs.readFileSync(defaultPrices, 'utf8')).models || {};
    } catch (e) {}
  }
  return pricesObj;
}

function getExistingLedgerIds(ledgerPath) {
  const seenIds = new Set();
  if (!fs.existsSync(ledgerPath)) return seenIds;

  const content = fs.readFileSync(ledgerPath, 'utf8');
  for (const line of content.split('\n')) {
    if (!line.trim()) continue;
    try {
      const record = JSON.parse(line);
      const dedupeKey = record.request_id || `${record.ts}_${record.model}_${record.input_tokens}_${record.output_tokens}`;
      seenIds.add(dedupeKey);
    } catch (e) {}
  }
  return seenIds;
}

function normalizeOmniRouteRecord(raw, projectName, prices) {
  const summary = raw.summary || raw;
  const requestId = summary.id || raw.id || `${summary.timestamp}_${summary.model}`;
  const ts = summary.timestamp || new Date().toISOString();
  const rawModel = (summary.model || summary.requestedModel || 'unknown').replace(/^antigravity\//, '');
  const provider = summary.provider || 'antigravity';
  const tokens = summary.tokens || {};

  const inputTokens = tokens.in || 0;
  const outputTokens = tokens.out || 0;
  const cacheReadTokens = tokens.cacheRead || 0;
  const cacheWriteTokens = tokens.cacheWrite || tokens.cacheCreation || 0;
  const reasoningTokens = tokens.reasoning || 0;

  // Project attribution: check apiKeyName, comboName, or explicit session_tag
  let attributedProject = 'unattributed';
  const apiKeyName = summary.apiKeyName || '';
  const comboName = summary.comboName || '';

  if (apiKeyName && apiKeyName.toLowerCase() === projectName.toLowerCase()) {
    attributedProject = projectName;
  } else if (comboName && comboName.toLowerCase() === projectName.toLowerCase()) {
    attributedProject = projectName;
  } else if (raw.project && raw.project === projectName) {
    attributedProject = projectName;
  } else {
    // If running in the current workspace, calls matching active model usage without conflicting tags belong to project
    attributedProject = projectName;
  }

  // Cost calculation
  let costUsd = null;
  let costSource = 'computed';
  let pricesUsed = null;
  let unpriced = false;

  if (typeof summary.cost === 'number' && summary.cost > 0) {
    costUsd = summary.cost;
    costSource = 'provider';
  } else {
    const modelPrice = prices[rawModel] || prices[rawModel.toLowerCase()];
    if (!modelPrice) {
      unpriced = true;
    } else {
      pricesUsed = {
        in: modelPrice.in,
        cache_read: modelPrice.cache_read || 0,
        cache_write: modelPrice.cache_write || 0,
        out: modelPrice.out
      };

      // Gemini normalization: Gemini includes cached tokens in input_tokens.
      // Subtract cache_read from input_tokens so cached tokens are not billed twice.
      const isGemini = rawModel.toLowerCase().includes('gemini');
      const billableIn = isGemini ? Math.max(0, inputTokens - cacheReadTokens) : inputTokens;
      // Reasoning tokens are billed as output tokens
      const effectiveOut = outputTokens + reasoningTokens;

      costUsd = ((billableIn / 1e6) * pricesUsed.in) +
                ((cacheReadTokens / 1e6) * pricesUsed.cache_read) +
                ((cacheWriteTokens / 1e6) * pricesUsed.cache_write) +
                ((effectiveOut / 1e6) * pricesUsed.out);
      costUsd = Math.round(costUsd * 1000000) / 1000000;
    }
  }

  return {
    request_id: requestId,
    ts,
    project: attributedProject,
    model: rawModel,
    provider,
    status: summary.status || 200,
    input_tokens: inputTokens,
    cache_read_tokens: cacheReadTokens,
    cache_write_tokens: cacheWriteTokens,
    output_tokens: outputTokens,
    reasoning_tokens: reasoningTokens,
    cost_usd: costUsd,
    cost_source: costSource,
    prices_used: pricesUsed,
    unpriced
  };
}

function ingestOmniRouteLogs(rawLogs, projectDir = process.cwd()) {
  const plannerDir = path.resolve(projectDir, '.planner');
  if (!fs.existsSync(plannerDir)) fs.mkdirSync(plannerDir, { recursive: true });

  const ledgerPath = path.join(plannerDir, 'usage.jsonl');
  const prices = getPrices(projectDir);
  const projectName = path.basename(projectDir);
  const existingIds = getExistingLedgerIds(ledgerPath);

  let newRowsCount = 0;
  const newLines = [];

  for (const raw of rawLogs) {
    const summary = raw.summary || raw;
    const reqId = summary.id || `${summary.timestamp}_${summary.model}`;
    const dedupeKey = reqId || `${summary.timestamp}_${summary.model}_${summary.tokens?.in}_${summary.tokens?.out}`;

    if (existingIds.has(dedupeKey)) continue;

    // Filter to valid billable calls
    if (summary.status && summary.status !== 200) continue;
    if (summary.model === 'connection-test') continue;
    if (summary.apiKeyName === 'Internal self-loop') continue;

    const row = normalizeOmniRouteRecord(raw, projectName, prices);
    newLines.push(JSON.stringify(row));
    existingIds.add(dedupeKey);
    newRowsCount++;
  }

  if (newLines.length > 0) {
    fs.appendFileSync(ledgerPath, newLines.join('\n') + '\n', 'utf8');
  }

  // Update dashboard.json strictly computed from usage.jsonl
  const dashboard = computeDashboardFromLedger(ledgerPath, projectName);
  const dashPath = path.join(plannerDir, 'dashboard.json');
  fs.writeFileSync(dashPath, JSON.stringify(dashboard, null, 2), 'utf8');

  return { newRowsCount, dashboard };
}

function findSqliteDb(projectDir = process.cwd()) {
  if (process.env.TOKEN_MONITOR_DB_PATH && fs.existsSync(process.env.TOKEN_MONITOR_DB_PATH)) {
    return process.env.TOKEN_MONITOR_DB_PATH;
  }
  const candidates = [
    path.join(projectDir, 'app.db'),
    path.join(projectDir, 'backend', 'control_center.db'),
    path.join(projectDir, '..', 'app.db')
  ];
  for (const c of candidates) {
    if (fs.existsSync(c)) return c;
  }
  return null;
}

function safeReadSqliteRows(dbPath, tableName) {
  try {
    const { DatabaseSync } = require('node:sqlite');
    const db = new DatabaseSync(dbPath);
    const hasTable = db.prepare(`SELECT name FROM sqlite_master WHERE type='table' AND name='${tableName}'`).get();
    if (!hasTable) {
      db.close();
      return [];
    }
    const rows = db.prepare(`SELECT * FROM ${tableName}`).all();
    db.close();
    return rows;
  } catch (e) {
    try {
      const out = execSync(`sqlite3 "${dbPath}" "SELECT * FROM ${tableName};" -json`, { timeout: 3000, stdio: ['pipe', 'pipe', 'ignore'] }).toString();
      return JSON.parse(out || '[]');
    } catch (e2) {
      return [];
    }
  }
}

function syncFromSqlite(projectDir = process.cwd()) {
  const dbPath = findSqliteDb(projectDir);
  if (!dbPath) return { syncedCount: 0 };

  try {
    const rows = safeReadSqliteRows(dbPath, 'modelusagerecord');
    if (!rows || rows.length === 0) return { syncedCount: 0 };

    const plannerDir = path.resolve(projectDir, '.planner');
    if (!fs.existsSync(plannerDir)) fs.mkdirSync(plannerDir, { recursive: true });

    const ledgerPath = path.join(plannerDir, 'usage.jsonl');
    const existingIds = getExistingLedgerIds(ledgerPath);
    const prices = getPrices(projectDir);
    const projectName = path.basename(projectDir);

    let syncedCount = 0;
    const newLines = [];

    for (const r of rows) {
      const dedupeKey = `sqlite_${r.id}_${r.timestamp}_${r.model_name}`;
      if (existingIds.has(dedupeKey)) continue;

      const rawModel = (r.model_name || 'unknown').replace(/^antigravity\//, '');
      const modelPrice = prices[rawModel] || prices[rawModel.toLowerCase()];
      let cost = typeof r.cost === 'number' && r.cost > 0 ? r.cost : null;
      let costSource = 'provider';
      let pricesUsed = null;
      let unpriced = false;

      if (cost === null) {
        if (!modelPrice) {
          unpriced = true;
        } else {
          costSource = 'computed';
          pricesUsed = {
            in: modelPrice.in,
            cache_read: modelPrice.cache_read || 0,
            cache_write: modelPrice.cache_write || 0,
            out: modelPrice.out
          };
          cost = ((r.input_tokens / 1e6) * pricesUsed.in) + ((r.output_tokens / 1e6) * pricesUsed.out);
          cost = Math.round(cost * 1000000) / 1000000;
        }
      }

      const row = {
        request_id: dedupeKey,
        ts: r.timestamp || new Date().toISOString(),
        project: projectName,
        model: rawModel,
        provider: 'sqlite_history',
        status: 200,
        input_tokens: r.input_tokens || 0,
        cache_read_tokens: 0,
        cache_write_tokens: 0,
        output_tokens: r.output_tokens || 0,
        reasoning_tokens: 0,
        cost_usd: cost,
        cost_source: costSource,
        prices_used: pricesUsed,
        unpriced
      };

      newLines.push(JSON.stringify(row));
      existingIds.add(dedupeKey);
      syncedCount++;
    }

    if (newLines.length > 0) {
      fs.appendFileSync(ledgerPath, newLines.join('\n') + '\n', 'utf8');
      const dashboard = computeDashboardFromLedger(ledgerPath, projectName);
      fs.writeFileSync(path.join(plannerDir, 'dashboard.json'), JSON.stringify(dashboard, null, 2), 'utf8');
    }

    return { syncedCount };
  } catch (e) {
    return { syncedCount: 0, error: e.message };
  }
}

function computeDashboardFromLedger(ledgerPath, projectName) {
  if (!fs.existsSync(ledgerPath)) {
    return {
      status: 'no_data',
      project_name: projectName,
      target_project: projectName,
      total_input_tokens: null,
      total_cache_read: null,
      total_cache_write: null,
      total_output_tokens: null,
      total_reasoning: null,
      total_cost: null,
      unpriced_models: [],
      row_count: 0,
      last_updated: new Date().toISOString()
    };
  }

  const lines = fs.readFileSync(ledgerPath, 'utf8').split('\n').filter(Boolean);
  if (lines.length === 0) {
    return {
      status: 'no_data',
      project_name: projectName,
      target_project: projectName,
      total_input_tokens: null,
      total_cache_read: null,
      total_cache_write: null,
      total_output_tokens: null,
      total_reasoning: null,
      total_cost: null,
      unpriced_models: [],
      row_count: 0,
      last_updated: new Date().toISOString()
    };
  }

  let totalInput = 0;
  let totalCacheRead = 0;
  let totalCacheWrite = 0;
  let totalOutput = 0;
  let totalReasoning = 0;
  let totalCost = 0;
  let hasValidCost = false;
  const unpricedSet = new Set();
  const byModel = {};

  for (const line of lines) {
    try {
      const row = JSON.parse(line);
      totalInput += row.input_tokens || 0;
      totalCacheRead += row.cache_read_tokens || 0;
      totalCacheWrite += row.cache_write_tokens || 0;
      totalOutput += row.output_tokens || 0;
      totalReasoning += row.reasoning_tokens || 0;

      if (typeof row.cost_usd === 'number') {
        totalCost += row.cost_usd;
        hasValidCost = true;
      }

      if (row.unpriced) {
        unpricedSet.add(row.model);
      }

      const m = row.model || 'unknown';
      if (!byModel[m]) {
        byModel[m] = {
          input_tokens: 0,
          output_tokens: 0,
          cache_read_tokens: 0,
          cost_usd: 0,
          requests: 0
        };
      }
      byModel[m].input_tokens += row.input_tokens || 0;
      byModel[m].output_tokens += row.output_tokens || 0;
      byModel[m].cache_read_tokens += row.cache_read_tokens || 0;
      if (typeof row.cost_usd === 'number') byModel[m].cost_usd += row.cost_usd;
      byModel[m].requests += 1;
    } catch (e) {}
  }

  return {
    status: 'measured',
    project_name: projectName,
    target_project: projectName,
    total_input_tokens: totalInput,
    total_cache_read: totalCacheRead,
    total_cache_write: totalCacheWrite,
    total_output_tokens: totalOutput,
    total_reasoning: totalReasoning,
    total_cost: hasValidCost ? Math.round(totalCost * 100) / 100 : null,
    unpriced_models: Array.from(unpricedSet),
    models: byModel,
    row_count: lines.length,
    last_updated: new Date().toISOString()
  };
}

function reconcileWithCcusage(projectDir = process.cwd()) {
  const ledgerPath = path.join(projectDir, '.planner', 'usage.jsonl');
  const dashboard = computeDashboardFromLedger(ledgerPath, path.basename(projectDir));

  let ccusageOutput = null;
  try {
    const raw = execSync('npx ccusage claude session --json', { timeout: 15000, cwd: projectDir }).toString();
    ccusageOutput = JSON.parse(raw);
  } catch (e) {
    return { error: 'Failed to run ccusage: ' + e.message };
  }

  const projName = path.basename(projectDir);
  const matching = (ccusageOutput.sessions || []).filter(s => (s.projectPath || '').includes(projName));

  const ccusageIn = matching.reduce((acc, s) => acc + (s.inputTokens || 0), 0);
  const ccusageOut = matching.reduce((acc, s) => acc + (s.outputTokens || 0), 0);
  const ccusageCost = matching.reduce((acc, s) => acc + (s.totalCost || 0), 0);

  const ledgerIn = dashboard.total_input_tokens || 0;
  const ledgerOut = dashboard.total_output_tokens || 0;
  const ledgerCost = dashboard.total_cost || 0;

  const costDiffPercent = ccusageCost > 0
    ? Math.abs(ledgerCost - ccusageCost) / ccusageCost * 100
    : 0;

  const result = {
    cross_check_target: 'ccusage (Claude Code Sessions)',
    period: 'All recorded sessions',
    ledger: { input: ledgerIn, output: ledgerOut, cost: ledgerCost },
    ccusage: { input: ccusageIn, output: ccusageOut, cost: Math.round(ccusageCost * 100) / 100 },
    cost_diff_percent: Math.round(costDiffPercent * 100) / 100,
    flagged: costDiffPercent > 5.0
  };

  return result;
}

module.exports = {
  ingestOmniRouteLogs,
  computeDashboardFromLedger,
  reconcileWithCcusage,
  syncFromSqlite,
  getPrices
};

if (require.main === module) {
  const args = process.argv.slice(2);
  if (args.includes('reconcile')) {
    const rec = reconcileWithCcusage();
    console.log('\n=== ccusage Cross-Check Report ===');
    console.log(JSON.stringify(rec, null, 2));
    if (rec.flagged) {
      console.warn(`⚠️ Warning: Cost discrepancy > 5% detected (${rec.cost_diff_percent}%) between OmniRoute and ccusage.`);
    } else {
      console.log(`✅ Discrepancy is within 5% tolerance (${rec.cost_diff_percent}%).`);
    }
  }
}
