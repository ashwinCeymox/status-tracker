---
name: plan
description: Open Planning Studio, reconcile project plan, or show token usage status with strict workspace isolation
---

# /planning

Manage the project implementation plan, token monitor, and activity logs.

## Important: Strict Project Isolation
- When `/planning` is executed, all operations apply strictly to the current active project folder (`pwd`).
- **Never update or write files into the plugin master repository** when working in another project.
- Every project maintains its own isolated `.planner/` directory (`plan.json`, `projects.json`, `dashboard.json`, `activity.json`, `usage.jsonl`).

## Subcommands
- `/planning`: Launch Planning Studio UI on `http://localhost:3001` and open in browser for the active project.
- `/planning sync`: Reconcile workspace file diffs, update task completion statuses, ingest SQLite history, and sync activity transcripts in the current project.
- `/planning status`: Output a clean 5-line terminal status summary for the current project.
- `/planning export`: Export chat conversations and activity logs from database and transcripts into a formatted `.txt` file. Optional output path: `/planning export [filename.txt]`.

## Command Execution
```bash
node "${CLAUDE_PLUGIN_ROOT}/commands/planning.js" $ARGUMENTS
```
