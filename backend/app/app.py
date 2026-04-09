import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api.router import api_router
from app.config import get_settings
from app.db.migrate import run_upgrade_head
from app.db.seed import seed_learning_cases_if_empty
from app.db.session import SessionLocal

logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI):
    run_upgrade_head()
    try:
        with SessionLocal() as db:
            seed_learning_cases_if_empty(db)
    except Exception:
        logger.exception("数据库初始化或种子数据失败；请检查 DATABASE_URL 与 PostgreSQL 是否可用。")
        raise
    yield


def create_app() -> FastAPI:
    settings = get_settings()
    app = FastAPI(title=settings.app_name, version="1.0.0", lifespan=lifespan)
    app.add_middleware(
        CORSMiddleware,
        allow_origins=["*"],
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )
    app.include_router(api_router)
    return app
