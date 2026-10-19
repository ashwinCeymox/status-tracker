import os
import json
from fastapi import APIRouter, Request
from typing import List, Optional

router = APIRouter(prefix="/api/logs", tags=["logs"])

def get_workspace(request: Request = None, project_path: Optional[str] = None):
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

@router.get("/")
def list_logs(request: Request, project_path: Optional[str] = None, limit: int = 150):
    ws = get_workspace(request, project_path)
    act_file = os.path.join(ws, ".planner", "activity.json")
    if os.path.exists(act_file):
        try:
            with open(act_file, "r") as f:
                data = json.load(f)
                sessions = data.get("sessions", [])
                logs = []
                for s in sessions:
                    sess_label = s.get("label", "Session")
                    sess_id = s.get("id", "")
                    for idx, m in enumerate(s.get("messages", [])):
                        role = m.get("role", "user")
                        text = m.get("text", "")
                        ts = m.get("timestamp") or s.get("startedAt")
                        logs.append({
                            "id": f"{sess_id}-{idx}",
                            "timestamp": ts,
                            "event_type": "user_prompt" if role == "user" else "ai_response",
                            "model_name": "claude",
                            "status": "success",
                            "summary": (text[:120] if text else "").replace("\n", " "),
                            "details": text,
                            "session_name": sess_label
                        })
                logs.sort(key=lambda x: str(x.get("timestamp", "")), reverse=True)
                return logs[:limit]
        except Exception:
            pass

    return []

@router.get("/activity")
def get_activity(request: Request, project_path: Optional[str] = None):
    ws = get_workspace(request, project_path)
    act_file = os.path.join(ws, ".planner", "activity.json")
    if os.path.exists(act_file):
        try:
            with open(act_file, "r") as f:
                return json.load(f)
        except Exception:
            pass
    return {"project": ws, "sessions": []}
