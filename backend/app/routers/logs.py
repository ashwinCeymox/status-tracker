import os
import json
import datetime
import sqlite3
from fastapi import APIRouter, Request
from fastapi.responses import PlainTextResponse
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
                            "combo_name": "anti-gravity",
                            "status": "success",
                            "summary": (text[:120] if text else "").replace("\n", " "),
                            "details": text,
                            "session_name": sess_label
                        })
                logs.sort(key=lambda x: str(x.get("timestamp", "")), reverse=True)
                if logs:
                    return logs[:limit]
        except Exception:
            pass

    db_path = os.path.join(ws, "app.db")
    if os.path.exists(db_path):
        try:
            
            conn = sqlite3.connect(db_path)
            conn.row_factory = sqlite3.Row
            cursor = conn.cursor()
            try:
                rows = cursor.execute("""
                    SELECT a.*,
                           COALESCE(s.summary, 'Session ' || COALESCE(a.session_id, 1)) as session_name
                    FROM activitylog a
                    LEFT JOIN sessionrecord s ON a.session_id = s.id
                    ORDER BY a.timestamp DESC
                    LIMIT ?
                """, (limit,)).fetchall()
            except Exception:
                rows = cursor.execute("SELECT * FROM activitylog ORDER BY timestamp DESC LIMIT ?", (limit,)).fetchall()
            logs = [dict(r) for r in rows]
            conn.close()
            return logs
        except Exception:
            pass

    return []

def generate_txt_export(ws: str) -> str:
    act_file = os.path.join(ws, ".planner", "activity.json")
    proj_name = os.path.basename(ws)
    now_str = datetime.datetime.now(datetime.timezone.utc).strftime("%Y-%m-%d %H:%M:%S UTC")

    lines = []
    lines.append("=" * 80)
    lines.append("TOKEN MONITOR & PLANNING STUDIO - CHAT & ACTIVITY EXPORT")
    lines.append(f"Project:     {proj_name}")
    lines.append(f"Exported At: {now_str}")
    lines.append("=" * 80 + "\n")

    sessions_found = False
    if os.path.exists(act_file):
        try:
            with open(act_file, "r") as f:
                data = json.load(f)
                sessions = data.get("sessions", [])
                if sessions:
                    sessions_found = True
                    total_msgs = sum(len(s.get("messages", [])) for s in sessions)
                    lines.append(f"Summary: {len(sessions)} session(s), {total_msgs} message(s) captured from activity logs.\n")
                    for s in sessions:
                        label = s.get("label", "Session")
                        s_id = s.get("id", "N/A")
                        started = s.get("startedAt", "N/A")
                        lines.append("-" * 80)
                        lines.append(f"{label} [ID: {s_id}]")
                        lines.append(f"Started At: {started}")
                        lines.append("-" * 80 + "\n")

                        msgs = s.get("messages", [])
                        if not msgs:
                            lines.append("(No messages recorded in this session)\n")
                        else:
                            for m in msgs:
                                raw_role = m.get("role", "unknown").upper()
                                role = "AGENT" if raw_role in ("AI", "ASSISTANT") else ("USER" if raw_role == "USER" else raw_role)
                                ts = m.get("timestamp", "N/A")
                                text = (m.get("text") or "").strip()
                                lines.append(f"[{ts}] {role}:")
                                lines.append(text)
                                lines.append("")
                        lines.append("")
        except Exception:
            pass

    if not sessions_found:
        db_path = os.path.join(ws, "app.db")
        if os.path.exists(db_path):
            try:
                import sqlite3
                conn = sqlite3.connect(db_path)
                conn.row_factory = sqlite3.Row
                cursor = conn.cursor()
                try:
                    rows = cursor.execute("""
                        SELECT a.*,
                               COALESCE(s.summary, 'Session ' || COALESCE(a.session_id, 1)) as session_name
                        FROM activitylog a
                        LEFT JOIN sessionrecord s ON a.session_id = s.id
                        ORDER BY a.timestamp ASC
                    """).fetchall()
                except Exception:
                    rows = cursor.execute("SELECT * FROM activitylog ORDER BY timestamp ASC").fetchall()
                conn.close()

                if rows:
                    sessions_found = True
                    logs = [dict(r) for r in rows]
                    lines.append(f"Summary: {len(logs)} event(s) captured from SQLite database.\n")

                    by_session = {}
                    for log in logs:
                        s_name = log.get("session_name") or f"Session {log.get('session_id') or 1}"
                        if s_name not in by_session:
                            by_session[s_name] = []
                        by_session[s_name].append(log)

                    for s_name, s_logs in by_session.items():
                        lines.append("-" * 80)
                        lines.append(f"{s_name}")
                        lines.append("-" * 80 + "\n")

                        for l in s_logs:
                            ts = l.get("timestamp") or "N/A"
                            ev_type = (l.get("event_type") or "event").upper()
                            model = f" ({l.get('model_name')})" if l.get("model_name") else ""
                            if ev_type in ("USER_PROMPT", "USER"):
                                role = "USER"
                            elif ev_type in ("AI_RESPONSE", "AI", "ASSISTANT"):
                                role = f"AGENT{model}"
                            elif ev_type == "CHAT":
                                role = f"AGENT{model}"
                            else:
                                role = f"{ev_type}{model}"

                            text = (l.get("details") or l.get("summary") or "").strip()
                            lines.append(f"[{ts}] {role}:")
                            lines.append(text)
                            lines.append("")
                        lines.append("")
            except Exception:
                pass

    if not sessions_found:
        lines.append("No chat or activity log records found for this workspace.\n")

    return "\n".join(lines)

@router.get("/export")
@router.get("/export.txt")
def export_logs_txt(request: Request, project_path: Optional[str] = None):
    ws = get_workspace(request, project_path)
    txt_content = generate_txt_export(ws)
    project_name = os.path.basename(ws)
    filename = f"chat-export-{project_name}.txt"
    return PlainTextResponse(
        content=txt_content,
        media_type="text/plain; charset=utf-8",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'}
    )

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
