from fastapi import APIRouter, Depends, HTTPException, Request
from sqlmodel import Session, select
from typing import List, Optional
import json
import os
from backend.app.database import get_session
from backend.app.models import Project, Module, Task

router = APIRouter(prefix="/api/projects", tags=["projects"])

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

@router.get("/")
def list_projects(request: Request, project_path: Optional[str] = None, session: Session = Depends(get_session)):
    ws = safe_cwd(request, project_path)
    projects_file = os.path.join(ws, ".planner", "projects.json")
    if os.path.exists(projects_file):
        try:
            with open(projects_file, "r") as f:
                data = json.load(f)
                return [data]
        except Exception:
            pass

    projects = session.exec(select(Project)).all()
    result = []
    for p in projects:
        modules = session.exec(select(Module).where(Module.project_id == p.id)).all()
        result.append({
            "id": p.id,
            "name": p.name,
            "description": p.description,
            "repository_path": p.repository_path,
            "status": p.status,
            "stage": p.stage,
            "created_at": p.created_at,
            "modules_count": len(modules)
        })
    return result

@router.post("/", response_model=Project)
def create_project(project: Project, session: Session = Depends(get_session)):
    session.add(project)
    session.commit()
    session.refresh(project)
    return project

@router.get("/{project_id}/hierarchy")
def get_project_hierarchy(project_id: int, request: Request, project_path: Optional[str] = None, session: Session = Depends(get_session)):
    ws = safe_cwd(request, project_path)
    projects_file = os.path.join(ws, ".planner", "projects.json")
    if os.path.exists(projects_file):
        try:
            with open(projects_file, "r") as f:
                return json.load(f)
        except Exception:
            pass

    project = session.get(Project, project_id)
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")

    modules = session.exec(select(Module).where(Module.project_id == project_id)).all()
    hierarchy = []
    for m in modules:
        tasks = session.exec(select(Task).where(Task.module_id == m.id)).all()
        hierarchy.append({
            "id": m.id,
            "name": m.name,
            "category": m.category,
            "status": m.status,
            "tasks": tasks
        })

    return {
        "project": project,
        "modules": hierarchy
    }

@router.post("/{project_id}/modules", response_model=Module)
def create_module(project_id: int, module: Module, session: Session = Depends(get_session)):
    module.project_id = project_id
    session.add(module)
    session.commit()
    session.refresh(module)
    return module

@router.post("/modules/{module_id}/tasks", response_model=Task)
def create_task(module_id: int, task: Task, session: Session = Depends(get_session)):
    task.module_id = module_id
    session.add(task)
    session.commit()
    session.refresh(task)
    return task

@router.get("/plan")
def get_project_plan(request: Request, project_path: Optional[str] = None):
    # Priority: Check local workspace .planner/plan.json first
    ws = safe_cwd(request, project_path)
    plan_path = os.path.abspath(os.path.join(ws, ".planner", "plan.json"))
    if not os.path.exists(plan_path):
        return {"error": "Plan not found"}
    with open(plan_path, "r") as f:
        data = json.load(f)
    return data
