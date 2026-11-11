"""Checks every piece of the setup and tells you exactly what's missing."""
import os
import shutil
import subprocess
import sys

ok = True


def check(name, passed, fix=""):
    global ok
    print(f"[{'OK ' if passed else 'FAIL'}] {name}" + ("" if passed else f"\n       -> {fix}"))
    ok &= bool(passed)


check("Python 3.10+", sys.version_info >= (3, 10), "Install Python 3.12: winget install Python.Python.3.12")
check("In the .venv", sys.prefix != sys.base_prefix, r"Run: .\.venv\Scripts\Activate.ps1")
for mod in ("openai", "mcp"):
    try:
        __import__(mod)
        check(f"package '{mod}'", True)
    except ImportError:
        check(f"package '{mod}'", False, "Run: pip install -r requirements.txt")
check("git", shutil.which("git"), "winget install Git.Git")
claude = shutil.which("claude")
check("Claude Code CLI", claude, "irm https://claude.ai/install.ps1 | iex   (then reopen PowerShell)")
if claude:
    v = subprocess.run([claude, "--version"], capture_output=True, text=True)
    print(f"       version: {v.stdout.strip()}")

key = os.getenv("OPENAI_API_KEY")
check("OPENAI_API_KEY set", key, 'setx OPENAI_API_KEY "sk-..."   (then reopen PowerShell)')
if key:
    try:
        from openai import OpenAI
        ids = sorted(m.id for m in OpenAI().models.list())
        check("OpenAI key works", True)
        chat = [i for i in ids if i.startswith(("gpt", "o")) and "audio" not in i and "realtime" not in i]
        print("       models your key can use (pick one for OPENAI_MODEL):")
        for i in chat[-15:]:
            print("         ", i)
    except Exception as e:
        check("OpenAI key works", False, f"{e}")
model = os.getenv("OPENAI_MODEL")
check("OPENAI_MODEL set", model, 'setx OPENAI_MODEL "<a model id from the list above>"')

print("\nAll good. Next: python collaborate.py" if ok else "\nFix the FAIL lines, then run doctor again.")
sys.exit(0 if ok else 1)
