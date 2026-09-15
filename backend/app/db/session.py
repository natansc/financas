from sqlmodel import create_engine, SQLModel, Session
from sqlalchemy.engine import Engine
from sqlalchemy import event
from ..config import settings

engine = create_engine(settings.DATABASE_URL, echo=False, pool_pre_ping=True)

# Optional: enforce foreign keys for sqlite (not needed for Postgres)
def get_session():
    with Session(engine) as session:
        yield session
