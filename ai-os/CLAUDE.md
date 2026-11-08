# AI-OS: instructions for Claude Code

@shared/MASTER_CONTEXT.md
@shared/RULES.md
@shared/BUSINESS_CONTEXT.md
@shared/DECISIONS.md

## Working with ChatGPT
- You have an MCP tool `ask_chatgpt` (server "chatgpt"). Use it for a second opinion on plans,
  strategy or research angles, or when the user says "ask ChatGPT". Each call costs API credits:
  one or two calls per task, never in loops.
- When ChatGPT and you disagree, show both positions and your recommendation; the user decides.
- Reports from `collaborate.py` land in reports/. Proposed changes to shared/ go to the user first.
