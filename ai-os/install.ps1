# AI-OS installer for Windows. Run from this folder:
#   powershell -ExecutionPolicy Bypass -File .\install.ps1
# Safe to re-run: every step checks first.
$ErrorActionPreference = "Stop"
Set-Location $PSScriptRoot

function Refresh-Path {
  $env:Path = [Environment]::GetEnvironmentVariable("Path","Machine") + ";" +
              [Environment]::GetEnvironmentVariable("Path","User")
}
function Ensure($cmd, $wingetId) {
  if (Get-Command $cmd -ErrorAction SilentlyContinue) { Write-Host "[OK] $cmd"; return }
  Write-Host "[..] Installing $wingetId"
  winget install --id $wingetId -e --accept-source-agreements --accept-package-agreements
  Refresh-Path
}

Write-Host "== 1. Prerequisites =="
Ensure git "Git.Git"
Ensure node "OpenJS.NodeJS.LTS"
# 'python' can be a Microsoft Store stub, so test that it really runs
$py = $null
foreach ($c in @("py -3", "python")) {
  try { $v = Invoke-Expression "$c --version" 2>$null; if ($v -match "Python 3\.(1[0-9])") { $py = $c; break } } catch {}
}
if (-not $py) {
  winget install --id Python.Python.3.12 -e --accept-source-agreements --accept-package-agreements
  Refresh-Path; $py = "py -3"
}
Write-Host "[OK] python via '$py'"

Write-Host "== 2. Claude Code =="
if (-not (Get-Command claude -ErrorAction SilentlyContinue)) {
  Invoke-RestMethod https://claude.ai/install.ps1 | Invoke-Expression
  $env:Path += ";$env:USERPROFILE\.local\bin"
}
claude --version

Write-Host "== 3. Python environment =="
Set-ExecutionPolicy -Scope CurrentUser -ExecutionPolicy RemoteSigned -Force
if (-not (Test-Path .venv)) { Invoke-Expression "$py -m venv .venv" }
& .\.venv\Scripts\python.exe -m pip install --upgrade pip -q
& .\.venv\Scripts\python.exe -m pip install -r requirements.txt -q
Write-Host "[OK] packages installed"

Write-Host "== 4. OpenAI API key =="
if (-not [Environment]::GetEnvironmentVariable("OPENAI_API_KEY","User")) {
  $sec = Read-Host "Paste your OpenAI API key (input hidden)" -AsSecureString
  $key = [Runtime.InteropServices.Marshal]::PtrToStringAuto(
           [Runtime.InteropServices.Marshal]::SecureStringToBSTR($sec))
  [Environment]::SetEnvironmentVariable("OPENAI_API_KEY", $key, "User")
  $env:OPENAI_API_KEY = $key
  Write-Host "[OK] key saved to your user environment (not to any file)"
} else { $env:OPENAI_API_KEY = [Environment]::GetEnvironmentVariable("OPENAI_API_KEY","User"); Write-Host "[OK] key already set" }
if (-not [Environment]::GetEnvironmentVariable("AIOS_DAILY_TOKEN_LIMIT","User")) {
  [Environment]::SetEnvironmentVariable("AIOS_DAILY_TOKEN_LIMIT", "200000", "User")
}

Write-Host "== 5. Connect ChatGPT to Claude Code (MCP) =="
$pyExe = (Resolve-Path .\.venv\Scripts\python.exe).Path
$server = (Resolve-Path .\gpt_mcp_server.py).Path
$mcp = @{ mcpServers = @{ chatgpt = @{ command = $pyExe; args = @($server) } } }
$mcp | ConvertTo-Json -Depth 5 | Set-Content -Encoding utf8 .mcp.json
Write-Host "[OK] wrote .mcp.json"

Write-Host "== 6. Git =="
if (-not (Test-Path .git)) { git init -q; git add .; git commit -qm "AI-OS initial setup"; Write-Host "[OK] repo created" }

Write-Host "== 7. Health check =="
& .\.venv\Scripts\python.exe doctor.py
Write-Host "`nIf OPENAI_MODEL is FAIL: pick a model from the list above and run"
Write-Host '   setx OPENAI_MODEL "<model id>"   then open a NEW PowerShell window.'
