#!/usr/bin/env bash
set -e

# ==============================================================================
# setup-prerequisites.sh
# Universal Setup Script for Token Monitor & Planning Studio Plugin for Claude Code.
# Prepares any project by copying plugin files, setting up .planner, configuring
# OmniRoute settings, registering global slash commands/skills, and initializing SQLite.
# ==============================================================================

PROJECT_DIR="$(pwd)"
echo "🚀 Setting up Token Monitor & Planning Studio prerequisites in: $PROJECT_DIR"

# 1. Check Node.js prerequisite
if ! command -v node >/dev/null 2>&1; then
  echo "❌ Error: Node.js is not installed. Please install Node.js (v18+) to run the plugin."
  exit 1
fi
NODE_VERSION=$(node -v)
echo "✅ Node.js detected: $NODE_VERSION"

# 2. Locate master plugin source
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
if [[ -d "$SCRIPT_DIR/plugin/token-moniter-planner" ]]; then
  MASTER_PLUGIN_DIR="$SCRIPT_DIR/plugin/token-moniter-planner"
elif [[ -f "$SCRIPT_DIR/commands/planning.js" ]]; then
  MASTER_PLUGIN_DIR="$SCRIPT_DIR"
else
  MASTER_PLUGIN_DIR="$SCRIPT_DIR/plugin/token-moniter-planner"
fi

# 3. Automatically copy / update plugin in the target project if not master repo
TARGET_PLUGIN_DIR="$PROJECT_DIR/plugin/token-moniter-planner"
if [[ "$PROJECT_DIR" != "$SCRIPT_DIR" && "$PROJECT_DIR" != "$SCRIPT_DIR/plugin/token-moniter-planner" ]]; then
  echo "📦 Installing plugin files into $TARGET_PLUGIN_DIR..."
  mkdir -p "$TARGET_PLUGIN_DIR"
  # Copy all files including dotfiles/dotdirs (.claude-plugin)
  cp -R "$MASTER_PLUGIN_DIR/." "$TARGET_PLUGIN_DIR/"
  echo "✅ Plugin installed into project."
fi

if [[ -d "$TARGET_PLUGIN_DIR" ]]; then
  ACTIVE_PLUGIN_DIR="$TARGET_PLUGIN_DIR"
  LOCAL_PLUGIN_PATH="plugin/token-moniter-planner"
else
  ACTIVE_PLUGIN_DIR="$MASTER_PLUGIN_DIR"
  LOCAL_PLUGIN_PATH="$MASTER_PLUGIN_DIR"
fi

# 4. Ensure .claude directory exists (no secret credentials written to project)
mkdir -p "$PROJECT_DIR/.claude"
LOCAL_SETTINGS="$PROJECT_DIR/.claude/settings.local.json"

node -e "
const fs = require('fs');
const settingsPath = '$LOCAL_SETTINGS';
let settings = {};

if (fs.existsSync(settingsPath)) {
  try {
    settings = JSON.parse(fs.readFileSync(settingsPath, 'utf8'));
  } catch (e) {}
}

// Register local plugin path without storing secret API keys in the project folder
settings.plugins = settings.plugins || {};
settings.plugins['token-monitor'] = {
  path: '$LOCAL_PLUGIN_PATH'
};

fs.writeFileSync(settingsPath, JSON.stringify(settings, null, 2));
console.log('✅ Configured plugin path in .claude/settings.local.json (credentials kept in global ~/.claude/settings.json).');
"

# 5. Register in Global Settings ~/.claude/settings.json
GLOBAL_CLAUDE_DIR="$HOME/.claude"
mkdir -p "$GLOBAL_CLAUDE_DIR"
GLOBAL_SETTINGS="$GLOBAL_CLAUDE_DIR/settings.json"

node -e "
const fs = require('fs');
const globalPath = '$GLOBAL_SETTINGS';
let gSettings = {};

if (fs.existsSync(globalPath)) {
  try {
    gSettings = JSON.parse(fs.readFileSync(globalPath, 'utf8'));
  } catch (e) {}
}

gSettings.plugins = gSettings.plugins || {};
gSettings.plugins['token-monitor'] = {
  path: '$ACTIVE_PLUGIN_DIR'
};

fs.writeFileSync(globalPath, JSON.stringify(gSettings, null, 2));
console.log('✅ Registered plugin globally in ~/.claude/settings.json.');
"

# 6. Install / Update Global Slash Command Skill (~/.claude/skills/planning/SKILL.md)
GLOBAL_SKILL_DIR="$GLOBAL_CLAUDE_DIR/skills/planning"
mkdir -p "$GLOBAL_SKILL_DIR"
cat << 'EOF' > "$GLOBAL_SKILL_DIR/SKILL.md"
---
name: planning
description: Open Planning Studio, reconcile project plan, or show token usage status with strict workspace isolation
---

# /planning

Manage the project implementation plan, token monitor, and activity logs.

## Important: Strict Project Isolation
- When `/planning` is executed, all operations apply strictly to the current active project folder (`pwd`).
- Every project maintains its own isolated `.planner/` directory (`plan.json`, `projects.json`, `dashboard.json`, `activity.json`, `usage.jsonl`).

## Subcommands
- `/planning`: Launch Planning Studio UI on `http://localhost:3001` and open in browser for the active project.
- `/planning sync`: Reconcile workspace file diffs, update task completion statuses, ingest SQLite history, and sync activity transcripts in the current project.
- `/planning status`: Output a clean 5-line terminal status summary for the current project.
- `/planning export`: Export chat conversations and activity logs to a formatted .txt file (optional: `/planning export [file.txt]`).

## Command Execution
```bash
if [ -f "./plugin/token-moniter-planner/commands/planning.js" ]; then
  node "./plugin/token-moniter-planner/commands/planning.js" $ARGUMENTS
else
  node "$ACTIVE_PLUGIN_DIR/commands/planning.js" $ARGUMENTS
fi
```
EOF
echo "✅ Registered global /planning skill in ~/.claude/skills/planning/SKILL.md."

# 7. Initialize .planner directory and files
mkdir -p "$PROJECT_DIR/.planner"

# Copy default prices.json if not present
if [[ ! -f "$PROJECT_DIR/.planner/prices.json" && -f "$ACTIVE_PLUGIN_DIR/schema/prices.json" ]]; then
  cp "$ACTIVE_PLUGIN_DIR/schema/prices.json" "$PROJECT_DIR/.planner/prices.json"
  echo "✅ Initialized .planner/prices.json with model pricing table."
fi

# Generate project plan, projects.json, and dashboard.json
if [[ -f "$ACTIVE_PLUGIN_DIR/commands/generate-plan.js" ]]; then
  echo "📋 Generating project plan and architecture schemas..."
  node "$ACTIVE_PLUGIN_DIR/commands/generate-plan.js"
fi

# Synchronize conversation transcripts into activity.json
if [[ -f "$ACTIVE_PLUGIN_DIR/commands/activity-pipeline.js" ]]; then
  echo "📜 Ingesting conversation activity from Claude transcripts..."
  node -e "
    const { buildActivityData } = require('$ACTIVE_PLUGIN_DIR/commands/activity-pipeline.js');
    buildActivityData('$PROJECT_DIR').then(() => {
      console.log('✅ Synchronized .planner/activity.json.');
    }).catch(e => {
      console.log('⚠️ Activity pipeline notice:', e.message);
    });
  "
fi

# Ingest any existing OmniRoute call logs into usage.jsonl
if [[ -f "$ACTIVE_PLUGIN_DIR/commands/usage-ledger.js" ]]; then
  echo "📊 Checking OmniRoute proxy call logs..."
  node "$ACTIVE_PLUGIN_DIR/commands/usage-ledger.js" sync >/dev/null 2>&1 || true
fi

# 8. Initialize SQLite database if app.db does not exist
node -e "
const fs = require('fs');
const path = require('path');
const dbPath = path.resolve('$PROJECT_DIR', 'app.db');

try {
  let db;
  try {
    const { DatabaseSync } = require('node:sqlite');
    db = new DatabaseSync(dbPath);
  } catch (err) {
    // node:sqlite not supported on older Node versions
  }

  if (db) {
    db.exec(\`
      CREATE TABLE IF NOT EXISTS project (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name VARCHAR NOT NULL,
        description VARCHAR,
        repository_path VARCHAR,
        status VARCHAR DEFAULT 'active',
        stage VARCHAR DEFAULT 'planning',
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS sessionrecord (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        session_uuid VARCHAR UNIQUE NOT NULL,
        project_id INTEGER,
        status VARCHAR DEFAULT 'active',
        started_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        ended_at DATETIME,
        summary VARCHAR
      );

      CREATE TABLE IF NOT EXISTS activitylog (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        project_id INTEGER,
        session_id INTEGER,
        model_name VARCHAR,
        event_type VARCHAR NOT NULL,
        status VARCHAR DEFAULT 'info',
        summary VARCHAR NOT NULL,
        details VARCHAR,
        timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
      );
    \`);

    const existingProj = db.prepare('SELECT id FROM project LIMIT 1').get();
    if (!existingProj) {
      db.prepare('INSERT INTO project (name, description, repository_path, status, stage) VALUES (?, ?, ?, ?, ?)').run(
        path.basename('$PROJECT_DIR'),
        'AI development project tracked by Token Monitor & Planner',
        '$PROJECT_DIR',
        'active',
        'execution'
      );
    }

    const existingSess = db.prepare('SELECT id FROM sessionrecord LIMIT 1').get();
    if (!existingSess) {
      db.prepare('INSERT INTO sessionrecord (session_uuid, project_id, status, summary) VALUES (?, 1, ?, ?)').run(
        'session-initial-1',
        'active',
        'Initial Claude session'
      );
    }

    db.close();
    console.log('✅ Initialized SQLite app.db successfully.');
  } else {
    console.log('ℹ️ SQLite app.db skipped (using .planner/ JSON files as primary source).');
  }
} catch (e) {
  console.log('⚠️ Notice on SQLite setup:', e.message);
}
"

# 9. Configure npm start script in package.json if present or create minimal package.json
node -e "
const fs = require('fs');
const path = require('path');
const pkgPath = path.resolve('$PROJECT_DIR', 'package.json');
let pkg = {};

if (fs.existsSync(pkgPath)) {
  try {
    pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
  } catch (e) {}
} else {
  pkg = {
    name: path.basename('$PROJECT_DIR'),
    version: '1.0.0',
    private: true
  };
}

pkg.scripts = pkg.scripts || {};
const startCmd = fs.existsSync(path.resolve('$PROJECT_DIR', 'plugin/token-moniter-planner/commands/planning.js'))
  ? 'node plugin/token-moniter-planner/commands/planning.js'
  : 'node $ACTIVE_PLUGIN_DIR/commands/planning.js';

pkg.scripts.start = pkg.scripts.start || startCmd;

fs.writeFileSync(pkgPath, JSON.stringify(pkg, null, 2));
console.log('✅ Configured npm start in package.json.');
"

chmod +x "$ACTIVE_PLUGIN_DIR/commands/planning.js" 2>/dev/null || true
chmod +x "$ACTIVE_PLUGIN_DIR/commands/generate-plan.js" 2>/dev/null || true
chmod +x "$ACTIVE_PLUGIN_DIR/scripts/log-activity.js" 2>/dev/null || true

echo "=================================================================="
echo "🎉 Setup Complete! You can now operate Planning Studio:"
echo "   In Claude Code: /planning"
echo "   In Terminal:    npm start"
echo "   Status Check:   node $LOCAL_PLUGIN_PATH/commands/planning.js status"
echo "   Headless Sync:  node $LOCAL_PLUGIN_PATH/commands/planning.js sync"
echo "=================================================================="
