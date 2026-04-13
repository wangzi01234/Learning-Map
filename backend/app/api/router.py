from fastapi import APIRouter

from app.api.routes import cases, convert, explain_chat, extend, health, md_docs, snapshots

api_router = APIRouter()
api_router.include_router(health.router)
api_router.include_router(cases.router)
api_router.include_router(extend.router)
api_router.include_router(explain_chat.router)
api_router.include_router(convert.router)
api_router.include_router(snapshots.router)
api_router.include_router(md_docs.router)
