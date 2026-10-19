import os
from sqlmodel import create_engine, SQLModel, Session

workspace_dir = os.environ.get("WORKSPACE_DIR", os.getcwd())
db_path = os.path.abspath(os.path.join(workspace_dir, "app.db"))
DATABASE_URL = f"sqlite:///{db_path}"

engine = create_engine(DATABASE_URL, connect_args={"check_same_thread": False})

def create_db_and_tables():
    SQLModel.metadata.create_all(engine)

def get_session():
    with Session(engine) as session:
        yield session
