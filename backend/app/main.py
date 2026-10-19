from fastapi import FastAPI, Request
from fastapi.responses import JSONResponse
from fastapi.middleware.cors import CORSMiddleware
from backend.app.database import create_db_and_tables, engine
from backend.app.seed import seed_database
from sqlmodel import Session
from backend.app.routers import dashboard, models, projects, logs
import traceback

app = FastAPI(
    title="OmniRoute AI Development Control Center API",
    description="Operational API for monitoring OmniRoute model usage, planning software projects, and tracking Claude Code execution.",
    version="1.0.0"
)

# Configure CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    return JSONResponse(
        status_code=500,
        content={"error": str(exc), "traceback": traceback.format_exc()}
    )

@app.on_event("startup")
def on_startup():
    create_db_and_tables()
    with Session(engine) as session:
        seed_database(session)

app.include_router(dashboard.router)
app.include_router(models.router)
app.include_router(projects.router)
app.include_router(logs.router)

@app.get("/api/health")
def health_check():
    return {
        "status": "healthy",
        "omniroute_connected": True,
        "event_collector_connected": True,
        "version": "1.0.0"
    }
