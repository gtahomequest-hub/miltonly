# scripts/install-scheduled-task.ps1
#
# Installs / re-installs the "Miltonly Neon Sync" scheduled task.
#
# Behaviour:
#   - Self-elevates via UAC if not already admin.
#   - Unregisters the legacy "Oracle Daily Sync" task (supersedes it).
#   - Unregisters any prior "Miltonly Neon Sync" before re-registering
#     (idempotent re-install).
#   - Registers a new task with:
#       Trigger   : daily at 08:30 local time
#       Action    : powershell.exe -File scripts/scheduled-sync-wrapper.ps1
#       LogonType : S4U (runs whether user is logged on or not; no password
#                   stored; falls back to the user's SID at runtime)
#       WakeToRun : true (but won't wake if on battery, see below)
#       Battery   : default -- don't start on battery, stop if switched to
#                   battery mid-run
#       RestartOnFailure : 0 (per spec: don't retry, just log the failure)
#       TimeLimit : 1 hour (kills a runaway sync; a healthy full refresh is ~8-9m)
#       MultipleInstances : IgnoreNew (don't stack if previous is still running)
#
# Run (from project root):
#   powershell -NoProfile -ExecutionPolicy Bypass -File scripts\install-scheduled-task.ps1
#
# To uninstall:
#   powershell -NoProfile -ExecutionPolicy Bypass -File scripts\install-scheduled-task.ps1 -Uninstall

param(
  [switch]$Uninstall
)

$ErrorActionPreference = 'Stop'

$TaskName     = 'Miltonly Neon Sync'
$OldTaskName  = 'Oracle Daily Sync'
$TaskDescription = 'Daily Neon DB2 -> local prospect sync. Full enrichment (290 cols + media + rooms). One-way, never-delete, overwrite-on-update. Replaces "Oracle Daily Sync".'

# --- self-elevate -----------------------------------------------------------
$isAdmin = ([Security.Principal.WindowsPrincipal][Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)
if (-not $isAdmin) {
  Write-Host "Not running as admin. Relaunching elevated..."
  $argList = @('-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', $PSCommandPath)
  if ($Uninstall) { $argList += '-Uninstall' }
  try {
    Start-Process -FilePath 'powershell.exe' -ArgumentList $argList -Verb RunAs -Wait
  } catch {
    Write-Host "UAC was declined or elevation failed. Re-run this script from an Administrator PowerShell." -ForegroundColor Red
    exit 1
  }
  exit 0
}

$ProjectRoot = Split-Path -Parent $PSScriptRoot
$WrapperPath = Join-Path $PSScriptRoot 'scheduled-sync-wrapper.ps1'

if (-not (Test-Path $WrapperPath)) {
  Write-Error "Wrapper not found: $WrapperPath"
  exit 1
}

# --- uninstall path ----------------------------------------------------------
if ($Uninstall) {
  $existing = Get-ScheduledTask -TaskName $TaskName -ErrorAction SilentlyContinue
  if ($existing) {
    Unregister-ScheduledTask -TaskName $TaskName -Confirm:$false
    Write-Host "Uninstalled task: $TaskName"
  } else {
    Write-Host "No task named '$TaskName' found - nothing to uninstall."
  }
  exit 0
}

# --- remove legacy Oracle Daily Sync (superseded by this) --------------------
$old = Get-ScheduledTask -TaskName $OldTaskName -ErrorAction SilentlyContinue
if ($old) {
  Write-Host "Removing legacy '$OldTaskName' (replaced by '$TaskName')..."
  Unregister-ScheduledTask -TaskName $OldTaskName -Confirm:$false
}

# --- idempotent: remove prior install of new task ---------------------------
$existing = Get-ScheduledTask -TaskName $TaskName -ErrorAction SilentlyContinue
if ($existing) {
  Write-Host "Re-registering '$TaskName'..."
  Unregister-ScheduledTask -TaskName $TaskName -Confirm:$false
}

# --- build task --------------------------------------------------------------
$Action = New-ScheduledTaskAction `
  -Execute 'powershell.exe' `
  -Argument ('-NoProfile -NonInteractive -ExecutionPolicy Bypass -File "{0}"' -f $WrapperPath) `
  -WorkingDirectory $ProjectRoot

# Daily at 08:30 local time. Task Scheduler tracks local time across DST.
$Trigger = New-ScheduledTaskTrigger -Daily -At '08:30'

# Battery defaults (no switches = DisallowStartIfOnBatteries + StopIfGoingOnBatteries).
# WakeToRun only actually wakes when on AC because of the battery settings.
$Settings = New-ScheduledTaskSettingsSet `
  -StartWhenAvailable `
  -WakeToRun `
  -RestartCount 0 `
  -ExecutionTimeLimit (New-TimeSpan -Hours 1) `
  -MultipleInstances IgnoreNew

# S4U: runs as this user, whether logged on or not, without storing password.
# The task inherits the user's SID-bound rights. Works for local accounts on
# non-domain machines as long as the account has "Log on as a batch job" --
# local Administrators have this by default.
$CurrentUser = if ($env:USERDOMAIN) { "$env:USERDOMAIN\$env:USERNAME" } else { $env:USERNAME }
$Principal = New-ScheduledTaskPrincipal -UserId $CurrentUser -LogonType S4U -RunLevel Limited

Register-ScheduledTask -TaskName $TaskName `
  -Action $Action `
  -Trigger $Trigger `
  -Settings $Settings `
  -Principal $Principal `
  -Description $TaskDescription | Out-Null

Write-Host ""
Write-Host "=== Task registered ==="
$task = Get-ScheduledTask -TaskName $TaskName
$info = Get-ScheduledTaskInfo -TaskName $TaskName
Write-Host "  Name          : $($task.TaskName)"
Write-Host "  State         : $($task.State)"
Write-Host "  RunsAs        : $($task.Principal.UserId) (LogonType=$($task.Principal.LogonType))"
Write-Host "  Next run      : $($info.NextRunTime)"
Write-Host "  Trigger       : $($task.Triggers[0].StartBoundary) (daily)"
Write-Host "  Action        : $($task.Actions[0].Execute) $($task.Actions[0].Arguments)"
Write-Host "  WorkingDir    : $($task.Actions[0].WorkingDirectory)"
Write-Host ""
Write-Host "To trigger a test run manually:"
Write-Host "  Start-ScheduledTask -TaskName '$TaskName'"
Write-Host ""
Write-Host "To see the most recent result:"
Write-Host "  Get-ScheduledTaskInfo -TaskName '$TaskName' | Format-List LastRunTime, LastTaskResult, NextRunTime"
Write-Host ""
Write-Host "Log file for today's run will be at:"
Write-Host "  $ProjectRoot\logs\sync-neon-to-local-$(Get-Date -Format 'yyyy-MM-dd').log"
