const fs = require('fs');
const path = require('path');
const os = require('os');
const readline = require('readline');

/**
 * Activity Logs Data Pipeline
 * Reads Claude Code local session transcripts for the active project
 * and produces .planner/activity.json.
 */

// Cache parsed sessions by filename -> { mtimeMs, sessionData, firstTs }
const sessionCache = new Map();

function getProjectSessionDir(projectPath) {
  const claudeDir = process.env.CLAUDE_CONFIG_DIR || path.join(os.homedir(), '.claude');
  const claudeProjectsDir = path.join(claudeDir, 'projects');
  if (!fs.existsSync(claudeProjectsDir)) return null;

  // Fast path: encoded name
  const candidateName = projectPath.replace(/[/\\:]/g, '-');
  const directPath = path.join(claudeProjectsDir, candidateName);
  if (fs.existsSync(directPath) && fs.statSync(directPath).isDirectory()) {
    return directPath;
  }

  // Scan subfolders to match cwd in jsonl files
  try {
    const subdirs = fs.readdirSync(claudeProjectsDir, { withFileTypes: true })
      .filter(d => d.isDirectory())
      .map(d => path.join(claudeProjectsDir, d.name));

    for (const dir of subdirs) {
      const files = fs.readdirSync(dir).filter(f => f.endsWith('.jsonl'));
      for (const f of files.slice(0, 3)) {
        try {
          const content = fs.readFileSync(path.join(dir, f), 'utf8');
          const lines = content.split('\n').slice(0, 15);
          for (const line of lines) {
            if (!line.trim()) continue;
            const obj = JSON.parse(line);
            if (obj.cwd && path.resolve(obj.cwd) === path.resolve(projectPath)) {
              return dir;
            }
          }
        } catch (e) {}
      }
    }
  } catch (e) {}

  return null;
}

async function parseSessionFile(filePath) {
  const fileStream = fs.createReadStream(filePath, { encoding: 'utf8' });
  const rl = readline.createInterface({ input: fileStream, crlfDelay: Infinity });

  const messages = [];
  let currentAiTexts = [];
  let currentAiTs = null;
  let firstTs = null;

  function flushAi() {
    if (currentAiTexts.length > 0) {
      const combined = currentAiTexts.join('\n\n').trim();
      if (combined) {
        messages.push({ role: 'ai', text: combined, timestamp: currentAiTs });
      }
      currentAiTexts = [];
      currentAiTs = null;
    }
  }

  for await (const line of rl) {
    if (!line.trim()) continue;
    let obj;
    try {
      obj = JSON.parse(line);
    } catch (e) {
      continue; // Skip malformed or partial lines
    }

    const type = obj.type;
    const ts = obj.timestamp;
    if (ts && !firstTs) firstTs = ts;

    if (type === 'user') {
      const orig = obj.origin || {};
      const isHuman = (orig && orig.kind === 'human') || (obj.turnOrigin === 'human');
      // Skip synthetic or system-injected turns (unless explicit human prompt)
      if (!isHuman && obj.userType !== 'external') continue;

      const msg = obj.message || {};
      const content = msg.content;
      let text = '';

      if (typeof content === 'string') {
        text = content;
      } else if (Array.isArray(content)) {
        // Keep text blocks only, drop tool_use / tool_result / thinking blocks
        text = content
          .filter(b => b && b.type === 'text' && typeof b.text === 'string')
          .map(b => b.text)
          .join('\n\n');
      }

      // Drop synthetic/system reminders, command wrappers, file open hooks
      text = text.replace(/<system-reminder>[\s\S]*?<\/system-reminder>/g, '').trim();
      text = text.replace(/<ide_opened_file>[\s\S]*?<\/ide_opened_file>/g, '').trim();
      text = text.replace(/<local-command-caveat>[\s\S]*?<\/local-command-caveat>/g, '').trim();
      text = text.replace(/<local-command-stdout>[\s\S]*?<\/local-command-stdout>/g, '').trim();
      text = text.replace(/<command-message>(.*?)<\/command-message>/g, '$1').trim();
      text = text.replace(/<command-name>(.*?)<\/command-name>/g, '').trim();
      text = text.replace(/<turnOrigin>[\s\S]*?<\/turnOrigin>/g, '').trim();

      if (!text || text.startsWith('Base directory for this skill:')) continue;

      flushAi();
      messages.push({ role: 'user', text, timestamp: ts });
    } else if (type === 'assistant') {
      const msg = obj.message || {};
      const content = msg.content;
      let text = '';

      if (typeof content === 'string') {
        text = content;
      } else if (Array.isArray(content)) {
        // Keep text blocks only, drop tool_use, tool_result, thinking
        text = content
          .filter(b => b && b.type === 'text' && typeof b.text === 'string')
          .map(b => b.text)
          .join('\n\n');
      }

      text = text.trim();
      if (text) {
        if (!currentAiTs) currentAiTs = ts;
        currentAiTexts.push(text);
      }
    }
  }

  flushAi();
  return { messages, firstTs };
}

async function buildActivityData(projectDir = process.cwd()) {
  const sessionDir = getProjectSessionDir(projectDir);
  const plannerDir = path.resolve(projectDir, '.planner');
  if (!fs.existsSync(plannerDir)) {
    fs.mkdirSync(plannerDir, { recursive: true });
  }
  const activityFilePath = path.join(plannerDir, 'activity.json');
  const checkpointsFilePath = path.join(plannerDir, 'checkpoints.json');

  let persistentCheckpoints = {};
  if (fs.existsSync(checkpointsFilePath)) {
    try {
      persistentCheckpoints = JSON.parse(fs.readFileSync(checkpointsFilePath, 'utf8'));
    } catch (e) {}
  }

  if (!sessionDir || !fs.existsSync(sessionDir)) {
    console.log(`[activity-pipeline] No session transcripts directory found for ${projectDir}`);
    const emptyData = {
      project: projectDir,
      generatedAt: new Date().toISOString(),
      sessions: []
    };
    fs.writeFileSync(activityFilePath, JSON.stringify(emptyData, null, 2));
    return emptyData;
  }

  // Enumerate top-level .jsonl session files
  const files = fs.readdirSync(sessionDir, { withFileTypes: true })
    .filter(dirent => dirent.isFile() && dirent.name.endsWith('.jsonl'))
    .map(dirent => dirent.name);

  const parsedSessions = [];
  let checkpointsChanged = false;

  for (const file of files) {
    const fullPath = path.join(sessionDir, file);
    const sessionId = path.basename(file, '.jsonl');

    let stat;
    try {
      stat = fs.statSync(fullPath);
    } catch (e) {
      continue;
    }

    // Check in-memory cache or persistent checkpoint
    const inMem = sessionCache.get(file);
    const saved = persistentCheckpoints[file];
    const match = (inMem && inMem.mtimeMs === stat.mtimeMs) ? inMem :
                  (saved && saved.mtimeMs === stat.mtimeMs && saved.size === stat.size) ? saved.entry : null;

    if (match) {
      sessionCache.set(file, match);
      parsedSessions.push(match);
    } else {
      try {
        const { messages, firstTs } = await parseSessionFile(fullPath);
        const startedAt = firstTs || (messages[0] && messages[0].timestamp) || stat.birthtime.toISOString();
        const entry = {
          file,
          mtimeMs: stat.mtimeMs,
          id: sessionId,
          startedAt,
          messages
        };
        sessionCache.set(file, entry);
        persistentCheckpoints[file] = {
          mtimeMs: stat.mtimeMs,
          size: stat.size,
          entry
        };
        checkpointsChanged = true;
        parsedSessions.push(entry);
      } catch (err) {
        console.error(`[activity-pipeline] Error parsing ${file}:`, err);
      }
    }
  }

  if (checkpointsChanged) {
    try {
      fs.writeFileSync(checkpointsFilePath, JSON.stringify(persistentCheckpoints), 'utf8');
    } catch (e) {}
  }

  // Filter out empty sessions and sort oldest first
  const activeSessions = parsedSessions
    .filter(s => s.messages && s.messages.length > 0)
    .sort((a, b) => new Date(a.startedAt).getTime() - new Date(b.startedAt).getTime());

  // Assign sequential labels: Session 1, Session 2, ...
  const labeledSessions = activeSessions.map((s, idx) => ({
    id: s.id,
    label: `Session ${idx + 1}`,
    startedAt: s.startedAt,
    messages: s.messages
  }));

  const activityData = {
    project: projectDir,
    generatedAt: new Date().toISOString(),
    sessions: labeledSessions
  };

  // Write atomically: temp file then rename
  const tempPath = path.join(plannerDir, `activity.json.tmp.${Date.now()}`);
  try {
    fs.writeFileSync(tempPath, JSON.stringify(activityData, null, 2), 'utf8');
    fs.renameSync(tempPath, activityFilePath);
  } catch (err) {
    console.error('[activity-pipeline] Atomic write error:', err);
    try { fs.unlinkSync(tempPath); } catch (e) {}
  }

  return activityData;
}

let watchDebounceTimer = null;
function setupSessionWatcher(projectDir = process.cwd(), onChange) {
  const sessionDir = getProjectSessionDir(projectDir);
  if (!sessionDir || !fs.existsSync(sessionDir)) return;

  try {
    fs.watch(sessionDir, { persistent: false }, (eventType, filename) => {
      if (filename && filename.endsWith('.jsonl')) {
        if (watchDebounceTimer) clearTimeout(watchDebounceTimer);
        watchDebounceTimer = setTimeout(async () => {
          try {
            const data = await buildActivityData(projectDir);
            if (typeof onChange === 'function') onChange(data);
          } catch (e) {}
        }, 500);
      }
    });
    console.log(`[activity-pipeline] Watching Claude sessions in ${sessionDir}`);
  } catch (e) {
    console.log('[activity-pipeline] Session watch notice:', e.message);
  }
}

module.exports = {
  buildActivityData,
  setupSessionWatcher,
  getProjectSessionDir
};

if (require.main === module) {
  buildActivityData().then(data => {
    console.log(`✨ Generated activity.json with ${data.sessions.length} sessions.`);
  });
}
