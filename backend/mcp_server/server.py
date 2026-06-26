"""Akash MCP server.

Exposes the investigator's tools over the Model Context Protocol (stdio) so any
MCP-compatible client (IDE agents, desktop assistants, custom orchestrators) can:

  * lookup_transactions  — filter a transaction history
  * match_transaction    — find the transaction a complaint refers to + verdict
  * classify_case        — full case_type / severity / department / escalation
  * check_safety         — audit a reply for the three safety penalties

These are the SAME functions the in-process agent uses (app/tools.py), so the
copilot's capability set is genuinely reusable by external agents — that is the
"implementing MCP" agentic feature.

Run:  python -m mcp_server.server      (after `pip install mcp`)
"""
from __future__ import annotations

import asyncio
import json
import sys

# Make `app` importable whether run as a module or a script.
try:
    from app.tools import TOOL_IMPL, TOOL_SCHEMAS
except ModuleNotFoundError:  # pragma: no cover
    import os
    sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
    from app.tools import TOOL_IMPL, TOOL_SCHEMAS


async def _amain() -> None:
    try:
        from mcp.server import Server
        from mcp.server.stdio import stdio_server
        import mcp.types as types
    except ModuleNotFoundError:
        print("The 'mcp' package is required: pip install mcp", file=sys.stderr)
        raise SystemExit(1)

    server = Server("akash-investigator")

    @server.list_tools()
    async def list_tools() -> list:  # type: ignore[no-redef]
        return [
            types.Tool(
                name=t["name"],
                description=t["description"],
                inputSchema=t["inputSchema"],
            )
            for t in TOOL_SCHEMAS
        ]

    @server.call_tool()
    async def call_tool(name: str, arguments: dict) -> list:  # type: ignore[no-redef]
        impl = TOOL_IMPL.get(name)
        if impl is None:
            return [types.TextContent(type="text", text=json.dumps({"error": f"unknown tool {name}"}))]
        try:
            result = impl(**(arguments or {}))
        except Exception as exc:  # noqa: BLE001
            result = {"error": f"{type(exc).__name__}: {exc}"}
        return [types.TextContent(type="text", text=json.dumps(result, ensure_ascii=False))]

    async with stdio_server() as (read, write):
        await server.run(read, write, server.create_initialization_options())


if __name__ == "__main__":
    asyncio.run(_amain())
