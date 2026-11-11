"""Offline tests: run with  AIOS_FAKE=1 python -m unittest  (no API key or credits needed)."""
import json
import os
import subprocess
import sys
import unittest
from pathlib import Path

os.environ["AIOS_FAKE"] = "1"
ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT))

from aios import core  # noqa: E402
import collaborate  # noqa: E402


class Pipeline(unittest.TestCase):
    def test_context_loads_all_shared_files(self):
        ctx = core.read_context()
        for name in core.CONTEXT_FILES:
            self.assertIn(name, ctx)

    def test_full_loop_writes_report_and_audit_log(self):
        out = collaborate.run("Plan a CE driver recruitment funnel", rounds=2)
        text = out.read_text(encoding="utf-8")
        for section in ("ChatGPT plan", "Claude review", "Final recommendation"):
            self.assertIn(section, text)
        self.assertTrue((core.REPORTS / "latest_report.md").exists())
        log = next(core.LOGS.glob("*.jsonl")).read_text(encoding="utf-8").splitlines()
        kinds = [json.loads(l)["kind"] for l in log]
        self.assertIn("gpt", kinds)
        self.assertIn("claude", kinds)

    def test_budget_guard_blocks_when_over_limit(self):
        os.environ["AIOS_DAILY_TOKEN_LIMIT"] = "10"
        core.log_event("gpt", tokens=50)
        old = core.FAKE
        core.FAKE = False
        try:
            with self.assertRaises(core.BudgetExceeded):
                core.ask_gpt("hi")
        finally:
            core.FAKE = old
            del os.environ["AIOS_DAILY_TOKEN_LIMIT"]

    def test_mcp_server_exposes_ask_chatgpt(self):
        import asyncio
        import gpt_mcp_server
        tools = asyncio.run(gpt_mcp_server.mcp.list_tools())
        self.assertEqual([t.name for t in tools], ["ask_chatgpt"])
        self.assertIn("FAKE GPT", gpt_mcp_server.ask_chatgpt("test"))


if __name__ == "__main__":
    unittest.main()
