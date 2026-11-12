"""Tool registry: controlled backend functions the AI may call. Every number returned comes from
the database or deterministic Python — the model only explains it."""
from __future__ import annotations

import logging
from dataclasses import dataclass
from typing import Callable

from app.ai.provider import ToolSpec

log = logging.getLogger("fitai.tools")


@dataclass
class Tool:
    spec: ToolSpec
    fn: Callable  # fn(db, user, **args) -> dict


TOOLS: dict[str, Tool] = {}


def tool(name: str, description: str, properties: dict | None = None, required: list[str] | None = None):
    def deco(fn):
        TOOLS[name] = Tool(ToolSpec(name, description, {"type": "object", "properties": properties or {},
                                                        **({"required": required} if required else {})}), fn)
        return fn
    return deco


def tool_specs() -> list[ToolSpec]:
    _load()
    return [t.spec for t in TOOLS.values()]


def execute_tool(db, user, name: str, args: dict) -> dict:
    _load()
    t = TOOLS.get(name)
    if not t:
        return {"error": f"Unknown tool {name}"}
    allowed = set(t.spec.parameters.get("properties", {}))
    clean = {k: v for k, v in (args or {}).items() if k in allowed and v is not None}
    try:
        return t.fn(db, user, **clean)
    except (ValueError, TypeError) as e:
        return {"error": str(e)}
    except Exception:
        log.exception("Tool %s failed", name)
        return {"error": f"Tool {name} failed unexpectedly"}


def _load():
    if not TOOLS:
        from app.tools import fitness_tools, nutrition_tools, progress_tools, workout_tools  # noqa: F401
