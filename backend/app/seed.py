import os
from sqlmodel import Session, select
from backend.app.models import ModelInventoryItem, Project, Module, Task, ModelUsageRecord, SessionRecord, ActivityLog
import datetime

def seed_database(session: Session):
    workspace_dir = os.environ.get("WORKSPACE_DIR", os.getcwd())
    # Ensure Project exists
    project = session.exec(select(Project)).first()
    if not project:
        project = Project(
            name=os.path.basename(workspace_dir),
            description="Unified operations center for monitoring OmniRoute model usage, planning software, and tracking Claude Code.",
            repository_path=workspace_dir,
            status="active",
            stage="execution"
        )
        session.add(project)
        session.commit()
        session.refresh(project)

    # Check if modules already exist with stable names
    existing_modules = session.exec(select(Module).where(Module.project_id == project.id)).all()
    if len(existing_modules) >= 3:
        return

    # Clear any partially seeded modules and tasks to prevent duplicates
    for mod in existing_modules:
        tasks = session.exec(select(Task).where(Task.module_id == mod.id)).all()
        for t in tasks:
            usages = session.exec(select(ModelUsageRecord).where(ModelUsageRecord.task_id == t.id)).all()
            for u in usages:
                session.delete(u)
            session.delete(t)
        session.delete(mod)
    session.commit()

    # Create stable canonical modules
    mod_backend = Module(project_id=project.id, name="Backend API & Architecture", category="backend", status="completed")
    mod_frontend = Module(project_id=project.id, name="Frontend Dashboard & UI", category="frontend", status="completed")
    mod_infra = Module(project_id=project.id, name="Proxy & Model Routing", category="infra", status="in_progress")
    session.add(mod_backend)
    session.add(mod_frontend)
    session.add(mod_infra)
    session.commit()
    session.refresh(mod_backend)
    session.refresh(mod_frontend)
    session.refresh(mod_infra)

    tasks_data = [
        {
            "module_id": mod_backend.id,
            "title": "FastAPI core setup & SQLite schema",
            "objective": "Establish FastAPI app structure and database models for projects, modules, tasks, and usage.",
            "category": "backend",
            "complexity": "medium",
            "model": "antigravity/claude-sonnet-4-6",
            "in_tokens": 18450,
            "out_tokens": 4120,
            "latency": 320.0,
            "hours_ago": 1,
            "status": "completed"
        },
        {
            "module_id": mod_frontend.id,
            "title": "Overview dashboard summary cards & charts",
            "objective": "Build token consumption charts and summary KPI cards in React + Tailwind.",
            "category": "frontend",
            "complexity": "medium",
            "model": "antigravity/gemini-3-flash",
            "in_tokens": 22100,
            "out_tokens": 3850,
            "latency": 195.0,
            "hours_ago": 2,
            "status": "completed"
        },
        {
            "module_id": mod_frontend.id,
            "title": "Planning Studio hierarchical tree view",
            "objective": "Implement Project -> Module -> Task tree hierarchy with detail drawer and dependency editor.",
            "category": "frontend",
            "complexity": "high",
            "model": "anti-gravity",
            "in_tokens": 34800,
            "out_tokens": 6400,
            "latency": 410.0,
            "hours_ago": 3,
            "status": "completed"
        },
        {
            "module_id": mod_backend.id,
            "title": "Complex dependency cycle resolution algorithm",
            "objective": "Analyze DAG cycles in task dependencies and provide topological ordering.",
            "category": "backend",
            "complexity": "critical",
            "model": "antigravity/claude-opus-4-6-thinking",
            "in_tokens": 45200,
            "out_tokens": 11300,
            "latency": 840.0,
            "hours_ago": 4,
            "status": "completed"
        },
        {
            "module_id": mod_infra.id,
            "title": "OmniRoute proxy authentication & token interceptor",
            "objective": "Implement backend token resolution and live proxy headers.",
            "category": "infra",
            "complexity": "medium",
            "model": "antigravity/gemini-3.1-pro-high",
            "in_tokens": 16800,
            "out_tokens": 2900,
            "latency": 250.0,
            "hours_ago": 5,
            "status": "in_progress"
        },
        {
            "module_id": mod_frontend.id,
            "title": "Notion-inspired minimalist design tokens & dark mode",
            "objective": "Configure CSS variables, subtle borders, and system font typography.",
            "category": "frontend",
            "complexity": "medium",
            "model": "antigravity/claude-sonnet-4-6",
            "in_tokens": 28600,
            "out_tokens": 5400,
            "latency": 380.0,
            "hours_ago": 6,
            "status": "completed"
        },
        {
            "module_id": mod_infra.id,
            "title": "Multi-model quota velocity & rate-limit monitoring",
            "objective": "Poll provider endpoints to measure token velocity and quota risks.",
            "category": "infra",
            "complexity": "high",
            "model": "antigravity/gemini-pro-agent",
            "in_tokens": 12400,
            "out_tokens": 1800,
            "latency": 210.0,
            "hours_ago": 8,
            "status": "completed"
        },
        {
            "module_id": mod_backend.id,
            "title": "Automated test harness for task lifecycle events",
            "objective": "Unit test task creation, status transitions, and activity log persistence.",
            "category": "backend",
            "complexity": "low",
            "model": "antigravity/gpt-oss-120b-medium",
            "in_tokens": 15300,
            "out_tokens": 2750,
            "latency": 290.0,
            "hours_ago": 10,
            "status": "completed"
        }
    ]

    base_time = datetime.datetime.utcnow()

    for item in tasks_data:
        task = Task(
            module_id=item["module_id"],
            title=item["title"],
            objective=item["objective"],
            category=item["category"],
            complexity=item["complexity"],
            risk="low",
            recommended_model=item["model"],
            estimated_tokens=item["in_tokens"] + item["out_tokens"],
            estimated_cost=0.0,
            assignment_mode="ai_recommended",
            status=item["status"]
        )
        session.add(task)
        session.commit()
        session.refresh(task)

        usage = ModelUsageRecord(
            model_name=item["model"],
            project_id=project.id,
            task_id=task.id,
            input_tokens=item["in_tokens"],
            output_tokens=item["out_tokens"],
            cost=0.0,
            latency_ms=item["latency"],
            status="success",
            timestamp=base_time - datetime.timedelta(hours=item["hours_ago"])
        )
        session.add(usage)

        log = ActivityLog(
            project_id=project.id,
            model_name=item["model"],
            event_type="request",
            status="success",
            summary=f"Completed '{item['title']}' using {item['model']}",
            details=item["objective"],
            timestamp=base_time - datetime.timedelta(hours=item["hours_ago"])
        )
        session.add(log)

    session.commit()
