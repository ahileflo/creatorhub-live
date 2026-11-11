"""ChatGPT plans -> Claude reviews -> ChatGPT consolidates -> report on disk.

Usage:
  python collaborate.py "your task"
  python collaborate.py --file task.md
  python collaborate.py            (prompts you to type the task)

Nothing here sends email, posts, pays or deletes: output is a markdown report
that you read and approve.
"""
import argparse
import re
import sys
from datetime import datetime
from pathlib import Path

from aios.core import REPORTS, BudgetExceeded, ask_claude, ask_gpt, log_event, read_context


def run(task: str, rounds: int = 1) -> Path:
    print("1/3  ChatGPT is drafting the plan...")
    plan = ask_gpt(f"TASK:\n{task}\n\nWrite a concrete plan: steps, costs, risks, open questions.")

    review = ""
    for i in range(rounds):
        print(f"2/3  Claude is reviewing (round {i + 1}/{rounds})...")
        review = ask_claude(
            "Shared context of this workspace:\n" + read_context() +
            f"\n\nTASK:\n{task}\n\nPLAN FROM CHATGPT:\n{plan}\n\n"
            "Review this plan as an independent technical and legal-risk reviewer. "
            "List: (1) factual errors or unverifiable claims, (2) technical problems, "
            "(3) legal/financial/operational risks, (4) what you would change. Be specific."
        )
        if i + 1 < rounds:
            plan = ask_gpt(f"TASK:\n{task}\n\nYOUR PLAN:\n{plan}\n\nREVIEW:\n{review}\n\nRevise the plan.")

    print("3/3  ChatGPT is consolidating...")
    final = ask_gpt(
        f"TASK:\n{task}\n\nPLAN:\n{plan}\n\nCLAUDE'S REVIEW:\n{review}\n\n"
        "Produce the final recommendation. Accept or reject each review point with a reason. "
        "End with 'NEXT ACTIONS NEEDING APPROVAL' as a numbered list.",
        role="consolidator",
    )

    REPORTS.mkdir(exist_ok=True)
    slug = re.sub(r"[^a-z0-9]+", "-", task.lower())[:40].strip("-") or "task"
    out = REPORTS / f"{datetime.now():%Y%m%d-%H%M}-{slug}.md"
    out.write_text(
        f"# {task.splitlines()[0][:100]}\n\n## Task\n{task}\n\n## ChatGPT plan\n{plan}\n\n"
        f"## Claude review\n{review}\n\n## Final recommendation\n{final}\n",
        encoding="utf-8",
    )
    (REPORTS / "latest_report.md").write_text(out.read_text(encoding="utf-8"), encoding="utf-8")
    log_event("report", path=str(out.name))
    return out


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("task", nargs="?")
    ap.add_argument("--file")
    ap.add_argument("--rounds", type=int, default=1, help="review/revise rounds (cost grows per round)")
    a = ap.parse_args()
    task = Path(a.file).read_text(encoding="utf-8") if a.file else a.task
    if not task:
        task = input("Task: ").strip()
    if not task:
        print("No task given.")
        return 1
    try:
        out = run(task, a.rounds)
    except BudgetExceeded as e:
        print(f"STOPPED: {e}")
        return 2
    print(f"\nDone. Report: {out}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
