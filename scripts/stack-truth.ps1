# stack-truth.ps1 — ground-truth probe for Miltonly cold-start sessions
# Run from repo root: pwsh scripts/stack-truth.ps1
# Purpose: surface DB hostname (local + prod), recent commits, recent deploys,
# and conversion-path fire-site counts so a fresh Claude session can verify
# repo state vs. Notion docs (per HARD RULE: docs-vs-codebase priority).
# Created 2026-04-30 after a session where stale "DB1 Supabase" docs caused
# 30 min of misdirected debugging on a Neon-only stack.

$ErrorActionPreference = "Continue"
$sep = "=" * 55

function Get-DbHostname {
    param([string]$EnvFile)
    if (-not (Test-Path $EnvFile)) { return "(file not found)" }
    $line = Get-Content $EnvFile -ErrorAction SilentlyContinue |
        Where-Object { $_ -match '^\s*DATABASE_URL\s*=' } |
        Select-Object -First 1
    if (-not $line) { return "(DATABASE_URL not set)" }
    $value = $line -replace '^\s*DATABASE_URL\s*=\s*', '' `
                   -replace '^["'']', '' `
                   -replace '["'']\s*$', ''
    if ($value -match '@([^:/?]+)') { return $matches[1] }
    return "(could not parse hostname)"
}

# 1. Working directory + branch
Write-Output $sep
Write-Output "1. WORKING DIRECTORY + BRANCH"
Write-Output $sep
Write-Output ("pwd:    " + (Get-Location).Path)
Write-Output ("branch: " + (git rev-parse --abbrev-ref HEAD 2>$null))
Write-Output ("head:   " + (git log -1 --format="%h %s" 2>$null))
Write-Output ""

# 2. Last 3 commits
Write-Output $sep
Write-Output "2. LAST 3 COMMITS"
Write-Output $sep
git log --oneline -3 2>$null
Write-Output ""

# 3. Local DATABASE_URL hostname
Write-Output $sep
Write-Output "3. LOCAL DATABASE_URL HOSTNAME"
Write-Output $sep
Write-Output (".env:       " + (Get-DbHostname ".env"))
Write-Output (".env.local: " + (Get-DbHostname ".env.local"))
Write-Output ""

# 4. Production DATABASE_URL hostname
Write-Output $sep
Write-Output "4. PRODUCTION DATABASE_URL HOSTNAME"
Write-Output $sep
$vercelCmd = Get-Command vercel -ErrorAction SilentlyContinue
if (-not $vercelCmd) {
    Write-Output "vercel CLI not installed - skipping prod check"
} else {
    $tmp = ".env.production.tmp"
    try {
        & vercel env pull $tmp --environment=production --yes *> $null
    } catch {
        # tolerate any vercel CLI failure
    }
    if (Test-Path $tmp) {
        Write-Output ("prod:       " + (Get-DbHostname $tmp))
        Remove-Item $tmp -Force
    } else {
        Write-Output "prod:       (vercel env pull produced no file)"
    }
}
Write-Output ""

# 5. Last 5 Vercel deploys
Write-Output $sep
Write-Output "5. LAST 5 VERCEL DEPLOYS"
Write-Output $sep
if (-not $vercelCmd) {
    Write-Output "vercel CLI not installed - skipping"
} else {
    # Vercel CLI emits a formatted table + a URL summary via different channels;
    # PS 5.1's pipeline captures them inconsistently. Filter to URL lines only
    # and cap at 5 — that's the actionable signal ("which deploys are recent").
    # 2>$null discards stderr cleanly (avoids PS 5.1's NativeCommandError wrap).
    $urls = & vercel ls --prod 2>$null |
        Where-Object { $_ -match 'https://miltonly-' } |
        Select-Object -First 5
    if ($urls) {
        $urls | ForEach-Object { Write-Output $_ }
    } else {
        Write-Output "(no production deploys found)"
    }
}
Write-Output ""

# 6. Conversion path fire-site count
Write-Output $sep
Write-Output "6. CONVERSION PATH FIRE-SITE COUNT"
Write-Output $sep
if (Test-Path "src") {
    $tsFiles = Get-ChildItem -Path "src" -Recurse -Include "*.ts", "*.tsx" `
        -ErrorAction SilentlyContinue
    $glCount = ($tsFiles | Select-String -Pattern "generate_lead" -SimpleMatch |
        Measure-Object).Count
    $awCount = ($tsFiles | Select-String -Pattern "AW_ID|NEXT_PUBLIC_AW_" |
        Measure-Object).Count
    Write-Output ("generate_lead fire sites: $glCount  |  AW- references: $awCount (should be 0 post-2026-04-30)")
} else {
    Write-Output "src/ not found - skipping"
}
Write-Output ""

# Always exit clean — sub-command failures are reported inline above; we don't
# want one slow-running tool's non-zero exit to make the whole probe look broken.
exit 0
