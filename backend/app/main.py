from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.config import CORS_ORIGINS
from app.routers import (
    events,
    cbs,
    warnings,
    vulnerability,
    stats,
    explorer,
    knowledge_map,
    lineage,
)

app = FastAPI(title="재난 종합 학습 상황판 API", version="1.1.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=CORS_ORIGINS,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(events.router,        prefix="/api/events",        tags=["events"])
app.include_router(cbs.router,           prefix="/api/cbs",           tags=["cbs"])
app.include_router(warnings.router,      prefix="/api/warnings",      tags=["warnings"])
app.include_router(vulnerability.router, prefix="/api/vulnerability", tags=["vulnerability"])
app.include_router(stats.router,         prefix="/api/stats",         tags=["stats"])
app.include_router(explorer.router,      prefix="/api/explorer",      tags=["explorer"])
app.include_router(knowledge_map.router, prefix="/api/knowledge-map", tags=["knowledge-map"])
app.include_router(lineage.router,       prefix="/api/lineage",       tags=["lineage"])


@app.get("/health")
def health():
    return {"status": "ok"}
