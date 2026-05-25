"""
Ignis backend — FastAPI app.

Endpoints:
    POST /chat          SSE stream, accepts {messages, session_id}
    GET  /health        {"status": "ok"}
    GET  /assets/{path} Static file serving for manual PNGs
"""

import json
import os
import os
from pathlib import Path

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel

from .agent import run_agent

ROOT = Path(__file__).parent.parent
ASSETS_DIR  = ROOT / "assets"
DATA_DIR    = ROOT / "data"

app = FastAPI(title="Ignis", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

if ASSETS_DIR.exists():
    app.mount("/assets", StaticFiles(directory=str(ASSETS_DIR)), name="assets")
    
use_cache = os.environ.get("ENABLE_CANNED_CACHE", "").lower() in ("true", "1")

RED = "\033[91m"
RESET = "\033[0m"

if use_cache:
    print(f"{RED}[warning] Canned cache is enabled. Not recommended for production.{RESET}")
else:
    print("[cache] Canned cache is disabled")
# ── Schemas ────────────────────────────────────────────────────────────────────

class Message(BaseModel):
    role: str
    content: str


class ChatRequest(BaseModel):
    messages: list[Message]
    session_id: str = "default"


# ── Routes ─────────────────────────────────────────────────────────────────────

@app.get("/health")
def health():
    return {"status": "ok"}


@app.get("/baseline-grid")
def baseline_grid():
    """Return the synergic parameter grid for the Vulcan OmniPro 220."""
    with open(DATA_DIR / "baseline_grid.json", encoding="utf-8") as f:
        return json.load(f)


@app.get("/specs")
def specs():
    """Return full machine specs (duty cycles, polarity, wire/gas settings, input power)."""
    with open(DATA_DIR / "specs.json", encoding="utf-8") as f:
        return json.load(f)


@app.post("/chat")
def chat(request: ChatRequest):
    messages = [{"role": m.role, "content": m.content} for m in request.messages]

    def generate():
        for event in run_agent(messages, request.session_id):
            yield f"data: {json.dumps(event)}\n\n"

    return StreamingResponse(
        generate(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "X-Accel-Buffering": "no",
            "Connection": "keep-alive",
        },
    )
