"""Точка входа приложения: CORS, роутеры, создание таблиц при старте."""
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.config import settings
from app.database import Base, engine
import app.models  # noqa: F401 — register SQLAlchemy mappers
from app.routers import activity_types, auth, health, schedule


@asynccontextmanager
async def lifespan(_app: FastAPI):
    # Таблицы по ORM-моделям
    Base.metadata.create_all(bind=engine)
    yield


app = FastAPI(title="Schedule", lifespan=lifespan)

# Браузер (другой порт) может ходить к API с учётом credentials
_cors_origins = [o.strip() for o in settings.CORS_ORIGINS.split(",") if o.strip()]
app.add_middleware(
    CORSMiddleware,
    allow_origins=_cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(health.router, prefix="/api")
app.include_router(auth.router, prefix="/api")
app.include_router(activity_types.router, prefix="/api")
app.include_router(schedule.router, prefix="/api")
