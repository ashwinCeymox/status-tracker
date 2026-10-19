from fastapi import APIRouter, Depends, HTTPException
from sqlmodel import Session, select, desc
from backend.app.database import get_session
from backend.app.models import ModelUsageRecord, Task
import os, urllib.request, json

router = APIRouter(prefix="/api/models", tags=["models"])

def get_claude_dir():
    custom = os.environ.get("CLAUDE_CONFIG_DIR")
    if custom:
        return custom
    return os.path.expanduser("~/.claude")

def get_global_settings():
    try:
        global_path = os.path.join(get_claude_dir(), "settings.json")
        if os.path.exists(global_path):
            with open(global_path, "r") as f:
                return json.load(f).get("env", {})
    except Exception:
        pass
    return {}

def get_auth_token():
    try:
        ws = os.environ.get("WORKSPACE_DIR", os.getcwd())
        settings_path = os.path.abspath(os.path.join(ws, ".claude", "settings.local.json"))
        if os.path.exists(settings_path):
            with open(settings_path, "r") as f:
                s_data = json.load(f)
                env_dict = s_data.get("env", {})
                file_token = env_dict.get("ANTHROPIC_AUTH_TOKEN") or env_dict.get("OMNIROUTE_API_KEY")
                if file_token:
                    return file_token
    except Exception:
        pass

    env_token = (
        os.environ.get("ANTHROPIC_AUTH_TOKEN") or
        os.environ.get("OMNIROUTE_API_KEY") or
        os.environ.get("ANTHROPIC_API_KEY")
    )
    if env_token:
        return env_token

    global_env = get_global_settings()
    return global_env.get("ANTHROPIC_AUTH_TOKEN") or global_env.get("OMNIROUTE_API_KEY")

def get_gateway_url():
    try:
        ws = os.environ.get("WORKSPACE_DIR", os.getcwd())
        settings_path = os.path.abspath(os.path.join(ws, ".claude", "settings.local.json"))
        if os.path.exists(settings_path):
            with open(settings_path, "r") as f:
                s_data = json.load(f)
                url = s_data.get("env", {}).get("ANTHROPIC_BASE_URL")
                if url:
                    return url.rstrip("/")
    except Exception:
        pass

    if os.environ.get("ANTHROPIC_BASE_URL"):
        return os.environ.get("ANTHROPIC_BASE_URL").rstrip("/")

    global_env = get_global_settings()
    if global_env.get("ANTHROPIC_BASE_URL"):
        return global_env.get("ANTHROPIC_BASE_URL").rstrip("/")

    return "http://localhost:20128"

@router.get("/")
def list_models(session: Session = Depends(get_session)):
    token = get_auth_token()
    base_url = get_gateway_url()
    omniroute_models = {}

    global_env = get_global_settings()
    combo_name = (os.environ.get("ANTHROPIC_MODEL") or global_env.get("ANTHROPIC_MODEL") or "").lower().replace("-", "")

    if token:
        try:
            req = urllib.request.Request(
                f"{base_url}/v1/models",
                headers={"Authorization": f"Bearer {token}"}
            )
            with urllib.request.urlopen(req) as resp:
                data = json.loads(resp.read().decode())
                for item in data.get("data", []):
                    model_id = item.get("id", "")
                    owned_by = (item.get("owned_by") or "").lower().replace("-", "")
                    # Filter by combo if configured, otherwise include all models
                    if combo_name and owned_by != combo_name and not model_id.lower().startswith(f"{combo_name}/"):
                        # If combo is specified but doesn't match, check fallback to antigravity
                        if combo_name != "antigravity" or (owned_by != "antigravity" and not model_id.startswith("antigravity/")):
                            continue
                    caps = item.get("capabilities", {})
                    caps_list = [k for k, v in caps.items() if v]
                    pricing = item.get("pricing", {})
                    omniroute_models[model_id] = {
                        "id": model_id,
                        "name": item.get("name", model_id),
                        "provider": owned_by or "omniroute",
                        "capabilities": ", ".join(caps_list) if caps_list else "general",
                        "availability": "available",
                        "context_length": item.get("context_length", 0),
                        "max_output_tokens": item.get("max_output_tokens", 0),
                        "pricing_input": pricing.get("input", 0),
                        "pricing_output": pricing.get("output", 0),
                        "pricing_cached": pricing.get("cached", 0),
                    }
        except Exception:
            pass

    # Query usage records joined with tasks to show recently used model, tokens, and feature/task worked on
    usage_records = session.exec(
        select(ModelUsageRecord, Task)
        .outerjoin(Task, ModelUsageRecord.task_id == Task.id)
        .order_by(desc(ModelUsageRecord.timestamp))
    ).all()

    result = []
    seen_models = set()

    for usage, task in usage_records:
        m_name = usage.model_name
        if m_name in seen_models:
            continue
        seen_models.add(m_name)

        meta = omniroute_models.get(m_name, {
            "id": m_name,
            "name": m_name,
            "provider": "omniroute",
            "capabilities": "general, tool_calling",
            "availability": "available",
            "context_length": 1048576,
            "max_output_tokens": 64000,
            "pricing_input": 0,
            "pricing_output": 0,
            "pricing_cached": 0,
        })

        result.append({
            **meta,
            "last_used_timestamp": usage.timestamp.isoformat(),
            "input_tokens": usage.input_tokens,
            "output_tokens": usage.output_tokens,
            "total_tokens": usage.input_tokens + usage.output_tokens,
            "feature_worked_on": task.title if task else "General Development & Execution",
            "task_objective": task.objective if task else "Project build task execution"
        })

    # Also include any active anti-gravity models not yet in recent usage history
    for m_id, meta in omniroute_models.items():
        if m_id not in seen_models:
            result.append({
                **meta,
                "last_used_timestamp": None,
                "input_tokens": 0,
                "output_tokens": 0,
                "total_tokens": 0,
                "feature_worked_on": "Available in anti-gravity combo",
                "task_objective": "Ready for assignment"
            })

    return result

@router.get("/quota-risk")
def get_quota_risk():
    return []
