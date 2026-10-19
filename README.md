# Token Monitor & Planning Studio for Claude Code

A local planning studio, token telemetry engine, and real-time dashboard plugin for Claude Code.

Provides zero-touch workspace isolation, Gemini/Claude token normalization, cost accounting, live flowchart planning, and activity transcript visualization.

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
1. **API Gateway**: OmniRoute (port 20128), Ollama (port 11434), Custom URL, or Skip.
2. **API Key / Auth Token**: Saved securely into `~/.claude/settings.json` (never in project folders).
3. **Model / Combo Name**: e.g., `anti-gravity`, `llama3`, or your custom combo.

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

## 🛠️ Subcommands

| Command | Action |
| :--- | :--- |
| `/planning` | Opens Planning Studio UI on `http://localhost:3001` and reconciles tasks. |
| `/planning status` | Prints a clean 5-line terminal status summary (tokens, cost, modules). |
| `/planning sync` | Headless plan reconciliation against latest Git diff and file modifications. |

---

## 🔒 Security & Privacy Guarantee

- **Zero Credential Leakage**: Your API tokens and proxy URLs are stored exclusively in your global user profile (`~/.claude/settings.json` on macOS/Linux or `%USERPROFILE%\.claude\settings.json` on Windows).
- **Strict Project Isolation**: Every project maintains its own isolated `.planner/` data folder. No data or credentials are shared or written into other folders.

---

## 📚 Documentation

For in-depth architectural details, data schemas, and token normalization mathematics:
- See [MANUAL.md](MANUAL.md) for the developer reference manual.
- See [PROJECT_GUIDE.txt](PROJECT_GUIDE.txt) for the complete end-to-end architecture specification.
