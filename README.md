# Token Monitor & Planning Studio for Claude Code

A local planning studio, token telemetry engine, and real-time dashboard plugin for Claude Code.

Provides zero-touch workspace isolation, Gemini/Claude token normalization, cost accounting, live flowchart planning, and activity transcript visualization.

> **OmniRoute Native**: This setup is pre-configured out-of-the-box to work seamlessly with **OmniRoute** as its primary AI Gateway and telemetry source.

---

## 🚀 Quick Start (One-Time Global Installation)

Clone this repository anywhere on your machine and run the installer once:

### macOS / Linux / Windows (Git Bash):
```bash
git clone https://github.com/your-username/token-monitor-planner.git
cd token-monitor-planner
./install.sh
```

### Windows (PowerShell):
```powershell
git clone https://github.com/your-username/token-monitor-planner.git
cd token-monitor-planner
.\install.ps1
```

The interactive installer will ask you:
1. **API Gateway**: OmniRoute (Option 1 - default), Ollama, Custom URL, or Skip.
2. **API Key / Auth Token**: Saved securely into `~/.claude/settings.json` (never in project folders).
3. **Model / Combo Name**: Configure your preferred default model or combo name.

---

## 🌐 OmniRoute Setup & Integration

OmniRoute acts as the unified AI Gateway and proxy that routes, load balances, and tracks token consumption for Claude Code across model providers (Anthropic, Gemini, OpenAI, DeepSeek, Ollama, etc.).

### 1. Installing & Running OmniRoute Locally

You can launch OmniRoute using either Docker or Node.js:

#### Option A: Docker (Recommended)
```bash
# Pull and run OmniRoute container
docker run -d \
  --name omniroute \
  --restart unless-stopped \
  --stop-timeout 40 \
  -e OMNIROUTE_MEMORY_MB=8192 \
  --memory=10g \
  -p 20128:20128 \
  -v omniroute-data:/app/data \
  diegosouzapw/omniroute:latest
```

#### Option B: Node.js / Local Clone
```bash
# Clone and start OmniRoute
git clone https://github.com/your-username/omniroute.git
cd omniroute
npm install
npm start
```

*OmniRoute will be active at `http://localhost:20128` (or your configured port).*

### 2. Pre-Configured Integration

Token Monitor & Planning Studio is built specifically to pair with OmniRoute:
- **Zero-Touch Wiring**: Selecting **Option 1 (OmniRoute)** during `./install.sh` automatically routes Claude Code through OmniRoute by setting `ANTHROPIC_BASE_URL=http://localhost:8080/v1` in `~/.claude/settings.json`.
- **Live Call Telemetry**: The telemetry engine connects to OmniRoute's `/api/usage/call-logs` endpoint, recording exact prompt, completion, cache-read, and reasoning token receipts into `.planner/usage.jsonl`.
- **Proxy Status & Model Combos**: The web UI automatically displays live OmniRoute connection health and active model combos.

---

## 🎯 Usage in Any Project (Zero-Touch Setup)

You **never need to copy scripts or plugin files** into your individual projects.

1. Navigate to any project folder on your machine:
   ```bash
   cd /path/to/my-project
   claude
   ```
2. In Claude Code, run:
   ```text
   /planning
   ```

On the very first launch in any folder, the plugin automatically:
- Creates `.planner/` with `prices.json` (model unit pricing table).
- Scans files and builds `.planner/plan.json`, `projects.json`, and `dashboard.json`.
- Ingests Claude session transcripts into `.planner/activity.json`.
- Reconciles proxy call logs into `.planner/usage.jsonl`.
- Initializes local SQLite `app.db`.
- Launches the Planning Studio UI on `http://localhost:3001`!

---

## 🛠️ Subcommands & Controls

| Command | Action |
| :--- | :--- |
| `/planning` | Opens Planning Studio UI on `http://localhost:3001` and reconciles tasks. |
| `/planning status` | Prints a clean 5-line terminal status summary (tokens, cost, modules). |
| `/planning sync` | Headless plan reconciliation against latest Git diff and file modifications. |
| `/planning export` | Exports chat dialogue and activity logs to a `.txt` file (optional: `/planning export [file.txt]`). |
| `/planning stop` | Cleanly shuts down active server instances on ports `3001` and `8000`. |
| `npm run stop` | Terminal shortcut to immediately terminate lingering instances on ports `3001` & `8000`. |

---

## 🔍 How Input & Output Tokens Are Monitored and Collected

The plugin collects, normalizes, and accounts for token usage across your project through a multi-tier pipeline:

```text
┌────────────────────────────────────────────────────────────────────────┐
│                              Claude Code                               │
│  (Configured with ANTHROPIC_BASE_URL pointing to OmniRoute / Gateway)  │
└───────────────────┬─────────────────────────────────┬──────────────────┘
                    │ 1. API Calls                    │ 2. Session Transcripts
                    ▼                                 ▼
         ┌─────────────────────┐          ┌────────────────────────┐
         │   OmniRoute Proxy   │          │  ~/.claude/projects/   │
         │ (Tracks Token Usage)│          │   (*.jsonl sessions)   │
         └──────────┬──────────┘          └───────────┬────────────┘
                    │                                 │
                    │ /api/usage/call-logs            │ Lifecycle Hooks
                    │                                 │ (log-activity.js)
                    ▼                                 ▼
┌────────────────────────────────────────────────────────────────────────┐
│                   Usage Ledger Engine (usage-ledger.js)                │
│  - De-duplicates by request_id                                         │
│  - Normalizes Gemini cached tokens (prevents double-billing)           │
│  - Merges reasoning tokens into effective output tokens                │
│  - Computes cost from .planner/prices.json                             │
└───────────────────────────────────┬────────────────────────────────────┘
                                    ▼
┌────────────────────────────────────────────────────────────────────────┐
│                    Target Project: .planner/                           │
│  ├── usage.jsonl     (Append-only ledger of every call)                │
│  ├── dashboard.json  (Aggregated totals: in/out tokens, cost)          │
│  └── activity.json   (Cleaned conversation turns & timestamps)         │
└───────────────────────────────────┬────────────────────────────────────┘
                                    ▼
┌────────────────────────────────────────────────────────────────────────┐
│               Web Control Center (http://localhost:3001)               │
│  - Total Input / Output Token KPI Cards                                │
│  - Recharts Token Usage Over Time Area Chart                           │
│  - Recent Requests Live Table                                          │
└────────────────────────────────────────────────────────────────────────┘
```

### 1. Ingestion from Gateway / Proxy Logs (`fetchCallLogs` & `ingestOmniRouteLogs`)
* When Claude Code runs through an API proxy (such as OmniRoute), every model call passes through the proxy via `ANTHROPIC_BASE_URL`.
* The proxy receives exact usage metrics directly from model provider responses:
  * `tokens.in`: Raw input prompt tokens.
  * `tokens.out`: Generated response tokens.
  * `tokens.cacheRead` & `tokens.cacheWrite`: Prompt caching hits and creations.
  * `tokens.reasoning`: Extended thinking/reasoning tokens.
* The plugin queries the gateway's `/api/usage/call-logs` endpoint, filters out non-billable noise (health checks, connection tests, failed requests), and appends verified records to `.planner/usage.jsonl`.
* Calls are de-duplicated by unique `request_id` to guarantee zero double-counting.

### 2. Local Database Synchronization (`syncFromSqlite`)
* The engine checks for existing local SQLite databases (`app.db` or `backend/control_center.db`).
* Inspects the `modelusagerecord` table and ingests any prior unrecorded task executions, preserving historical token volume.

### 3. Lifecycle Hooks & Session Transcripts (`activity-pipeline.js`)
* Non-blocking hooks (`SessionStart`, `UserPromptSubmit`, `PostToolUse`, `Stop`, `SessionEnd`) invoke `scripts/log-activity.js` with a 500ms safety timeout.
* The pipeline scans Claude Code session transcripts stored in `~/.claude/projects/<project-hash>/*.jsonl`.
* Strips internal tags (`<system-reminder>`, `<ide_opened_file>`, thinking tags) and groups turns chronologically into `.planner/activity.json`.
* **Independent Audit**: Run `node plugin/token-moniter-planner/commands/usage-ledger.js reconcile` to cross-check ledger totals against Claude Code's built-in `ccusage` CLI session records (flags any discrepancy > 5%).

### 4. Normalization & Cost Engine Mathematics
* **Gemini Double-Billing Prevention**:
  Gemini natively includes cached tokens in the reported input tokens. The engine automatically normalizes this:
  $$\text{Billable Input}_{\text{Gemini}} = \max(0, \text{input\_tokens} - \text{cache\_read\_tokens})$$
* **Reasoning Token Accounting**:
  Thinking and reasoning tokens are counted as billable output tokens:
  $$\text{Effective Output} = \text{output\_tokens} + \text{reasoning\_tokens}$$
* **Unit Pricing Calculation**:
  Billed per million tokens using `.planner/prices.json`:
  $$\text{Cost} = \left(\frac{\text{Billable Input}}{10^6} \times P_{\text{in}}\right) + \left(\frac{\text{Cache Read}}{10^6} \times P_{\text{cache}}\right) + \left(\frac{\text{Cache Write}}{10^6} \times P_{\text{cache\_write}}\right) + \left(\frac{\text{Effective Output}}{10^6} \times P_{\text{out}}\right)$$

### 5. Local State Aggregation (`dashboard.json`)
* Aggregates total input tokens, output tokens, cache read/write, and USD cost into `.planner/dashboard.json`.
* **Zero Invented Numbers**: Projects with no recorded calls display `"No data yet"` (`null`) rather than synthetic mock numbers.

---

## 🔒 Security & Privacy Guarantee

- **Zero Credential Leakage**: Your API tokens and proxy URLs are stored exclusively in your global user profile (`~/.claude/settings.json` on macOS/Linux or `%USERPROFILE%\.claude\settings.json` on Windows).
- **Strict Project Isolation**: Every project maintains its own isolated `.planner/` data folder. No data or credentials are shared or written into other folders.

---

## 📚 Documentation

For in-depth architectural details, data schemas, and token normalization mathematics:
- See [MANUAL.md](MANUAL.md) for the developer reference manual.
- See [PROJECT_GUIDE.txt](PROJECT_GUIDE.txt) for the complete end-to-end architecture specification.
