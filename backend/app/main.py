"""FastAPI application — QueueStorm Investigator.

Required by the spec:
  GET  /health          -> {"status": "ok"}
  POST /analyze-ticket  -> structured investigator response

HTTP status policy (Section 4.1):
  200  valid analysis
  400  malformed JSON or missing required fields
  422  schema-valid but semantically invalid (e.g. empty complaint)
  500  internal error (no stack traces / secrets ever leaked)
"""
from __future__ import annotations

import asyncio
import logging
import time
from contextlib import asynccontextmanager

from fastapi import FastAPI, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from pydantic import ValidationError

from .agents.orchestrator import analyze
from .config import get_settings
from .db import db
from .routes_dashboard import _adapt_sort_body, router as dashboard_router
from .schemas import AnalyzeTicketRequest, AnalyzeTicketResponse, HealthResponse
from .store import store

logging.basicConfig(level=logging.INFO)
log = logging.getLogger("queuestorm")


@asynccontextmanager
async def lifespan(_app: FastAPI):
    # Best-effort: connect the durable mirror and seed the in-memory store.
    # Failures here never block startup — the service runs memory-only.
    try:
        if db.init():
            store.seed(db.load_recent(200))
    except Exception:  # noqa: BLE001
        log.warning("durability init skipped")
    yield


app = FastAPI(
    title="QueueStorm Investigator",
    version="1.0.0",
    description="An investigator copilot for fintech support agents.",
    lifespan=lifespan,
)

# CORS: the judge harness and the SPA both call this cross-origin in some setups.
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/health", response_model=HealthResponse)
def health() -> HealthResponse:
    return HealthResponse(status="ok")


@app.get("/")
def root() -> dict[str, str]:
    return {"service": "QueueStorm Investigator", "health": "/health", "analyze": "/analyze-ticket"}


async def _run_analysis(req: AnalyzeTicketRequest) -> dict:
    t0 = time.perf_counter()
    response_dict, provider = await analyze(req)
    # Validate against the strict output schema (guarantees enum/field contract).
    validated = AnalyzeTicketResponse(**response_dict)
    latency_ms = (time.perf_counter() - t0) * 1000.0
    out = validated.model_dump()
    # Episodic memory (for the dashboard + anomaly detection). Never blocks.
    try:
        item = store.record(out, req.model_dump(), latency_ms, provider)
        # Durable mirror write — fire-and-forget, off the response path.
        asyncio.create_task(db.insert_async(item))
    except Exception:  # noqa: BLE001
        pass
    return out


@app.post("/analyze-ticket")
async def analyze_ticket(request: Request):
    # Parse body manually for precise 400 vs 422 control.
    try:
        body = await request.json()
    except Exception:  # noqa: BLE001
        raise HTTPException(status_code=400, detail="Malformed JSON body.")
    if not isinstance(body, dict):
        raise HTTPException(status_code=400, detail="Request body must be a JSON object.")
    try:
        req = AnalyzeTicketRequest(**body)
    except ValidationError:
        raise HTTPException(status_code=400, detail="Missing or invalid required fields (ticket_id, complaint).")
    if not req.complaint or not req.complaint.strip():
        raise HTTPException(status_code=422, detail="Field 'complaint' must not be empty.")
    try:
        out = await _run_analysis(req)
    except HTTPException:
        raise
    except Exception:  # noqa: BLE001
        log.exception("analyze-ticket failed")
        raise HTTPException(status_code=500, detail="Internal error while analyzing the ticket.")
    return JSONResponse(status_code=200, content=out)


@app.post("/sort-ticket")
async def sort_ticket(request: Request):
    """Demo-friendly alias used by the included UI. Accepts the UI's shorthand
    body and returns the same structured analysis as /analyze-ticket."""
    try:
        body = await request.json()
    except Exception:  # noqa: BLE001
        raise HTTPException(status_code=400, detail="Malformed JSON body.")
    if not isinstance(body, dict):
        raise HTTPException(status_code=400, detail="Request body must be a JSON object.")
    req = _adapt_sort_body(body)
    if not req.complaint or not req.complaint.strip():
        raise HTTPException(status_code=422, detail="Field 'complaint'/'message' must not be empty.")
    try:
        out = await _run_analysis(req)
    except Exception:  # noqa: BLE001
        log.exception("sort-ticket failed")
        raise HTTPException(status_code=500, detail="Internal error while analyzing the ticket.")
    return JSONResponse(status_code=200, content=out)


# Extended dashboard endpoints (non-judged).
app.include_router(dashboard_router)


@app.exception_handler(Exception)
async def unhandled_exception_handler(request: Request, exc: Exception):
    # Final safety net — never leak stack traces or secrets.
    log.exception("Unhandled error")
    return JSONResponse(status_code=500, content={"detail": "Internal error."})


if __name__ == "__main__":
    import uvicorn

    settings = get_settings()
    uvicorn.run("app.main:app", host="0.0.0.0", port=settings.port, log_level=settings.log_level)
