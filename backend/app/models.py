from typing import Optional, List
from sqlmodel import SQLModel, Field, Relationship
import datetime

class Project(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    name: str = Field(index=True)
    description: Optional[str] = None
    repository_path: Optional[str] = None
    status: str = Field(default="active") # active, completed, paused
    stage: str = Field(default="planning") # planning, execution, testing, review
    created_at: datetime.datetime = Field(default_factory=datetime.datetime.utcnow)

    modules: List["Module"] = Relationship(back_populates="project", sa_relationship_kwargs={"cascade": "all, delete-orphan"})

class Module(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    project_id: int = Field(foreign_key="project.id")
    name: str
    category: str = Field(default="backend") # frontend, backend, database, testing, infra
    status: str = Field(default="todo") # todo, in_progress, completed

    project: Optional[Project] = Relationship(back_populates="modules")
    tasks: List["Task"] = Relationship(back_populates="module", sa_relationship_kwargs={"cascade": "all, delete-orphan"})

class Task(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    module_id: int = Field(foreign_key="module.id")
    title: str
    objective: Optional[str] = None
    category: str = Field(default="backend") # frontend, backend, database, integration, testing, infra
    complexity: str = Field(default="medium") # low, medium, high, critical
    risk: str = Field(default="low") # low, medium, high
    dependencies: Optional[str] = None # comma separated task IDs or json string
    blockers: Optional[str] = None
    recommended_model: Optional[str] = None
    estimated_tokens: int = Field(default=10000)
    estimated_cost: float = Field(default=0.05)
    assignment_mode: str = Field(default="ai_recommended") # manual, ai_recommended, automatic
    status: str = Field(default="todo") # todo, in_progress, review, completed, blocked

    module: Optional[Module] = Relationship(back_populates="tasks")

class ModelInventoryItem(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    name: str = Field(index=True, unique=True)
    provider: str
    capabilities: str # comma separated or json
    availability: str = Field(default="available") # available, degraded, unavailable
    input_tokens: int = Field(default=0)
    output_tokens: int = Field(default=0)
    estimated_cost: float = Field(default=0.0)
    latency_ms: float = Field(default=350.0)
    error_rate: float = Field(default=0.01)
    quota_status: str = Field(default="normal") # normal, warning, exhausted
    last_used: datetime.datetime = Field(default_factory=datetime.datetime.utcnow)

class ModelUsageRecord(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    model_name: str
    project_id: Optional[int] = Field(default=None, foreign_key="project.id")
    task_id: Optional[int] = Field(default=None, foreign_key="task.id")
    input_tokens: int
    output_tokens: int
    cost: float
    latency_ms: float
    status: str = Field(default="success") # success, error, rate_limited
    timestamp: datetime.datetime = Field(default_factory=datetime.datetime.utcnow)

class SessionRecord(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    session_uuid: str = Field(index=True, unique=True)
    project_id: Optional[int] = Field(default=None, foreign_key="project.id")
    status: str = Field(default="active") # active, closed
    started_at: datetime.datetime = Field(default_factory=datetime.datetime.utcnow)
    ended_at: Optional[datetime.datetime] = None
    summary: Optional[str] = None

class ActivityLog(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    project_id: Optional[int] = Field(default=None, foreign_key="project.id")
    session_id: Optional[int] = Field(default=None, foreign_key="sessionrecord.id")
    model_name: Optional[str] = None
    event_type: str # request, task_update, model_switch, error, warning
    status: str = Field(default="info") # info, success, warning, error
    summary: str
    details: Optional[str] = None
    timestamp: datetime.datetime = Field(default_factory=datetime.datetime.utcnow)
