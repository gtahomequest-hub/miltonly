# scripts/scheduled-sync-wrapper.ps1
#
# The thing Windows Task Scheduler actually runs. Handles:
#   - cd to project root so .env.local is found
#   - writes a dated log under logs/sync-neon-to-local-YYYY-MM-DD.log
#   - rotates logs older than 30 days
#   - exits with the child process's exit code so Task Scheduler's
#     "Last Run Result" reflects real success/failure
#
# Called by the "Miltonly Neon Sync" scheduled task. Don't run this
# directly unless you want to simulate exactly what the task does.
#
# Log encoding: UTF-8 no BOM, consistent across header, body, and footer.
# (Windows PowerShell 5.1's built-in *>> redirect and Out-File -Encoding utf8
# use different encodings and produce mixed-encoding files when mixed; we
# sidestep that by capturing node's stdout/stderr to temp files and appending
# via System.IO.File.AppendAllText with an explicit UTF8Encoding($false).)

$ErrorActionPreference = 'Continue'

$ProjectRoot = Split-Path -Parent $PSScriptRoot
Set-Location $ProjectRoot

$LogDir = Join-Path $ProjectRoot 'logs'
if (-not (Test-Path $LogDir)) {
  New-Item -ItemType Directory -Path $LogDir -Force | Out-Null
}

$Today   = Get-Date -Format 'yyyy-MM-dd'
$LogFile = Join-Path $LogDir "sync-neon-to-local-$Today.log"

# --- 30-day log rotation -----------------------------------------------------
$Cutoff = (Get-Date).AddDays(-30)
Get-ChildItem -Path $LogDir -Filter 'sync-neon-to-local-*.log' -ErrorAction SilentlyContinue |
  Where-Object { $_.LastWriteTime -lt $Cutoff } |
  Remove-Item -Force -ErrorAction SilentlyContinue

# --- locate node.exe ---------------------------------------------------------
$NodePath = $null
$cmd = Get-Command node.exe -ErrorAction SilentlyContinue
if ($cmd) { $NodePath = $cmd.Source }
if (-not $NodePath -and (Test-Path 'C:\Program Files\nodejs\node.exe')) {
  $NodePath = 'C:\Program Files\nodejs\node.exe'
}

# --- log helpers (UTF-8 no BOM) ---------------------------------------------
$Utf8NoBom = New-Object System.Text.UTF8Encoding $false
function Append-LogLine($text) {
  [System.IO.File]::AppendAllText($LogFile, "$text`r`n", $Utf8NoBom)
}
function Append-LogText($text) {
  [System.IO.File]::AppendAllText($LogFile, $text, $Utf8NoBom)
}

if (-not $NodePath) {
  Append-LogLine "[$(Get-Date -Format o)] FATAL: node.exe not found on PATH or at C:\Program Files\nodejs\node.exe"
  exit 127
}

Append-LogLine "=== Started $(Get-Date -Format o) (host=$env:COMPUTERNAME user=$env:USERNAME node=$NodePath) ==="

# --- run node, capture stdout/stderr to temp files --------------------------
$StdoutTmp = [System.IO.Path]::GetTempFileName()
$StderrTmp = [System.IO.Path]::GetTempFileName()
$ExitCode = 1
try {
  $proc = Start-Process `
    -FilePath $NodePath `
    -ArgumentList 'scripts\sync-neon-to-local.mjs' `
    -WorkingDirectory $ProjectRoot `
    -NoNewWindow -Wait -PassThru `
    -RedirectStandardOutput $StdoutTmp `
    -RedirectStandardError $StderrTmp
  $ExitCode = $proc.ExitCode

  # Append stdout as-is (already UTF-8 from Node).
  $stdoutContent = [System.IO.File]::ReadAllText($StdoutTmp, [System.Text.Encoding]::UTF8)
  Append-LogText $stdoutContent

  $stderrContent = [System.IO.File]::ReadAllText($StderrTmp, [System.Text.Encoding]::UTF8)
  if ($stderrContent.Trim().Length -gt 0) {
    Append-LogLine ""
    Append-LogLine "--- stderr ---"
    Append-LogText $stderrContent
  }
} catch {
  Append-LogLine "[$(Get-Date -Format o)] WRAPPER EXCEPTION: $($_.Exception.Message)"
  $ExitCode = 1
} finally {
  Remove-Item $StdoutTmp, $StderrTmp -Force -ErrorAction SilentlyContinue
}

Append-LogLine "=== Finished $(Get-Date -Format o) (exit=$ExitCode) ==="
exit $ExitCode
