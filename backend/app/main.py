from fastapi import FastAPI
from .api.routes import router as api_router
from .db.session import engine
from .models.orm_models import SQLModel
from .config import settings

app = FastAPI(title="Financas API")

app.include_router(api_router, prefix="/api")

# Create tables if not exist (for dev)
@app.on_event("startup")
def on_startup():
    SQLModel.metadata.create_all(engine)
