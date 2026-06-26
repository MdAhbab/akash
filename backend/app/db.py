"""Optional MySQL durability layer.

DESIGN PRINCIPLE: the database is a *durable mirror*, never a dependency of the
judged endpoints. The in-memory store (``app/store.py``) remains the fast,
authoritative path for ``/health`` and ``/analyze-ticket``. MySQL only:

  * loads the most recent rows back into memory on startup (so the dashboard
    survives a restart) and
  * receives best-effort, background INSERTs after each analysis.

If MySQL is unconfigured, unreachable, or the driver is missing, the service
runs exactly as before - fully functional and judgeable. A DB outage can never
slow down or fail a ticket analysis.

Enabled when ``DB_BACKEND=mysql`` and a host is configured.
"""
from __future__ import annotations

import asyncio
import json
import logging
from typing import Any, Optional

from .config import get_settings

log = logging.getLogger("akash.db")

try:
    import pymysql  # type: ignore
    _HAS_DRIVER = True
except ModuleNotFoundError:  # pragma: no cover
    pymysql = None  # type: ignore
    _HAS_DRIVER = False

_DDL = """
CREATE TABLE IF NOT EXISTS tickets (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  ticket_id VARCHAR(190),
  case_type VARCHAR(64),
  severity VARCHAR(32),
  department VARCHAR(64),
  evidence_verdict VARCHAR(32),
  relevant_transaction_id VARCHAR(190),
  human_review_required TINYINT(1),
  confidence FLOAT,
  language VARCHAR(16),
  channel VARCHAR(32),
  user_type VARCHAR(32),
  provider VARCHAR(96),
  latency_ms FLOAT,
  agent_summary TEXT,
  customer_reply TEXT,
  recommended_next_action TEXT,
  reason_codes TEXT,
  complaint TEXT,
  created_at VARCHAR(40),
  INDEX idx_ticket (ticket_id),
  INDEX idx_created (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
"""

_INSERT = """
INSERT INTO tickets
 (ticket_id, case_type, severity, department, evidence_verdict,
  relevant_transaction_id, human_review_required, confidence, language, channel,
  user_type, provider, latency_ms, agent_summary, customer_reply,
  recommended_next_action, reason_codes, complaint, created_at)
VALUES (%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s)
"""

_SELECT_RECENT = """
SELECT ticket_id, case_type, severity, department, evidence_verdict,
       relevant_transaction_id, human_review_required, confidence, language,
       channel, user_type, provider, latency_ms, agent_summary, customer_reply,
       recommended_next_action, reason_codes, complaint, created_at
FROM tickets ORDER BY id DESC LIMIT %s
"""


class Database:
    def __init__(self) -> None:
        self._ready = False

    @property
    def enabled(self) -> bool:
        s = get_settings()
        return _HAS_DRIVER and s.db_backend == "mysql" and bool(s.mysql_host)

    def _connect(self):
        s = get_settings()
        return pymysql.connect(
            host=s.mysql_host, port=s.mysql_port, user=s.mysql_user,
            password=s.mysql_password, database=s.mysql_db,
            charset="utf8mb4", autocommit=True, connect_timeout=5,
            read_timeout=5, write_timeout=5,
        )

    # ── lifecycle ─────────────────────────────────────────────────────────
    def init(self) -> bool:
        if not self.enabled:
            log.info("MySQL durability disabled (memory-only mode).")
            return False
        try:
            conn = self._connect()
            with conn.cursor() as cur:
                cur.execute(_DDL)
            conn.close()
            self._ready = True
            log.info("MySQL durability enabled.")
            return True
        except Exception as exc:  # noqa: BLE001
            log.warning("MySQL init failed (%s) - continuing memory-only.", type(exc).__name__)
            self._ready = False
            return False

    def load_recent(self, limit: int = 200) -> list[dict[str, Any]]:
        if not (self.enabled and self._ready):
            return []
        try:
            conn = self._connect()
            with conn.cursor() as cur:
                cur.execute(_SELECT_RECENT, (limit,))
                cols = [c[0] for c in cur.description]
                rows = [dict(zip(cols, r)) for r in cur.fetchall()]
            conn.close()
            for r in rows:
                r["human_review_required"] = bool(r.get("human_review_required"))
                rc = r.get("reason_codes")
                try:
                    r["reason_codes"] = json.loads(rc) if rc else []
                except (json.JSONDecodeError, TypeError):
                    r["reason_codes"] = []
            return list(reversed(rows))  # oldest first → store prepends newest
        except Exception as exc:  # noqa: BLE001
            log.warning("MySQL load_recent failed: %s", type(exc).__name__)
            return []

    # ── writes (best effort, off the request path) ────────────────────────
    def _insert_sync(self, item: dict[str, Any]) -> None:
        conn = self._connect()
        try:
            with conn.cursor() as cur:
                cur.execute(_INSERT, (
                    item.get("ticket_id"), item.get("case_type"), item.get("severity"),
                    item.get("department"), item.get("evidence_verdict"),
                    item.get("relevant_transaction_id"),
                    1 if item.get("human_review_required") else 0,
                    item.get("confidence"), item.get("language"), item.get("channel"),
                    item.get("user_type"), item.get("provider"), item.get("latency_ms"),
                    item.get("agent_summary"), item.get("customer_reply"),
                    item.get("recommended_next_action"),
                    json.dumps(item.get("reason_codes") or [], ensure_ascii=False),
                    item.get("complaint"), item.get("created_at"),
                ))
        finally:
            conn.close()

    async def insert_async(self, item: dict[str, Any]) -> None:
        if not (self.enabled and self._ready):
            return
        try:
            await asyncio.to_thread(self._insert_sync, item)
        except Exception as exc:  # noqa: BLE001
            log.warning("MySQL insert failed: %s", type(exc).__name__)


db = Database()
