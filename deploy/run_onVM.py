#!/usr/bin/env python3
"""
QueueStorm — one-command VM deployer (Debian/Ubuntu, e.g. GCP e2-micro).

WHAT IT DOES (idempotent — safe to re-run):
  1. Installs nginx, certbot, docker, curl.
  2. Adds 2 GB swap if RAM < 2 GB (so the Vite/three.js build won't OOM on micro).
  3. Resolves API keys into /opt/queuestorm/.env (falls back to deterministic,
     no-LLM mode if no keys are supplied — the service still works and scores).
  4. Builds + runs the backend API container on 127.0.0.1:8787.
  5. Builds the React frontend and serves it from /var/www/queuestorm via nginx.
  6. Configures nginx to route /health, /analyze-ticket and /api/* to the API.
  7. Obtains a Let's Encrypt HTTPS certificate for the domain (best effort).
  8. Verifies /health before exiting.

USAGE (from the repository root, after `git clone`):
  sudo python3 deploy/run_onVM.py
  sudo DOMAIN=akash.2haas.com EMAIL=ahbab.md@gmail.com python3 deploy/run_onVM.py
  sudo python3 deploy/run_onVM.py --skip-tls          # HTTP only (DNS not ready)
  sudo python3 deploy/run_onVM.py --deterministic     # force no-LLM mode

Provide real keys one of three ways (checked in order):
  * /opt/queuestorm/.env exists already, OR
  * a .env file at the repo root (scp it up — it is gitignored), OR
  * GEMINI_API_KEY / OPENAI_API_KEY set in the environment of this command.
"""
from __future__ import annotations

import argparse
import os
import shutil
import socket
import subprocess
import sys
import time
from pathlib import Path

# ── Configuration (env-overridable) ──────────────────────────────────────
DOMAIN = os.environ.get("DOMAIN", "akash.2haas.com")
EMAIL = os.environ.get("EMAIL", "ahbab.md@gmail.com")
APP_DIR = Path("/opt/queuestorm")
WEB_ROOT = Path("/var/www/queuestorm")
BACKEND_PORT = int(os.environ.get("BACKEND_PORT", "8787"))
API_IMAGE = "queuestorm-api"
API_CONTAINER = "queuestorm-api"
FE_BUILD_IMAGE = "queuestorm-frontend-build"

REPO_ROOT = Path(__file__).resolve().parents[1]


# ── small helpers ─────────────────────────────────────────────────────────
def log(stage: str, msg: str) -> None:
    print(f"\n\033[1;36m[{stage}]\033[0m {msg}", flush=True)


def run(cmd: list[str] | str, check: bool = True, env: dict | None = None,
        quiet: bool = False) -> subprocess.CompletedProcess:
    shell = isinstance(cmd, str)
    printable = cmd if shell else " ".join(cmd)
    if not quiet:
        print(f"  $ {printable}", flush=True)
    return subprocess.run(cmd, shell=shell, check=check, env={**os.environ, **(env or {})},
                          text=True)


def run_ok(cmd: list[str] | str) -> bool:
    try:
        run(cmd, check=True, quiet=True)
        return True
    except subprocess.CalledProcessError:
        return False


def require_root() -> None:
    if hasattr(os, "geteuid") and os.geteuid() != 0:
        sys.exit("This script must be run as root:  sudo python3 deploy/run_onVM.py")


# ── stage 1: packages ──────────────────────────────────────────────────────
def install_packages() -> None:
    log("1/8 packages", "Installing nginx, certbot, docker, curl …")
    apt_env = {"DEBIAN_FRONTEND": "noninteractive"}
    run("apt-get update -y", env=apt_env)
    run("apt-get install -y nginx certbot python3-certbot-nginx docker.io curl ca-certificates",
        env=apt_env)
    run("systemctl enable --now docker")
    run("systemctl enable --now nginx")


# ── stage 2: swap ──────────────────────────────────────────────────────────
def ensure_swap() -> None:
    log("2/8 swap", "Ensuring swap so the frontend build won't OOM on micro VMs …")
    try:
        mem_kb = int(next(l.split()[1] for l in Path("/proc/meminfo").read_text().splitlines()
                          if l.startswith("MemTotal")))
    except Exception:
        mem_kb = 0
    has_swap = "Swap" in Path("/proc/meminfo").read_text() and any(
        l.startswith("SwapTotal") and int(l.split()[1]) > 0
        for l in Path("/proc/meminfo").read_text().splitlines())
    if mem_kb and mem_kb < 2_000_000 and not has_swap and not Path("/swapfile").exists():
        run("fallocate -l 2G /swapfile || dd if=/dev/zero of=/swapfile bs=1M count=2048")
        run("chmod 600 /swapfile")
        run("mkswap /swapfile")
        run("swapon /swapfile")
        with open("/etc/fstab", "a") as f:
            f.write("/swapfile none swap sw 0 0\n")
        print("  added 2 GB swap")
    else:
        print("  swap already present or enough RAM — skipping")


# ── stage 3: env file / secrets ────────────────────────────────────────────
def resolve_env(deterministic: bool) -> None:
    log("3/8 secrets", f"Resolving API keys into {APP_DIR/'.env'} …")
    APP_DIR.mkdir(parents=True, exist_ok=True)
    target = APP_DIR / ".env"

    if target.exists() and not deterministic:
        print("  /opt/queuestorm/.env already exists — keeping it")
        return

    repo_env = REPO_ROOT / ".env"
    if repo_env.exists() and not deterministic:
        shutil.copy(repo_env, target)
        print(f"  copied {repo_env} -> {target}")
        return

    gemini = os.environ.get("GEMINI_API_KEY", "")
    openai = os.environ.get("OPENAI_API_KEY", "")
    use_llm = "false" if deterministic or not (gemini or openai) else "true"
    target.write_text(
        f"PORT={BACKEND_PORT}\n"
        "LOG_LEVEL=info\n"
        f"GEMINI_API_KEY={gemini}\n"
        f"GEMINI_MODEL={os.environ.get('GEMINI_MODEL', 'gemini-3.5-flash')}\n"
        f"OPENAI_API_KEY={openai}\n"
        f"OPENAI_MODEL={os.environ.get('OPENAI_MODEL', 'gpt-4o')}\n"
        "LLM_TIMEOUT_SECONDS=12\n"
        "REQUEST_BUDGET_SECONDS=25\n"
        f"USE_LLM={use_llm}\n"
    )
    os.chmod(target, 0o600)
    if use_llm == "false":
        print("  WARNING: no API keys supplied — running in deterministic (no-LLM) mode.")
        print("  The service is still fully functional and judgeable. Add keys to")
        print(f"  {target} and re-run to enable Gemini/OpenAI.")
    else:
        print(f"  wrote {target} from environment variables")


# ── stage 4: backend container ─────────────────────────────────────────────
def build_run_backend() -> None:
    log("4/8 backend", "Building and starting the API container …")
    run(["docker", "build", "-t", API_IMAGE, str(REPO_ROOT / "backend")])
    run(["docker", "rm", "-f", API_CONTAINER], check=False, quiet=True)
    run([
        "docker", "run", "-d", "--name", API_CONTAINER, "--restart", "unless-stopped",
        "--env-file", str(APP_DIR / ".env"),
        "-e", f"PORT={BACKEND_PORT}",
        "-p", f"127.0.0.1:{BACKEND_PORT}:{BACKEND_PORT}",
        API_IMAGE,
    ])


# ── stage 5: frontend build + static deploy ────────────────────────────────
def build_frontend() -> None:
    log("5/8 frontend", "Building the React app and publishing static files …")
    run(["docker", "build", "--target", "build", "-t", FE_BUILD_IMAGE,
         str(REPO_ROOT / "frontend")])
    run(["docker", "rm", "-f", "qs-fe-extract"], check=False, quiet=True)
    run(["docker", "create", "--name", "qs-fe-extract", FE_BUILD_IMAGE])
    WEB_ROOT.mkdir(parents=True, exist_ok=True)
    # Clear old assets, copy fresh dist.
    for child in WEB_ROOT.glob("*"):
        if child.is_dir():
            shutil.rmtree(child)
        else:
            child.unlink()
    run(f"docker cp qs-fe-extract:/app/dist/. {WEB_ROOT}/")
    run(["docker", "rm", "-f", "qs-fe-extract"], check=False, quiet=True)
    run(f"chown -R www-data:www-data {WEB_ROOT}", check=False)


# ── stage 6: nginx site ────────────────────────────────────────────────────
def configure_nginx() -> None:
    log("6/8 nginx", "Installing the nginx site config …")
    template = (REPO_ROOT / "deploy" / "nginx" / "queuestorm.conf.template").read_text()
    conf = template.replace("__DOMAIN__", DOMAIN)
    site = Path("/etc/nginx/sites-available/queuestorm.conf")
    site.write_text(conf)
    link = Path("/etc/nginx/sites-enabled/queuestorm.conf")
    if link.exists() or link.is_symlink():
        link.unlink()
    link.symlink_to(site)
    default = Path("/etc/nginx/sites-enabled/default")
    if default.exists() or default.is_symlink():
        default.unlink()
    run("nginx -t")
    run("systemctl reload nginx")


# ── stage 7: TLS ───────────────────────────────────────────────────────────
def public_ip() -> str:
    try:
        out = subprocess.run(
            ["curl", "-s", "-H", "Metadata-Flavor: Google",
             "http://metadata.google.internal/computeMetadata/v1/instance/"
             "network-interfaces/0/access-configs/0/external-ip"],
            capture_output=True, text=True, timeout=5).stdout.strip()
        if out:
            return out
    except Exception:
        pass
    try:
        return subprocess.run(["curl", "-s", "https://ifconfig.me"],
                              capture_output=True, text=True, timeout=5).stdout.strip()
    except Exception:
        return ""


def setup_tls(skip: bool) -> None:
    log("7/8 https", "Obtaining a Let's Encrypt certificate …")
    if skip:
        print("  --skip-tls set — leaving HTTP only.")
        return
    try:
        resolved = socket.gethostbyname(DOMAIN)
    except socket.gaierror:
        resolved = ""
    vm_ip = public_ip()
    print(f"  {DOMAIN} resolves to {resolved or '???'}; this VM public IP is {vm_ip or '???'}")
    if resolved and vm_ip and resolved != vm_ip:
        print("  DNS does not point here yet. Add an A record:")
        print(f"      {DOMAIN}   A   {vm_ip}")
        print("  then re-run this script (HTTP stays live meanwhile).")
        return
    ok = run_ok(
        f"certbot --nginx -d {DOMAIN} --non-interactive --agree-tos -m {EMAIL} "
        f"--redirect --keep-until-expiring")
    if ok:
        print(f"  HTTPS enabled for https://{DOMAIN}")
    else:
        print("  certbot did not complete (DNS/propagation?). HTTP remains live; re-run later.")


# ── stage 8: verify ────────────────────────────────────────────────────────
def verify() -> None:
    log("8/8 verify", "Checking /health …")
    for _ in range(30):
        if run_ok(f"curl -fsS http://127.0.0.1:{BACKEND_PORT}/health"):
            print("\n  Backend /health = ok")
            break
        time.sleep(2)
    else:
        print("  WARNING: backend /health did not respond. Check: docker logs queuestorm-api")
        return
    run_ok("curl -fsS http://127.0.0.1/health")
    scheme = "https" if Path(f"/etc/letsencrypt/live/{DOMAIN}").exists() else "http"
    print("\n" + "=" * 64)
    print("  QueueStorm is deployed.")
    print(f"    Health : {scheme}://{DOMAIN}/health")
    print(f"    API    : {scheme}://{DOMAIN}/analyze-ticket   (POST)")
    print(f"    Console: {scheme}://{DOMAIN}/")
    print("=" * 64)


def main() -> None:
    ap = argparse.ArgumentParser(description="Deploy QueueStorm on a VM.")
    ap.add_argument("--skip-tls", action="store_true", help="HTTP only, skip certbot")
    ap.add_argument("--deterministic", action="store_true", help="force no-LLM mode")
    ap.add_argument("--no-frontend", action="store_true", help="API only, skip the SPA build")
    args = ap.parse_args()

    require_root()
    print(f"Deploying QueueStorm to {DOMAIN} (repo: {REPO_ROOT})")
    install_packages()
    ensure_swap()
    resolve_env(args.deterministic)
    build_run_backend()
    if not args.no_frontend:
        build_frontend()
    configure_nginx()
    setup_tls(args.skip_tls)
    verify()


if __name__ == "__main__":
    main()
