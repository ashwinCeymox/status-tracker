# Token Monitor & Planning Studio Plugin: Developer & User Manual

Welcome to the **Token Monitor & Planning Studio Plugin** for Claude Code. This tool provides real-time architectural planning, precise token and financial cost accounting, automatic conversation tracking, and an interactive developer control center.

---

## Table of Contents
1. [Architecture & Core Concepts](#1-architecture--core-concepts)
2. [Prerequisites & One-Command Setup](#2-prerequisites--one-command-setup)
3. [The `/planning` Command & Subcommands](#3-the-planning-command--subcommands)
4. [The 5 `.planner/` State Files](#4-the-5-planner-state-files)
5. [Token & Financial Cost Accounting Engine](#5-token--financial-cost-accounting-engine)
6. [Web UI & Dashboard Overview](#6-web-ui--dashboard-overview)
7. [Automatic Conversation Tracking (Lifecycle Hooks)](#7-automatic-conversation-tracking-lifecycle-hooks)
8. [Multi-Project Workspace Isolation](#8-multi-project-workspace-isolation)
9. [Troubleshooting & FAQ](#9-troubleshooting--faq)

---

## 1. Architecture & Core Concepts

The plugin operates as a lightweight, zero-dependency extension to Claude Code and OmniRoute:

```text
┌──────────────────────┐         ┌────────────────────────┐         ┌───────────────────────┐
│     Claude Code      │ ──────> │    OmniRoute Proxy     │ ──────> │  AI Model Providers   │
│   CLI & Transcripts  │         │   (http://127.0.0.1)   │         │ (Gemini, Claude, etc.)│
└──────────┬───────────┘         └───────────┬────────────┘         └───────────────────────┘
           │                                 │
           ▼                                 ▼
┌──────────────────────┐         ┌────────────────────────┐
│   Lifecycle Hooks    │         │      Usage Ledger      │
│ (log-activity.js)    │         │    (.planner/usage.jsonl)
└──────────┬───────────┘         └───────────┬────────────┘
           │                                 │
           ▼                                 ▼
┌─────────────────────────────────────────────────────────┐
│               Planning Studio Web Server                │
│             UI: Port 3001  |  API: Port 8000            │
└─────────────────────────────────────────────────────────┘
```

### Guiding Principles
- **Single Source of Truth**: All data lives locally inside your project's `.planner/` directory.
- **No Invented Numbers**: If a project has no recorded usage, the dashboard displays `"No data yet"` (`null`), never synthetic placeholder numbers.
- **Zero-Touch Tracking**: You invoke `/planning` once to initialize. All subsequent prompts, tool executions, and assistant replies are automatically captured.

---

## 2. Global Installation & Zero-Touch Usage

### System Requirements
- **Node.js**: v18.0.0 or higher (v20+ recommended).
- **API Gateway / Proxy** (Optional): OmniRoute, Ollama, or custom endpoint.
- **Claude Code CLI**: v2.1.290+.

### Step 1: Clone & Run the One-Time Global Installer
Clone the repository from GitHub and run the installer **once**:

#### On macOS / Linux / Windows (Git Bash):
```bash
git clone https://github.com/your-username/token-moniter-planner.git
cd token-moniter-planner
./install.sh
```

#### On Windows (PowerShell):
```powershell
git clone https://github.com/your-username/token-moniter-planner.git
cd token-moniter-planner
.\install.ps1
```

The installer presents an interactive wizard to configure your gateway (OmniRoute, Ollama, custom URL), API key, and model combo name.

#### Where Configuration Lives on Windows vs macOS/Linux:
- **macOS / Linux**: `~/.claude/settings.json` (`$HOME/.claude/settings.json`)
- **Windows**: `%USERPROFILE%\.claude\settings.json` (`C:\Users\<Username>\.claude\settings.json`)
- **Custom Location**: Respects the `CLAUDE_CONFIG_DIR` environment variable if set.

#### What Global Setup Does:
1. **Registers Plugin Globally**: Configures `.claude/settings.json` so Claude Code loads the plugin, proxy URL, and lifecycle hooks everywhere.
2. **Installs `/planning` Skill**: Installs `.claude/skills/planning/SKILL.md` so the `/planning` slash command works across all projects and terminals.
3. **Verifies Frontend Viewer**: Checks that built viewer assets exist in `viewer/`.

---

### Step 2: Use in Any Project (Zero-Touch Setup)
You **do not need to copy any `.sh` scripts or plugin files** into your project folders!

Simply open any project in your terminal:
```bash
cd /path/to/any-project
claude
```
And inside Claude Code, run:
```text
/planning
```

#### What Happens Automatically on First Run:
When you run `/planning` in a project, the plugin automatically self-initializes all local prerequisites:
- Creates `.planner/` with `prices.json` (model unit pricing table).
- Scans files and creates `.planner/plan.json`, `projects.json`, and `dashboard.json`.
- Ingests session transcripts into `.planner/activity.json`.
- Connects to OmniRoute and synchronizes `.planner/usage.jsonl`.
- Initializes local SQLite `app.db` for dialogue tracking.
- Adds `npm start` to `package.json` for standalone terminal launch.
- Launches the Planning Studio on `http://localhost:3001`!

---

## 3. The `/planning` Command & Subcommands

The plugin exposes a native slash command inside Claude Code with three modes of operation:

### 1. `/planning` (Interactive UI Mode)
```text
/planning
```
- Reconciles your project plan against the latest Git diff and files.
- Starts the Planning Studio server on `http://localhost:3001` (API on `8000`).
- Automatically opens the dashboard in your default browser (avoiding duplicate tabs if already open).
- Ingests new OmniRoute call logs into `.planner/usage.jsonl`.

### 2. `/planning sync` (Headless Sync Mode)
```text
/planning sync
```
- Runs headlessly in the terminal without opening a browser.
- Scans workspace file diffs, updates task completion checkmarks (`done`), ingests historical SQLite records, and syncs session transcripts.
- Ideal for running after major git rebases or code generation turns.

### 3. `/planning status` (Instant Terminal Summary)
```text
/planning status
```
Outputs a concise 5-line terminal status report:
```text
=== Planning Studio Status ===
Project:        my-awesome-app
Modules:        3 modules tracked
Tokens (in/out): 22,334,530 in / 74,175 out
Cost:           $3.70
Ledger Status:  measured
```

---

## 4. The 5 `.planner/` State Files

Every project contains an isolated `.planner/` directory holding 5 structured data files:

| File | Format | Purpose | Web App Reflection |
| :--- | :--- | :--- | :--- |
| **`plan.json`** | JSON | Product concept, architecture domains, modules, and tasks. | **Planning Studio (`/planning`)**: Powers the *Progress Info* checklist and *Docs* specification. |
| **`projects.json`** | JSON | Project metadata, Git branch/commit, repository path, module tree. | **Projects (`/projects`)**: Header card, branch badge, and module/task overview. |
| **`dashboard.json`** | JSON | Aggregated token counts, financial cost, unpriced models list. | **Dashboard (`/dashboard`)**: KPI summary cards and target project pill. |
| **`usage.jsonl`** | JSON Lines | Append-only ledger recording every billable API call with unit pricing. | **Dashboard (`/dashboard`)**: Recharts area chart and Recent Requests table. |
| **`activity.json`** | JSON | Normalized Claude Code conversation turns grouped by session. | **Activity Logs (`/logs`)**: Timeline view of user prompts and AI responses. |

---

## 5. Token & Financial Cost Accounting Engine

### Model Pricing Table (`.planner/prices.json`)
Unit prices are defined in USD per million tokens:
```json
{
  "models": {
    "claude-opus-4-6-thinking": { "in": 15.0, "cache_read": 1.5, "cache_write": 18.75, "out": 75.0 },
    "claude-sonnet-4-6":        { "in": 3.0,  "cache_read": 0.3, "cache_write": 3.75,  "out": 15.0 },
    "gemini-3.5-flash-lite":    { "in": 0.075, "cache_read": 0.01875, "cache_write": 0.0, "out": 0.30 },
    "gemini-3-flash":           { "in": 0.15,  "cache_read": 0.0375,  "cache_write": 0.0, "out": 0.60 }
  }
}
```

### Exact Cost Formula
For each request in `.planner/usage.jsonl`:
$$\text{Cost} = \left(\frac{\text{Billable Input}}{10^6} \times P_{\text{in}}\right) + \left(\frac{\text{Cache Read}}{10^6} \times P_{\text{cache}}\right) + \left(\frac{\text{Output} + \text{Reasoning}}{10^6} \times P_{\text{out}}\right)$$

### Gemini Double-Billing Normalization
Gemini natively includes cached tokens inside the reported `input_tokens`. The engine automatically subtracts cached tokens before applying input pricing:
$$\text{Billable Input}_{\text{Gemini}} = \max(0, \text{input\_tokens} - \text{cache\_read\_tokens})$$

### Unpriced Model Warning
If a call uses a model not listed in `prices.json`, the ledger marks `unpriced: true`, and the dashboard displays an alert banner rather than silently guessing $0.

### Standalone `ccusage` Reconciliation
To verify ledger accuracy against Claude Code CLI session records without double-counting:
```bash
node plugin/token-moniter-planner/commands/usage-ledger.js reconcile
```
Compares OmniRoute ledger totals against `ccusage` and flags discrepancies exceeding 5%.

---

## 6. Web UI & Dashboard Overview

Access the control center at **`http://localhost:3001`**:

### 1. Overview Dashboard (`/dashboard`)
- **Key Metrics Grid**:
  - **Project Build Input Tokens**: Total input tokens ingested.
  - **Project Build Output Tokens**: Total output tokens generated.
  - **Project Build Cost**: Measured USD expenditure.
  - **Current Date**: Today's calendar date and weekday name.
  - **Target Project**: Current workspace title and ledger health badge.
  - **Project Started**: Project folder creation date and days elapsed counter.
- **Token Usage Over Time**: Interactive daily Recharts area chart.
- **Recent Requests Widget**: 3-column live feed (`Model` with green/red status dots, `In / Out` with `<in>↑ <out>↓` in coral and emerald, and `When` relative duration).

### 2. Planning Studio (`/planning`)
- **Progress Info Tab**: Feature list with task completion checkmarks (`done`).
- **Docs Tab**: Full Software Implementation Plan including Executive Summary, Tech Stack Notes, and Folder/File breakdowns with file counts and purpose statements.

### 3. Activity Logs (`/logs`)
- Full-width conversation timeline parsed from Claude Code transcripts.
- Grouped chronologically by session (`Session 1`, `Session 2`, etc.) with the newest session expanded by default.

---

## 7. Automatic Conversation Tracking (Lifecycle Hooks)

The plugin registers non-blocking lifecycle hooks in `.claude-plugin/plugin.json`:
- **`SessionStart`**: Initializes session tracking when Claude Code boots.
- **`UserPromptSubmit`**: Captures user requests immediately upon submission.
- **`Stop`**: Triggers incremental transcript processing and plan reconciliation when turn completes.
- **`SessionEnd`**: Commits session milestones when Claude exits.

### Safeguard Performance
- Hook scripts execute in `<10ms` using byte-length checkpoints (`.planner/checkpoints.json`).
- Uses a **500ms safety timeout** to guarantee Claude Code never hangs or blocks during coding turns.

---

## 8. Multi-Project Workspace Isolation

When running in any repository (e.g. `/path/to/my-new-app`):
1. **Zero Cross-Pollution**: All generated files are placed in `/path/to/my-new-app/.planner/`.
2. **Untouched Plugin Root**: The plugin master repository (`token-moniter-planner`) is **never modified** when working on external codebases.
3. **Workspace Switching**: The backend dynamically switches context based on the active directory or `X-Workspace-Dir` HTTP header.

---

## 9. Troubleshooting & FAQ

### Q: Why does the dashboard say "No data yet"?
**A**: This is expected behavior for brand-new projects that have not yet sent API calls through OmniRoute. As soon as your first prompt executes, the ledger ingests the call and the dashboard transitions to active status.

### Q: Port 8000 or 3001 is already in use
**A**: The planning server features intelligent port management:
- If a production FastAPI backend is already healthy on port 8000, `planning.js` connects to it without issuing a kill command.
- If an old or hung process is detected on port 3001, it is safely cleaned up on startup.

### Q: Can I run the server without opening a browser?
**A**: Yes! Use the headless subcommands:
```bash
node plugin/token-moniter-planner/commands/planning.js status
node plugin/token-moniter-planner/commands/planning.js sync
```

### Q: How do I customize model prices?
**A**: Edit `.planner/prices.json` in your project root. Changes immediately apply to newly ingested calls while historical rows preserve their `prices_used` snapshot.
