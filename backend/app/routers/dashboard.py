import os
import json
from fastapi import APIRouter, Depends
from sqlmodel import Session, select, func
from backend.app.database import get_session
from backend.app.models import Project, ModelUsageRecord, ModelInventoryItem, Task

router = APIRouter(prefix="/api/dashboard", tags=["dashboard"])

import os
import json
import time
import subprocess
from fastapi import APIRouter, Depends, Request
from typing import Optional
from sqlmodel import Session, select, func
from backend.app.database import get_session
from backend.app.models import Project

router = APIRouter(prefix="/api/dashboard", tags=["dashboard"])

_cache_summary = None
_cache_summary_time = 0
_cache_daily = None
_cache_daily_time = 0

def safe_cwd(request: Request = None, project_path: Optional[str] = None):
    if project_path and os.path.exists(project_path):
        return os.path.abspath(project_path)
    if request:
        hdr = request.headers.get("X-Workspace-Dir") or request.headers.get("x-workspace-dir")
        if hdr and os.path.exists(hdr):
            return os.path.abspath(hdr)
    ws = os.environ.get("WORKSPACE_DIR")
    if ws and os.path.exists(ws):
        return os.path.abspath(ws)
    try:
        c = os.getcwd()
        if os.path.exists(c):
            return os.path.abspath(c)
    except Exception:
        pass
    return os.path.abspath(os.path.join(os.path.dirname(__file__), "../../../"))

def get_project_creation_date(ws):
    try:
        st = os.stat(ws)
        ts = getattr(st, 'st_birthtime', st.st_ctime)
        import datetime
        return datetime.datetime.fromtimestamp(ts, tz=datetime.timezone.utc).isoformat()
    except Exception:
        import datetime
        return datetime.datetime.now(datetime.timezone.utc).isoformat()

def compute_ledger_summary(workspace_dir):
    dash_file = os.path.join(workspace_dir, ".planner", "dashboard.json")
    started_at = get_project_creation_date(workspace_dir)
    if os.path.exists(dash_file):
        try:
            with open(dash_file, "r") as f:
                d = json.load(f)
                d["started_at"] = started_at
                return d
        except Exception:
            pass

    ledger_path = os.path.join(workspace_dir, ".planner", "usage.jsonl")
    proj_name = os.path.basename(workspace_dir)
    if os.path.exists(ledger_path):
        total_in = 0
        total_out = 0
        total_cost = 0.0
        row_count = 0
        try:
            with open(ledger_path, "r") as f:
                for line in f:
                    if not line.strip(): continue
                    try:
                        row = json.loads(line)
                        total_in += row.get("input_tokens", 0)
                        total_out += row.get("output_tokens", 0)
                        if isinstance(row.get("cost_usd"), (int, float)):
                            total_cost += row["cost_usd"]
                        row_count += 1
                    except Exception:
                        pass
            if row_count > 0:
                return {
                    "status": "measured",
                    "project_name": proj_name,
                    "target_project": proj_name,
                    "started_at": started_at,
                    "total_input_tokens": total_in,
                    "total_output_tokens": total_out,
                    "total_cost": round(total_cost, 2),
                    "row_count": row_count
                }
        except Exception:
            pass

    return {
        "status": "no_data",
        "project_name": proj_name,
        "target_project": proj_name,
        "started_at": started_at,
        "total_input_tokens": None,
        "total_output_tokens": None,
        "total_cost": None,
        "row_count": 0
    }

@router.get("/summary")
def get_dashboard_summary(request: Request, project_path: Optional[str] = None):
    ws = safe_cwd(request, project_path)
    return compute_ledger_summary(ws)

@router.get("/token-usage-over-time")
def get_token_usage_over_time(request: Request, project_path: Optional[str] = None):
    ws = safe_cwd(request, project_path)
    ledger_path = os.path.join(ws, ".planner", "usage.jsonl")
    if os.path.exists(ledger_path):
        by_date = {}
        try:
            with open(ledger_path, "r") as f:
                for line in f:
                    if not line.strip(): continue
                    try:
                        row = json.loads(line)
                        date = (row.get("ts") or "")[:10]
                        if not date: continue
                        if date not in by_date:
                            by_date[date] = {"date": date, "input": 0, "output": 0, "cost": 0.0}
                        by_date[date]["input"] += row.get("input_tokens", 0)
                        by_date[date]["output"] += row.get("output_tokens", 0)
                        if isinstance(row.get("cost_usd"), (int, float)):
                            by_date[date]["cost"] += row["cost_usd"]
                    except Exception:
                        pass
            sorted_dates = sorted(by_date.values(), key=lambda x: x["date"])
            for d in sorted_dates:
                d["cost"] = round(d["cost"], 2)
            return sorted_dates
        except Exception:
            pass

    return []
