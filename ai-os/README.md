# AI-OS: ChatGPT + Claude Code on Windows

Two AIs share one workspace and check each other's work:

```
           shared/  (context, rules, decisions)  ← both read this on every call
              │
 ChatGPT (OpenAI API) ⇄ Claude Code (your Claude login)
   │                         │
   collaborate.py:           gpt_mcp_server.py:
   GPT plans → Claude        Claude Code gets an "ask_chatgpt"
   reviews → GPT decides     tool it can call while working
              │
   reports/  (results)   logs/  (audit trail: every call, tokens, time)
```

**What it costs:** Claude runs on your existing Claude subscription through `claude -p`. OpenAI API usage
is billed separately from a ChatGPT Plus subscription, so add about €5–10 of credit. A built-in daily token cap
(`AIOS_DAILY_TOKEN_LIMIT`, default 200,000) stops runaway spending.

**What it does *not* do:** it does not sync your ChatGPT app's chat history or memory. OpenAI offers no API for
that. Shared knowledge lives in `shared/*.md`. Paste anything worth keeping from ChatGPT into those files.

---

## Install (about 15 minutes)

### 1. Get the files
Open **PowerShell** (Start → type `powershell`). Then:

```powershell
winget install --id Git.Git -e
```
Close PowerShell and open a new window, then:
```powershell
git clone -b claude/eager-bardeen-ps03io https://github.com/ahileflo/creatorhub-live.git C:\AI-OS-src
Copy-Item C:\AI-OS-src\ai-os C:\AI-OS -Recurse
cd C:\AI-OS
```

### 2. Get an OpenAI API key
1. Go to https://platform.openai.com/api-keys and sign in.
2. **Settings → Billing**: add a small amount of credit, and set a monthly **usage limit** too.
3. **Create new secret key**, name it `AI-OS`, and copy it. The installer asks for it with hidden input.
   Never paste the key into chat or into a file.

### 3. Run the installer
```powershell
powershell -ExecutionPolicy Bypass -File .\install.ps1
```
The installer installs Git, Node.js, Python 3.12 and Claude Code if they're missing. It then creates the
Python environment and saves your key to your Windows user environment. It also connects ChatGPT to Claude
Code (`.mcp.json`), creates a git repo, and runs `doctor.py`.

### 4. Choose the OpenAI model
`doctor.py` prints the model IDs **your key** can use. Pick the current flagship from that list, then run:
```powershell
setx OPENAI_MODEL "<model id from the list>"
```
**Open a new PowerShell window.** `setx` only applies to new windows.

### 5. Sign in to Claude Code (one time)
```powershell
cd C:\AI-OS
claude
```
Sign in with your Claude account. When it asks whether to use the `chatgpt` MCP server from `.mcp.json`,
choose **Yes**. Type `/mcp` to check: **chatgpt** should show as connected. Type `/exit`.

### 6. Check everything
```powershell
cd C:\AI-OS
.\.venv\Scripts\Activate.ps1
python doctor.py
```
Every line should say `[OK]`.

---

## Use it

**A. ChatGPT plans → Claude reviews → ChatGPT decides**
```powershell
python collaborate.py "Design a lead-generation system for Romanian CE drivers seeking jobs in NL and BE. Include legal, operational and cost risks."
```
The result goes to `reports\latest_report.md`. Add `--rounds 2` for a second revise-and-review round (costs more).
Claude runs read-only during reviews: it cannot edit files or run commands there.

**B. Claude works and asks ChatGPT when useful.** Run `claude` in `C:\AI-OS`, then try:
- "Build a script that … , then ask ChatGPT to critique the approach."
- "Use the strategist agent to plan my DJ brand's next quarter."
- "Use the auditor agent to check reports/latest_report.md."

The three agents live in `.claude/agents/`: **strategist**, **developer** and **auditor**.

**C. Update shared knowledge.** Edit `shared/BUSINESS_CONTEXT.md` and `shared/DECISIONS.md`. Both AIs read
them on every call. Commit after changes: `git add . ; git commit -m "update context"`.

**D. Schedule it (optional)**. For example, a weekly review every Monday at 08:00:
```powershell
schtasks /Create /SC WEEKLY /D MON /ST 08:00 /TN "AI-OS weekly" /TR "C:\AI-OS\.venv\Scripts\python.exe C:\AI-OS\collaborate.py --file C:\AI-OS\shared\weekly_task.md"
```
Write the task you want run in `shared\weekly_task.md` first.

---

## Troubleshooting
| Problem | Fix |
|---|---|
| `running scripts is disabled` | `Set-ExecutionPolicy -Scope CurrentUser RemoteSigned` |
| `python` opens the Microsoft Store | Use `py -3`, or turn off the alias under Settings → Apps → App execution aliases |
| `claude` not found | Open a new PowerShell window. If it's still missing, rerun `irm https://claude.ai/install.ps1 \| iex` |
| `OPENAI_MODEL is not set` / key missing | You ran `setx` but didn't open a new window |
| OpenAI 401 / 429 errors | 401 means the key is wrong. 429 means no credit or the rate limit was hit: check Billing |
| `Daily OpenAI token limit reached` | The guard is working. Raise it with `setx AIOS_DAILY_TOKEN_LIMIT 500000` |
| `/mcp` shows chatgpt failed | Rerun `install.ps1`. It rewrites `.mcp.json` with the correct paths |

Test without spending credits: `$env:AIOS_FAKE="1"; python -m unittest discover -s tests -v`

## Security
- API keys live only in your Windows user environment and never in files. `.gitignore` also excludes `.env`.
- Don't put DigiD logins, bank passwords, customer personal data or employer-confidential documents in this folder.
- Every model call is logged to `logs\YYYY-MM-DD.jsonl`.
