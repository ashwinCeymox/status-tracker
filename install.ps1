# ==============================================================================
# install.ps1
# Universal Global PowerShell Installer for Token Monitor & Planning Studio Plugin
# Designed for Windows PowerShell / PowerShell Core
#
# Configures ~/.claude/settings.json globally in %USERPROFILE%\.claude
# ==============================================================================

param(
    [switch]$Default
)

$ErrorActionPreference = "Stop"

$repoDir = $PSScriptRoot
$pluginDir = Join-Path $repoDir "plugin\token-moniter-planner"

# Determine .claude directory on Windows
$claudeDir = if ($env:CLAUDE_CONFIG_DIR) {
    $env:CLAUDE_CONFIG_DIR
} else {
    Join-Path $env:USERPROFILE ".claude"
}

$globalSettings = Join-Path $claudeDir "settings.json"
$skillsDir = Join-Path $claudeDir "skills\planning"

if (-not (Test-Path $claudeDir)) {
    New-Item -ItemType Directory -Path $claudeDir -Force | Out-Null
}

Write-Host "==================================================================" -ForegroundColor Cyan
Write-Host "⚡ Token Monitor & Planning Studio: Windows Global Installer" -ForegroundColor Cyan
Write-Host "   Repository: $repoDir"
Write-Host "   Claude Dir: $claudeDir"
Write-Host "=================================================================="

# 1. Check Node.js
try {
    $nodeVer = & node -v
    Write-Host "✅ Node.js detected: $nodeVer" -ForegroundColor Green
} catch {
    Write-Host "❌ Error: Node.js is not installed or not in PATH. Please install Node.js (v18+)." -ForegroundColor Red
    Exit 1
}

# 2. Read existing settings
$existingUrl = ""
$existingToken = ""
$existingModel = ""

if (Test-Path $globalSettings) {
    try {
        $json = Get-Content $globalSettings -Raw | ConvertFrom-Json
        if ($json.env) {
            $existingUrl = $json.env.ANTHROPIC_BASE_URL
            $existingToken = $json.env.ANTHROPIC_AUTH_TOKEN
            $existingModel = $json.env.ANTHROPIC_MODEL
        }
    } catch {}
}

$defaultUrl = if ($existingUrl) { $existingUrl } else { "" }
$defaultModel = if ($existingModel) { $existingModel } else { "" }

$gatewayUrl = $defaultUrl
$authToken = $existingToken
$modelName = $defaultModel

# 3. Interactive Setup if not -Default
if (-not $Default -and [Environment]::UserInteractive) {
    Write-Host ""
    Write-Host "📡 Step 1: Select API Gateway / Proxy" -ForegroundColor Yellow
    Write-Host "   1) OmniRoute (Local proxy)"
    Write-Host "   2) Ollama (Local server)"
    Write-Host "   3) Custom API Gateway URL"
    Write-Host "   4) Skip (Direct Claude / No Proxy)"
    $choice = Read-Host "Select option [1-4, default 1]"
    if (-not $choice) { $choice = "1" }

    switch ($choice) {
        "1" {
            if ($existingUrl) {
                $inputUrl = Read-Host "Enter OmniRoute URL "
                $gatewayUrl = if ($inputUrl) { $inputUrl } else { $existingUrl }
            } else {
                $gatewayUrl = Read-Host "Enter OmniRoute URL"
            }
        }
        "2" {
            if ($existingUrl) {
                $inputUrl = Read-Host "Enter Ollama URL "
                $gatewayUrl = if ($inputUrl) { $inputUrl } else { $existingUrl }
            } else {
                $gatewayUrl = Read-Host "Enter Ollama URL"
            }
        }
        "3" {
            if ($existingUrl) {
                $inputUrl = Read-Host "Enter Custom Gateway URL "
                $gatewayUrl = if ($inputUrl) { $inputUrl } else { $existingUrl }
            } else {
                $gatewayUrl = Read-Host "Enter Custom Gateway URL"
            }
        }
        "4" {
            $gatewayUrl = ""
        }
        Default {
            $gatewayUrl = $defaultUrl
        }
    }

    if ($gatewayUrl) {
        Write-Host ""
        Write-Host "🔑 Step 2: API Key / Auth Token" -ForegroundColor Yellow
        if ($existingToken) {
            $inputToken = Read-Host "Enter API Key / Auth Token [press Enter to keep current]"
            $authToken = if ($inputToken) { $inputToken } else { $existingToken }
        } else {
            $inputToken = Read-Host "Enter API Key / Auth Token (press Enter to skip)"
            $authToken = $inputToken
        }

        Write-Host ""
        Write-Host "🤖 Step 3: Default Model / Combo Name" -ForegroundColor Yellow
        if ($existingModel) {
            $inputModel = Read-Host "Enter default model or combo name [press Enter to keep current]"
            $modelName = if ($inputModel) { $inputModel } else { $existingModel }
        } else {
            $inputModel = Read-Host "Enter default model or combo name (press Enter to skip)"
            $modelName = $inputModel
        }
    }
}

Write-Host ""
Write-Host "⚙️ Saving configuration globally into $globalSettings..." -ForegroundColor Cyan

# 4. Update settings.json via Node script to guarantee JSON structure preservation
$pluginDirEscaped = $pluginDir.Replace('\', '/')
$globalSettingsEscaped = $globalSettings.Replace('\', '/')

node -e "
const fs = require('fs');
const globalPath = '$globalSettingsEscaped';
let settings = {};

if (fs.existsSync(globalPath)) {
  try {
    settings = JSON.parse(fs.readFileSync(globalPath, 'utf8'));
  } catch (e) {}
}

settings.env = settings.env || {};
const gatewayUrl = '$gatewayUrl';
const authToken = '$authToken';
const modelName = '$modelName';
const choice = '$choice';

if (choice === '4') {
  delete settings.env.ANTHROPIC_BASE_URL;
} else if (gatewayUrl) {
  settings.env.ANTHROPIC_BASE_URL = gatewayUrl;
}
if (authToken) settings.env.ANTHROPIC_AUTH_TOKEN = authToken;
if (modelName) {
  settings.env.ANTHROPIC_MODEL = modelName;
  settings.env.ANTHROPIC_DEFAULT_OPUS_MODEL = modelName;
  settings.env.ANTHROPIC_DEFAULT_SONNET_MODEL = modelName;
  settings.env.ANTHROPIC_DEFAULT_HAIKU_MODEL = modelName;
  settings.env.ANTHROPIC_SMALL_FAST_MODEL = modelName;
}

settings.plugins = settings.plugins || {};
settings.plugins['token-monitor'] = {
  path: '$pluginDirEscaped'
};

fs.writeFileSync(globalPath, JSON.stringify(settings, null, 2), 'utf8');
console.log('✅ Updated settings.json successfully.');
"

# 5. Create Skill file
if (-not (Test-Path $skillsDir)) {
    New-Item -ItemType Directory -Path $skillsDir -Force | Out-Null
}

$skillFile = Join-Path $skillsDir "SKILL.md"
$planningScript = (Join-Path $pluginDir "commands\planning.js").Replace('\', '/')

$skillContent = @"
---
name: planning
description: Open Planning Studio, reconcile project plan, or show token usage status with strict workspace isolation
---

# /planning

Manage the project implementation plan, token monitor, and activity logs.

## Important: Strict Project Isolation
- When `/planning` is executed, all operations apply strictly to the current active project folder (`pwd`).
- Every project maintains its own isolated `.planner/` directory (`plan.json`, `projects.json`, `dashboard.json`, `activity.json`, `usage.jsonl`).
- Credentials are NOT written into project folders; they are inherited from global `~/.claude/settings.json`.

## Subcommands
- `/planning`: Launch Planning Studio UI on `http://localhost:3001` and open in browser for the active project.
- `/planning sync`: Reconcile workspace file diffs, update task completion statuses, ingest SQLite history, and sync activity transcripts in the current project.
- `/planning status`: Output a clean 5-line terminal status summary for the current project.
- `/planning export`: Export chat conversations and activity logs to a formatted .txt file (optional: `/planning export [file.txt]`).

## Command Execution
```bash
node "$planningScript" `$ARGUMENTS
```
"@

Set-Content -Path $skillFile -Value $skillContent -Encoding UTF8
Write-Host "✅ Installed global /planning slash command in $skillFile" -ForegroundColor Green

Write-Host ""
Write-Host "==================================================================" -ForegroundColor Green
Write-Host "🎉 SUCCESS: Token Monitor & Planning Studio is installed globally on Windows!" -ForegroundColor Green
Write-Host "=================================================================="
Write-Host "🚀 HOW TO USE IN ANY PROJECT:"
Write-Host "   1. Open terminal: cd C:\path\to\any-project"
Write-Host "   2. Start Claude Code: claude"
Write-Host "   3. Type: /planning"
Write-Host "=================================================================="
