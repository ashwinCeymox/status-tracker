#!/usr/bin/env bash
set -e

# ==============================================================================
# install.sh
# Universal Global Installer for Token Monitor & Planning Studio Plugin.
# Run ONCE inside the cloned repository.
#
# Prompts for:
# 1. API Gateway (OmniRoute, Ollama, Custom URL, or Skip)
# 2. Auth Token / API Key
# 3. Model / Combo Name
#
# Configures ~/.claude/settings.json globally so NO CREDENTIALS are ever copied
# or committed into individual project folders!
# ==============================================================================

REPO_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PLUGIN_DIR="$REPO_DIR/plugin/token-moniter-planner"

# Cross-platform Claude config directory discovery (macOS, Linux, Windows Git Bash / WSL)
if [[ -n "$CLAUDE_CONFIG_DIR" ]]; then
  GLOBAL_CLAUDE_DIR="$CLAUDE_CONFIG_DIR"
elif [[ -n "$USERPROFILE" && ( "$OSTYPE" == "msys"* || "$OSTYPE" == "cygwin"* ) ]]; then
  GLOBAL_CLAUDE_DIR="$(cygpath -u "$USERPROFILE")/.claude"
else
  GLOBAL_CLAUDE_DIR="$HOME/.claude"
fi

GLOBAL_SETTINGS="$GLOBAL_CLAUDE_DIR/settings.json"

mkdir -p "$GLOBAL_CLAUDE_DIR"

echo "=================================================================="
echo "⚡ Token Monitor & Planning Studio: Global Installer"
echo "   Repository: $REPO_DIR"
echo "   Plugin Dir: $PLUGIN_DIR"
echo "=================================================================="

# 1. Check Node.js
if ! command -v node >/dev/null 2>&1; then
  echo "❌ Error: Node.js is not installed. Please install Node.js (v18+) first."
  exit 1
fi
echo "✅ Node.js detected: $(node -v)"

# 2. Read existing settings from ~/.claude/settings.json if available
EXISTING_URL=$(node -e "try { const s = JSON.parse(require('fs').readFileSync('$GLOBAL_SETTINGS', 'utf8')); console.log(s.env?.ANTHROPIC_BASE_URL || ''); } catch(e){}" 2>/dev/null || echo "")
EXISTING_TOKEN=$(node -e "try { const s = JSON.parse(require('fs').readFileSync('$GLOBAL_SETTINGS', 'utf8')); console.log(s.env?.ANTHROPIC_AUTH_TOKEN || ''); } catch(e){}" 2>/dev/null || echo "")
EXISTING_MODEL=$(node -e "try { const s = JSON.parse(require('fs').readFileSync('$GLOBAL_SETTINGS', 'utf8')); console.log(s.env?.ANTHROPIC_MODEL || ''); } catch(e){}" 2>/dev/null || echo "")

DEFAULT_URL="${EXISTING_URL:-}"
DEFAULT_TOKEN="${EXISTING_TOKEN:-}"
DEFAULT_MODEL="${EXISTING_MODEL:-}"

GATEWAY_URL="$DEFAULT_URL"
AUTH_TOKEN="$DEFAULT_TOKEN"
MODEL_NAME="$DEFAULT_MODEL"

# 3. Interactive configuration (if running in interactive terminal and not --default)
if [[ -t 0 && "$1" != "--default" && "$1" != "-y" ]]; then
  echo ""
  echo "📡 Step 1: Select API Gateway / Proxy"
  echo "   1) OmniRoute (Local proxy)"
  echo "   2) Ollama (Local server)"
  echo "   3) Custom API Gateway URL"
  echo "   4) Skip (Direct Claude / No Proxy)"
  read -r -p "Select option [1-4, default 1]: " GATEWAY_CHOICE
  GATEWAY_CHOICE="${GATEWAY_CHOICE:-1}"

  case "$GATEWAY_CHOICE" in
    1)
      if [[ -n "$EXISTING_URL" ]]; then
        read -r -p "Enter OmniRoute URL [press Enter to keep current]: " INPUT_URL
        GATEWAY_URL="${INPUT_URL:-$EXISTING_URL}"
      else
        read -r -p "Enter OmniRoute URL: " INPUT_URL
        GATEWAY_URL="${INPUT_URL:-}"
      fi
      ;;
    2)
      if [[ -n "$EXISTING_URL" ]]; then
        read -r -p "Enter Ollama URL [press Enter to keep current]: " INPUT_URL
        GATEWAY_URL="${INPUT_URL:-$EXISTING_URL}"
      else
        read -r -p "Enter Ollama URL: " INPUT_URL
        GATEWAY_URL="${INPUT_URL:-}"
      fi
      ;;
    3)
      if [[ -n "$EXISTING_URL" ]]; then
        read -r -p "Enter Custom Gateway URL [press Enter to keep current]: " INPUT_URL
        GATEWAY_URL="${INPUT_URL:-$EXISTING_URL}"
      else
        read -r -p "Enter Custom Gateway URL: " INPUT_URL
        GATEWAY_URL="${INPUT_URL:-}"
      fi
      ;;
    4)
      GATEWAY_URL=""
      ;;
    *)
      GATEWAY_URL="${EXISTING_URL:-}"
      ;;
  esac

  if [[ -n "$GATEWAY_URL" ]]; then
    echo ""
    echo "🔑 Step 2: API Key / Auth Token"
    if [[ -n "$EXISTING_TOKEN" ]]; then
      read -r -p "Enter API Key / Auth Token [press Enter to keep current]: " INPUT_TOKEN
      AUTH_TOKEN="${INPUT_TOKEN:-$EXISTING_TOKEN}"
    else
      read -r -p "Enter API Key / Auth Token (press Enter to skip): " INPUT_TOKEN
      AUTH_TOKEN="${INPUT_TOKEN:-}"
    fi

    echo ""
    echo "🤖 Step 3: Default Model / Combo Name"
    if [[ -n "$EXISTING_MODEL" ]]; then
      read -r -p "Enter default model or combo name [press Enter to keep current]: " INPUT_MODEL
      MODEL_NAME="${INPUT_MODEL:-$EXISTING_MODEL}"
    else
      read -r -p "Enter default model or combo name (press Enter to skip): " INPUT_MODEL
      MODEL_NAME="${INPUT_MODEL:-}"
    fi
  fi
fi

echo ""
echo "⚙️ Saving configuration globally into ~/.claude/settings.json..."

# 4. Save into ~/.claude/settings.json
node -e "
const fs = require('fs');
const globalPath = '$GLOBAL_SETTINGS';
let settings = {};

if (fs.existsSync(globalPath)) {
  try {
    settings = JSON.parse(fs.readFileSync(globalPath, 'utf8'));
  } catch (e) {}
}

settings.env = settings.env || {};

const gatewayUrl = '$GATEWAY_URL';
const authToken = '$AUTH_TOKEN';
const modelName = '$MODEL_NAME';
const gatewayChoice = '$GATEWAY_CHOICE';

if (gatewayChoice === '4') {
  delete settings.env.ANTHROPIC_BASE_URL;
} else if (gatewayUrl) {
  settings.env.ANTHROPIC_BASE_URL = gatewayUrl;
}
if (authToken) {
  settings.env.ANTHROPIC_AUTH_TOKEN = authToken;
}
if (modelName) {
  settings.env.ANTHROPIC_MODEL = modelName;
  settings.env.ANTHROPIC_DEFAULT_OPUS_MODEL = modelName;
  settings.env.ANTHROPIC_DEFAULT_SONNET_MODEL = modelName;
  settings.env.ANTHROPIC_DEFAULT_HAIKU_MODEL = modelName;
  settings.env.ANTHROPIC_SMALL_FAST_MODEL = modelName;
}

// Register plugin globally
settings.plugins = settings.plugins || {};
settings.plugins['token-monitor'] = {
  path: '$PLUGIN_DIR'
};

fs.writeFileSync(globalPath, JSON.stringify(settings, null, 2), 'utf8');
console.log('✅ Updated ~/.claude/settings.json successfully.');
"

# 5. Install global Claude Code skill (~/.claude/skills/planning/SKILL.md)
GLOBAL_SKILL_DIR="$GLOBAL_CLAUDE_DIR/skills/planning"
mkdir -p "$GLOBAL_SKILL_DIR"

cat << EOF > "$GLOBAL_SKILL_DIR/SKILL.md"
---
name: planning
description: Open Planning Studio, reconcile project plan, or show token usage status with strict workspace isolation
---

# /planning

Manage the project implementation plan, token monitor, and activity logs.

## Important: Strict Project Isolation
- When \`/planning\` is executed, all operations apply strictly to the current active project folder (\`pwd\`).
- **Never update or write files into $REPO_DIR** when working in another project.
- Every project maintains its own isolated \`.planner/\` directory (\`plan.json\`, \`projects.json\`, \`dashboard.json\`, \`activity.json\`, \`usage.jsonl\`).
- Credentials are NOT written into project folders; they are inherited from global \`~/.claude/settings.json\`.

## Subcommands
- \`/planning\`: Launch Planning Studio UI on \`http://localhost:3001\` and open in browser for the active project.
- \`/planning sync\`: Reconcile workspace file diffs, update task completion statuses, ingest SQLite history, and sync activity transcripts in the current project.
- \`/planning status\`: Output a clean 5-line terminal status summary for the current project.
- \`/planning export\`: Export chat conversations and activity logs to a formatted .txt file (optional: \`/planning export [file.txt]\`).

## Command Execution
\`\`\`bash
node "$PLUGIN_DIR/commands/planning.js" \$ARGUMENTS
\`\`\`
EOF
echo "✅ Installed global /planning slash command in ~/.claude/skills/planning/SKILL.md."

# 6. Make scripts executable
chmod +x "$PLUGIN_DIR/commands/planning.js" 2>/dev/null || true
chmod +x "$PLUGIN_DIR/commands/generate-plan.js" 2>/dev/null || true
chmod +x "$PLUGIN_DIR/scripts/log-activity.js" 2>/dev/null || true

# 7. Verify built frontend viewer
if [[ -f "$PLUGIN_DIR/viewer/index.html" ]]; then
  echo "✅ Planning Studio frontend viewer verified."
else
  echo "⚠️ Notice: Frontend viewer assets not found in $PLUGIN_DIR/viewer. Run 'npm run build' in frontend/ if needed."
fi

echo ""
echo "=================================================================="
echo "🎉 SUCCESS: Token Monitor & Planning Studio is installed globally!"
echo "=================================================================="
echo ""
echo "🔒 PRIVACY & ZERO-TOUCH GUARANTEE:"
echo "   - Your API key and proxy URL are stored ONLY in ~/.claude/settings.json."
echo "   - NO credential data will ever be written to individual project folders."
echo "   - You do NOT need to copy any files or .sh scripts to other projects."
echo ""
echo "🚀 HOW TO USE IN ANY PROJECT:"
echo "   1. Navigate to any project folder: cd /path/to/my-project"
echo "   2. Start Claude Code: claude"
echo "   3. Type: /planning"
echo ""
echo "   ✨ The prerequisites (.planner/, prices.json, plan.json, app.db)"
echo "      will automatically self-initialize inside that project on first run!"
echo "=================================================================="
