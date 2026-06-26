#!/usr/bin/env python3
"""
Akash - local launcher.

Sets up and runs the WHOLE stack on your machine (no Docker needed):

  * loads .env (so your Gemini/OpenAI keys are picked up),
  * installs backend Python deps,
  * starts the FastAPI backend on :8787,
  * installs frontend node_modules and starts the Vite dev server on :5173,
  * smoke-tests /health and /analyze-ticket.

USAGE
  python run.py                # run backend + frontend, keep alive (Ctrl+C to stop)
  python run.py --test         # start backend, smoke-test, then exit
  python run.py --api-only     # backend only (no frontend)
  python run.py --no-install   # skip dependency installation (faster restarts)

Requires Python 3.10+. Frontend needs Node.js/npm (skipped gracefully if absent).
"""
from __future__ import annotations

import argparse
import json
import os
import shutil
import subprocess
import sys
import time
import urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parent
BACKEND = ROOT / "backend"
FRONTEND = ROOT / "frontend"
API_PORT = int(os.environ.get("PORT", "8787"))
WEB_PORT = 5173
IS_WIN = os.name == "nt"


def info(msg: str) -> None:
    print(f"\n\033[1;36m›\033[0m {msg}", flush=True)


def load_dotenv(path: Path) -> None:
    """Minimal .env loader → os.environ (does not override existing vars)."""
    if not path.exists():
        return
    for line in path.read_text(encoding="utf-8").splitlines():
        line = line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        key, val = line.split("=", 1)
        os.environ.setdefault(key.strip(), val.strip())
    info(f"loaded environment from {path.name}")


def pip_install() -> None:
    info("installing backend dependencies …")
    subprocess.run([sys.executable, "-m", "pip", "install", "-q", "-r",
                    str(BACKEND / "requirements.txt")], check=True)


def start_backend() -> subprocess.Popen:
    info(f"starting backend on http://localhost:{API_PORT} …")
    env = {**os.environ, "PORT": str(API_PORT)}
    # Run uvicorn with the repo root on sys.path so `backend.app.main` imports.
    return subprocess.Popen(
        [sys.executable, "-m", "uvicorn", "backend.app.main:app",
         "--host", "0.0.0.0", "--port", str(API_PORT)],
        cwd=str(ROOT), env=env,
    )


def npm(*args: str) -> list[str]:
    exe = "npm.cmd" if IS_WIN else "npm"
    return [exe, *args]


def start_frontend(install: bool) -> subprocess.Popen | None:
    if shutil.which("npm") is None and shutil.which("npm.cmd") is None:
        info("npm not found - skipping frontend (backend still runs).")
        return None
    if install and not (FRONTEND / "node_modules").exists():
        info("installing frontend node_modules (first run) …")
        subprocess.run(npm("install", "--no-audit", "--no-fund"),
                       cwd=str(FRONTEND), check=True, shell=IS_WIN)
    info(f"starting frontend dev server on http://localhost:{WEB_PORT} …")
    env = {**os.environ, "VITE_API_BASE_URL": f"http://localhost:{API_PORT}"}
    return subprocess.Popen(
        npm("run", "dev", "--", "--port", str(WEB_PORT), "--host"),
        cwd=str(FRONTEND), env=env, shell=IS_WIN,
    )


def wait_health(timeout: int = 30) -> bool:
    url = f"http://localhost:{API_PORT}/health"
    for _ in range(timeout):
        try:
            with urllib.request.urlopen(url, timeout=2) as r:
                if r.getcode() == 200:
                    return True
        except Exception:
            time.sleep(1)
    return False


def smoke_test() -> None:
    info("smoke test: GET /health")
    with urllib.request.urlopen(f"http://localhost:{API_PORT}/health") as r:
        print(f"  {r.getcode()} {r.read().decode()}")

    info("smoke test: POST /analyze-ticket")
    payload = {
        "ticket_id": "TKT-001",
        "complaint": "I sent 5000 taka to a wrong number around 2pm today",
        "language": "en",
        "transaction_history": [
            {"transaction_id": "TXN-9101", "timestamp": "2026-04-14T14:08:22Z",
             "type": "transfer", "amount": 5000, "counterparty": "+8801719876543",
             "status": "completed"},
        ],
    }
    req = urllib.request.Request(
        f"http://localhost:{API_PORT}/analyze-ticket",
        data=json.dumps(payload).encode(), headers={"Content-Type": "application/json"})
    with urllib.request.urlopen(req) as r:
        print(f"  {r.getcode()}")
        print(json.dumps(json.loads(r.read().decode()), indent=2, ensure_ascii=False))


def main() -> None:
    ap = argparse.ArgumentParser(description="Run Akash locally.")
    ap.add_argument("--test", action="store_true", help="smoke-test then exit")
    ap.add_argument("--api-only", action="store_true", help="backend only")
    ap.add_argument("--no-install", action="store_true", help="skip dependency install")
    args = ap.parse_args()

    load_dotenv(ROOT / ".env")
    if not args.no_install:
        pip_install()

    backend = start_backend()
    procs = [backend]
    try:
        if not wait_health():
            print("Backend /health did not come up. Check the logs above.")
            backend.terminate()
            sys.exit(1)
        smoke_test()

        if args.test:
            info("done (--test). Stopping.")
            return

        if not args.api_only:
            fe = start_frontend(install=not args.no_install)
            if fe:
                procs.append(fe)

        print("\n" + "=" * 60)
        print(f"  Backend : http://localhost:{API_PORT}/health")
        print(f"  API     : POST http://localhost:{API_PORT}/analyze-ticket")
        if not args.api_only:
            print(f"  Console : http://localhost:{WEB_PORT}/")
        print("  Press Ctrl+C to stop.")
        print("=" * 60)
        while True:
            time.sleep(1)
    except KeyboardInterrupt:
        info("shutting down …")
    finally:
        for p in procs:
            try:
                p.terminate()
            except Exception:
                pass


if __name__ == "__main__":
    main()
