"""Shared plumbing: context loading, the two model calls, audit log, budget guard."""
import json
import os
import shutil
import subprocess
import time
from datetime import date, datetime
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
SHARED = ROOT / "shared"
LOGS = ROOT / "logs"
REPORTS = ROOT / "reports"

CONTEXT_FILES = ["MASTER_CONTEXT.md", "RULES.md", "BUSINESS_CONTEXT.md", "DECISIONS.md"]

# AIOS_FAKE=1 replaces both models with canned replies: used by the tests and
# for trying the pipeline before you have an API key.
FAKE = os.getenv("AIOS_FAKE") == "1"


def read_context() -> str:
    parts = []
    for name in CONTEXT_FILES:
        f = SHARED / name
        if f.exists():
            parts.append(f"--- {name} ---\n{f.read_text(encoding='utf-8')}")
    return "\n\n".join(parts)


def log_event(kind: str, **data) -> None:
    """Append one JSON line per event to logs/YYYY-MM-DD.jsonl (the audit trail)."""
    LOGS.mkdir(exist_ok=True)
    rec = {"ts": datetime.now().isoformat(timespec="seconds"), "kind": kind, **data}
    with open(LOGS / f"{date.today()}.jsonl", "a", encoding="utf-8") as fh:
        fh.write(json.dumps(rec, ensure_ascii=False) + "\n")


def tokens_used_today() -> int:
    f = LOGS / f"{date.today()}.jsonl"
    if not f.exists():
        return 0
    total = 0
    for line in f.read_text(encoding="utf-8").splitlines():
        try:
            total += int(json.loads(line).get("tokens", 0))
        except (ValueError, json.JSONDecodeError):
            pass
    return total


class BudgetExceeded(RuntimeError):
    pass


def _check_budget() -> None:
    limit = int(os.getenv("AIOS_DAILY_TOKEN_LIMIT", "200000"))
    used = tokens_used_today()
    if used >= limit:
        raise BudgetExceeded(
            f"Daily OpenAI token limit reached ({used}/{limit}). "
            "Raise AIOS_DAILY_TOKEN_LIMIT if this is intended."
        )


def ask_gpt(prompt: str, role: str = "strategist") -> str:
    """Call the OpenAI Responses API with the shared context as instructions."""
    if FAKE:
        out = f"[FAKE GPT {role}] response to: {prompt[:60]}"
        log_event("gpt", role=role, tokens=0, fake=True, chars=len(out))
        return out
    _check_budget()
    from openai import OpenAI

    model = os.getenv("OPENAI_MODEL")
    if not model:
        raise RuntimeError("OPENAI_MODEL is not set. Run: python doctor.py  (it lists your models)")
    client = OpenAI()
    t0 = time.time()
    resp = client.responses.create(
        model=model,
        instructions=(
            f"You are the {role} in a two-AI team (you = OpenAI model, partner = Claude). "
            "Be factual, concise and critical. Say clearly when you are unsure. "
            "Never invent facts, prices, laws or sources.\n\n" + read_context()
        ),
        input=prompt,
    )
    usage = getattr(resp, "usage", None)
    tokens = getattr(usage, "total_tokens", 0) if usage else 0
    log_event("gpt", role=role, model=model, tokens=tokens, secs=round(time.time() - t0, 1))
    return resp.output_text


def ask_claude(prompt: str, role: str = "reviewer") -> str:
    """Call Claude Code headless (`claude -p`) using your existing Claude login.

    Runs in plan (read-only) permission mode so a review can never edit files or
    run commands. The prompt goes in on stdin to avoid Windows' command-line
    length limit.
    """
    if FAKE:
        out = f"[FAKE CLAUDE {role}] review of: {prompt[:60]}"
        log_event("claude", role=role, fake=True, chars=len(out))
        return out
    exe = shutil.which("claude")
    if not exe:
        raise RuntimeError("Claude Code CLI not found. Install it and reopen PowerShell.")
    t0 = time.time()
    proc = subprocess.run(
        [exe, "-p", f"You are the {role}. Follow the instructions in the input.",
         "--permission-mode", "plan", "--output-format", "text"],
        input=prompt, capture_output=True, text=True, encoding="utf-8",
        cwd=ROOT, timeout=int(os.getenv("AIOS_CLAUDE_TIMEOUT", "600")),
    )
    if proc.returncode != 0:
        log_event("claude_error", role=role, stderr=proc.stderr[-500:])
        raise RuntimeError(f"claude -p failed: {proc.stderr.strip()[-500:]}")
    log_event("claude", role=role, secs=round(time.time() - t0, 1), chars=len(proc.stdout))
    return proc.stdout.strip()
