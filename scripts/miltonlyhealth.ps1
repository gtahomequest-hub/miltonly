<#
.SYNOPSIS
    Miltonly.com 12-point production health audit.

.DESCRIPTION
    Performs a comprehensive health check of the miltonly.com production environment:

      1.  Production URL availability    — HEAD 6 endpoints, expect HTTP 200
      2.  Required environment variables — vercel env pull, validate 9 keys
      3.  ISR cache health               — X-Vercel-Cache header on street page
      4.  Database state                 — StreetContent published/draft/failed counts
      5.  Lead pipeline                  — Lead model 24h/7d activity
      6.  Deployment freshness           — Age of last Vercel production deploy
      7.  Function error rate            — 5xx count in last 24h of vercel logs
      8.  OG image health                — /opengraph-image returns image/* content
      9.  Meta Pixel install             — Pixel ID present in homepage HTML
     10.  Cache-Control sanity           — No no-cache/no-store on key routes
     11.  Static asset 404 sweep         — All link/script/img assets resolve
     12.  Vercel runtime drift          — Node version + ISR prerender sanity

    Runtime:  ~15-25 seconds (network-dependent)
    Timeout:  15 seconds max per external command
    Modules:  None required (pure PowerShell 5.1+)

    Exit codes:
      0 — all checks PASS, WARN, or SKIP
      1 — one or more checks FAIL

    Safe to call via & operator from a $PROFILE function.
    If dot-sourced, uses return instead of exit to avoid killing the shell.

.EXAMPLE
    & "C:\Users\inspe\miltonly\scripts\miltonlyhealth.ps1"

.EXAMPLE
    function miltonlyhealth { & "C:\Users\inspe\miltonly\scripts\miltonlyhealth.ps1" }
    miltonlyhealth
#>

[CmdletBinding()]
param()

# ── Bootstrap ────────────────────────────────────────────────────────────────

# TLS 1.2 (required on PS 5.1 for HTTPS)
try { [Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12 } catch { }

# UTF-8 output for Unicode symbols
try {
    [Console]::OutputEncoding = [System.Text.Encoding]::UTF8
    $OutputEncoding = [System.Text.Encoding]::UTF8
} catch { }

$script:ProjectRoot = 'C:\Users\inspe\miltonly'
$script:BaseUrl     = 'https://www.miltonly.com'
$script:results     = @{ passed = 0; warned = 0; failed = 0; skipped = 0 }
$script:cachedHomepage = $null

#region Helpers ────────────────────────────────────────────────────────────────

function Write-CheckResult {
    param(
        [int]$Number,
        [string]$Status,
        [string]$Name,
        [string]$Detail
    )

    switch ($Status) {
        'PASS' { $icon = [char]0x2713; $color = 'Green'  }
        'WARN' { $icon = [char]0x26A0; $color = 'Yellow' }
        'FAIL' { $icon = [char]0x2717; $color = 'Red'    }
        'SKIP' { $icon = [char]0x23ED; $color = 'Gray'   }
        default { $icon = '?';         $color = 'White'  }
    }

    $prefix = '  [{0,2}/12]' -f $Number
    $padded = $Name.PadRight(30)

    Write-Host $prefix -NoNewline -ForegroundColor White
    Write-Host " $icon " -NoNewline -ForegroundColor $color
    Write-Host $padded -NoNewline -ForegroundColor White
    Write-Host $Detail -ForegroundColor $color

    switch ($Status) {
        'PASS' { $script:results.passed++  }
        'WARN' { $script:results.warned++  }
        'FAIL' { $script:results.failed++  }
        'SKIP' { $script:results.skipped++ }
    }
}

function Invoke-WithTimeout {
    param(
        [Parameter(Mandatory)]
        [string]$Command,
        [int]$TimeoutSeconds = 15
    )

    $psi = New-Object System.Diagnostics.ProcessStartInfo
    $psi.FileName        = 'cmd.exe'
    $psi.Arguments       = "/c $Command 2>&1"
    $psi.RedirectStandardOutput = $true
    $psi.RedirectStandardError  = $true
    $psi.UseShellExecute  = $false
    $psi.CreateNoWindow   = $true
    $psi.WorkingDirectory = $script:ProjectRoot

    $process = $null
    try {
        $process = [System.Diagnostics.Process]::Start($psi)
        $stdoutTask = $process.StandardOutput.ReadToEndAsync()
        $stderrTask = $process.StandardError.ReadToEndAsync()

        if (-not $process.WaitForExit($TimeoutSeconds * 1000)) {
            try { $process.Kill() } catch { }
            return @{ TimedOut = $true; ExitCode = -1; Stdout = ''; Stderr = 'Timeout' }
        }

        $stdout = try { $stdoutTask.Result } catch { '' }
        $stderr = try { $stderrTask.Result } catch { '' }

        return @{
            TimedOut  = $false
            ExitCode  = $process.ExitCode
            Stdout    = $stdout
            Stderr    = $stderr
        }
    }
    catch {
        return @{ TimedOut = $false; ExitCode = -1; Stdout = ''; Stderr = $_.Exception.Message }
    }
    finally {
        if ($process) { $process.Dispose() }
    }
}

function Invoke-SafeWebRequest {
    param(
        [Parameter(Mandatory)]
        [string]$Uri,
        [string]$Method = 'GET',
        [int]$TimeoutSec = 10
    )

    try {
        $params = @{
            Uri             = $Uri
            Method          = $Method
            UseBasicParsing = $true
            TimeoutSec      = $TimeoutSec
            ErrorAction     = 'Stop'
        }
        $response = Invoke-WebRequest @params
        return @{
            Success    = $true
            StatusCode = [int]$response.StatusCode
            Headers    = $response.Headers
            Content    = $response.Content
        }
    }
    catch {
        $statusCode = 0
        if ($_.Exception -and $_.Exception.GetType().Name -eq 'WebException' -and $_.Exception.Response) {
            $statusCode = [int]$_.Exception.Response.StatusCode
        }
        return @{
            Success    = $false
            StatusCode = $statusCode
            Headers    = @{}
            Content    = ''
            Error      = $_.Exception.Message
        }
    }
}

function ConvertFrom-JsonSafe {
    param([string]$InputString)
    if ([string]::IsNullOrWhiteSpace($InputString)) { return $null }
    try { return ($InputString.Trim() | ConvertFrom-Json) }
    catch { return $null }
}

function Get-HeaderValue {
    param([hashtable]$Headers, [string]$Name)
    if (-not $Headers -or -not $Headers.ContainsKey($Name)) { return '' }
    $val = $Headers[$Name]
    if ($val -is [array]) { return ($val -join ', ') }
    return [string]$val
}

function Test-VercelCLI {
    try { $null = Get-Command vercel -ErrorAction Stop; return $true }
    catch { return $false }
}

function Get-CachedHomepage {
    if (-not $script:cachedHomepage) {
        $script:cachedHomepage = Invoke-SafeWebRequest -Uri $script:BaseUrl -Method 'GET'
    }
    return $script:cachedHomepage
}

function Write-TempScript {
    param([string]$Path, [string]$Content)
    [System.IO.File]::WriteAllText($Path, $Content, (New-Object System.Text.UTF8Encoding $false))
}

function Remove-AnsiCodes {
    param([string]$Text)
    return ($Text -replace '\x1b\[[0-9;]*[a-zA-Z]', '')
}

#endregion Helpers

#region Checks ─────────────────────────────────────────────────────────────────

function Test-ProductionUrls {
    $urls = @(
        "$($script:BaseUrl)"
        "$($script:BaseUrl)/streets"
        "$($script:BaseUrl)/streets/asleton-boulevard-milton"
        "$($script:BaseUrl)/rentals/ads"
        "$($script:BaseUrl)/sitemap.xml"
        "$($script:BaseUrl)/robots.txt"
    )

    $failures = @()
    foreach ($url in $urls) {
        $r = Invoke-SafeWebRequest -Uri $url -Method 'HEAD'
        if ($r.StatusCode -ne 200) {
            $short = $url -replace [regex]::Escape($script:BaseUrl), ''
            if (-not $short) { $short = '/' }
            $failures += "$short ($($r.StatusCode))"
        }
    }

    if ($failures.Count -eq 0) {
        Write-CheckResult -Number 1 -Status 'PASS' -Name 'Production URLs' -Detail "All $($urls.Count) endpoints returning 200"
    }
    else {
        Write-CheckResult -Number 1 -Status 'FAIL' -Name 'Production URLs' -Detail "FAILED: $($failures -join '; ')"
    }
}

function Test-RequiredEnvVars {
    if (-not (Test-VercelCLI)) {
        Write-CheckResult -Number 2 -Status 'SKIP' -Name 'Required Env Vars' -Detail 'Vercel CLI not installed'
        return
    }

    $tempFile = Join-Path $script:ProjectRoot '.env.healthcheck-temp'

    try {
        $result = Invoke-WithTimeout -Command "vercel env pull `"$tempFile`" --environment=production --yes" -TimeoutSeconds 15

        if ($result.TimedOut) {
            Write-CheckResult -Number 2 -Status 'SKIP' -Name 'Required Env Vars' -Detail 'vercel env pull timed out'
            return
        }

        if ($result.ExitCode -ne 0 -or -not (Test-Path $tempFile)) {
            Write-CheckResult -Number 2 -Status 'SKIP' -Name 'Required Env Vars' -Detail "vercel env pull failed (exit $($result.ExitCode))"
            return
        }

        $envContent = Get-Content $tempFile -Raw -ErrorAction Stop

        $requiredVars = @(
            'META_PIXEL_ID'
            'NEXT_PUBLIC_META_PIXEL_ID'
            'META_CAPI_ACCESS_TOKEN'
            'LEADS_API_ENABLED'
            'DATABASE_URL'
            # DIRECT_URL is dev-only (local Prisma migrations); not expected in Vercel production
            'AI_PROVIDER'
            'DEEPSEEK_API_KEY'
            'ANTHROPIC_API_KEY'
            'RESEND_API_KEY'
        )

        # META_CAPI_ACCESS_TOKEN: verify key exists only (value may be empty for security)
        $existenceOnly = @('META_CAPI_ACCESS_TOKEN')

        $missing = @()
        foreach ($var in $requiredVars) {
            if ($var -in $existenceOnly) {
                if ($envContent -notmatch "(?m)^${var}=") {
                    $missing += $var
                }
            }
            else {
                if ($envContent -notmatch "(?m)^${var}=.+") {
                    $missing += $var
                }
            }
        }

        if ($missing.Count -eq 0) {
            Write-CheckResult -Number 2 -Status 'PASS' -Name 'Required Env Vars' -Detail "All $($requiredVars.Count) vars present"
        }
        else {
            Write-CheckResult -Number 2 -Status 'FAIL' -Name 'Required Env Vars' -Detail "$($missing -join ', ') missing"
        }
    }
    catch {
        Write-CheckResult -Number 2 -Status 'SKIP' -Name 'Required Env Vars' -Detail "Error: $($_.Exception.Message)"
    }
    finally {
        Remove-Item $tempFile -Force -ErrorAction SilentlyContinue
    }
}

function Test-ISRCacheHealth {
    $targetUrl = "$($script:BaseUrl)/streets/asleton-boulevard-milton"

    # First request primes the cache
    $null = Invoke-SafeWebRequest -Uri $targetUrl

    Start-Sleep -Seconds 2

    # Second request checks cache status
    $r = Invoke-SafeWebRequest -Uri $targetUrl

    if (-not $r.Success) {
        Write-CheckResult -Number 3 -Status 'FAIL' -Name 'ISR Cache Health' -Detail "Request failed ($($r.StatusCode))"
        return
    }

    $cacheStatus  = Get-HeaderValue -Headers $r.Headers -Name 'X-Vercel-Cache'
    $cacheControl = Get-HeaderValue -Headers $r.Headers -Name 'Cache-Control'
    $hasNoCache   = $cacheControl -match 'no-cache|no-store'

    if ($cacheStatus -eq 'HIT') {
        Write-CheckResult -Number 3 -Status 'PASS' -Name 'ISR Cache Health' -Detail "X-Vercel-Cache: HIT"
    }
    else {
        $detail = if ($cacheStatus) { "X-Vercel-Cache: $cacheStatus" } else { 'X-Vercel-Cache header absent' }
        if ($hasNoCache) { $detail += " | Cache-Control: $cacheControl" }
        Write-CheckResult -Number 3 -Status 'FAIL' -Name 'ISR Cache Health' -Detail $detail
    }
}

function Test-DatabaseState {
    $tempFile = Join-Path $script:ProjectRoot '.healthcheck-db.mjs'

    try {
        # Queries StreetContent model (status: draft | published | failed)
        $js = @'
try { await import('dotenv/config'); } catch {}
import { PrismaClient } from '@prisma/client';
const p = new PrismaClient();
try {
  const [total, published, draft, failed] = await Promise.all([
    p.streetContent.count(),
    p.streetContent.count({ where: { status: 'published' } }),
    p.streetContent.count({ where: { status: 'draft' } }),
    p.streetContent.count({ where: { status: 'failed' } }),
  ]);
  console.log(JSON.stringify({ total, published, draft, failed }));
} catch (e) {
  console.log(JSON.stringify({ error: e.message }));
} finally {
  await p.$disconnect();
}
'@
        Write-TempScript -Path $tempFile -Content $js
        $result = Invoke-WithTimeout -Command "node `"$tempFile`"" -TimeoutSeconds 15

        if ($result.TimedOut) {
            Write-CheckResult -Number 4 -Status 'SKIP' -Name 'Database State' -Detail 'Query timed out'
            return
        }

        $raw = Remove-AnsiCodes $result.Stdout
        $data = ConvertFrom-JsonSafe $raw

        if (-not $data) {
            Write-CheckResult -Number 4 -Status 'SKIP' -Name 'Database State' -Detail 'Could not parse query output'
            return
        }
        if ($data.error) {
            Write-CheckResult -Number 4 -Status 'SKIP' -Name 'Database State' -Detail $data.error
            return
        }

        $total     = [int]$data.total
        $published = [int]$data.published
        $draft     = [int]$data.draft
        $failed    = [int]$data.failed
        $failPct   = if ($total -gt 0) { [math]::Round(($failed / $total) * 100, 1) } else { 0 }
        $summary   = "${published} published, ${draft} draft, ${failed} failed / ${total} total"

        if ($published -eq 0) {
            Write-CheckResult -Number 4 -Status 'FAIL' -Name 'Database State' -Detail "0 published! ($summary)"
        }
        elseif ($failPct -ge 5) {
            Write-CheckResult -Number 4 -Status 'WARN' -Name 'Database State' -Detail "$summary (${failPct}% failed)"
        }
        else {
            Write-CheckResult -Number 4 -Status 'PASS' -Name 'Database State' -Detail $summary
        }
    }
    catch {
        Write-CheckResult -Number 4 -Status 'SKIP' -Name 'Database State' -Detail $_.Exception.Message
    }
    finally {
        Remove-Item $tempFile -Force -ErrorAction SilentlyContinue
    }
}

function Test-LeadPipeline {
    $tempFile = Join-Path $script:ProjectRoot '.healthcheck-leads.mjs'

    try {
        # Lead model has no isTest field — queries all leads
        $js = @'
try { await import('dotenv/config'); } catch {}
import { PrismaClient } from '@prisma/client';
const p = new PrismaClient();
try {
  const now = new Date();
  const day = new Date(now.getTime() - 86400000);
  const week = new Date(now.getTime() - 604800000);
  const [last24h, last7d, latest] = await Promise.all([
    p.lead.count({ where: { createdAt: { gte: day } } }),
    p.lead.count({ where: { createdAt: { gte: week } } }),
    p.lead.findFirst({ orderBy: { createdAt: 'desc' }, select: { createdAt: true } }),
  ]);
  const latestAt = latest ? latest.createdAt.toISOString() : null;
  console.log(JSON.stringify({ last24h, last7d, latestAt }));
} catch (e) {
  console.log(JSON.stringify({ error: e.message }));
} finally {
  await p.$disconnect();
}
'@
        Write-TempScript -Path $tempFile -Content $js
        $result = Invoke-WithTimeout -Command "node `"$tempFile`"" -TimeoutSeconds 15

        if ($result.TimedOut) {
            Write-CheckResult -Number 5 -Status 'SKIP' -Name 'Lead Pipeline' -Detail 'Query timed out'
            return
        }

        $raw = Remove-AnsiCodes $result.Stdout
        $data = ConvertFrom-JsonSafe $raw

        if (-not $data) {
            Write-CheckResult -Number 5 -Status 'SKIP' -Name 'Lead Pipeline' -Detail 'Could not parse query output'
            return
        }
        if ($data.error) {
            Write-CheckResult -Number 5 -Status 'SKIP' -Name 'Lead Pipeline' -Detail $data.error
            return
        }

        $last24h  = [int]$data.last24h
        $last7d   = [int]$data.last7d
        $latestAt = if ($data.latestAt) {
            try { ([datetime]$data.latestAt).ToString('yyyy-MM-dd HH:mm') }
            catch { $data.latestAt.ToString() }
        } else { 'never' }
        $summary  = "${last24h} today, ${last7d} this week (latest: $latestAt)"

        if ($last7d -eq 0) {
            Write-CheckResult -Number 5 -Status 'WARN' -Name 'Lead Pipeline' -Detail "No leads in 7 days | $summary"
        }
        else {
            Write-CheckResult -Number 5 -Status 'PASS' -Name 'Lead Pipeline' -Detail $summary
        }
    }
    catch {
        Write-CheckResult -Number 5 -Status 'SKIP' -Name 'Lead Pipeline' -Detail $_.Exception.Message
    }
    finally {
        Remove-Item $tempFile -Force -ErrorAction SilentlyContinue
    }
}

function Test-DeploymentFreshness {
    if (-not (Test-VercelCLI)) {
        Write-CheckResult -Number 6 -Status 'SKIP' -Name 'Deployment Freshness' -Detail 'Vercel CLI not installed'
        return
    }

    $deployDate = $null
    $commitSha  = ''

    # Strategy 1: vercel ls --json
    $result = Invoke-WithTimeout -Command 'vercel ls --json' -TimeoutSeconds 15

    if (-not $result.TimedOut -and $result.Stdout) {
        $raw = Remove-AnsiCodes $result.Stdout

        # CLI may prefix non-JSON header lines; find where JSON starts
        $jsonStart = $raw.IndexOf('[')
        $jsonStartObj = $raw.IndexOf('{')
        if ($jsonStartObj -ge 0 -and ($jsonStart -lt 0 -or $jsonStartObj -lt $jsonStart)) {
            $jsonStart = $jsonStartObj
        }

        if ($jsonStart -ge 0) {
            $json = ConvertFrom-JsonSafe ($raw.Substring($jsonStart))

            if ($json) {
                $deploys = $null
                if ($json.deployments) { $deploys = @($json.deployments) }
                elseif ($json -is [array]) { $deploys = @($json) }

                if ($deploys) {
                    $prod = $deploys | Where-Object { $_.target -eq 'production' } | Select-Object -First 1
                    if ($prod) {
                        if ($prod.createdAt) {
                            try { $deployDate = [datetime]::Parse($prod.createdAt) } catch { }
                        }
                        if (-not $deployDate -and $prod.created) {
                            try {
                                $epoch = [datetime]::new(1970, 1, 1, 0, 0, 0, [DateTimeKind]::Utc)
                                $deployDate = $epoch.AddMilliseconds([long]$prod.created).ToLocalTime()
                            } catch { }
                        }
                        if ($prod.meta -and $prod.meta.githubCommitSha) {
                            $commitSha = $prod.meta.githubCommitSha.Substring(0, [Math]::Min(7, $prod.meta.githubCommitSha.Length))
                        }
                    }
                }
            }
        }
    }

    # Strategy 2: vercel ls (plain text) — separate invocation for clean output
    if (-not $deployDate) {
        $result = Invoke-WithTimeout -Command 'vercel ls' -TimeoutSeconds 15

        if ($result.TimedOut) {
            Write-CheckResult -Number 6 -Status 'SKIP' -Name 'Deployment Freshness' -Detail 'vercel ls timed out'
            return
        }

        if ($result.Stdout) {
            $raw = Remove-AnsiCodes $result.Stdout
            $lines = $raw -split "`n"

            foreach ($line in $lines) {
                if ($line -notmatch 'Production') { continue }

                # Match relative times: "8s ago", "3m ago", "2h ago", "5d ago", "8s", "3d"
                if ($line -match '(\d+)([smhd])\s*(?:ago)?') {
                    $num  = [int]$Matches[1]
                    $unit = $Matches[2]
                    switch ($unit) {
                        's' { $deployDate = (Get-Date).AddSeconds(-$num) }
                        'm' { $deployDate = (Get-Date).AddMinutes(-$num) }
                        'h' { $deployDate = (Get-Date).AddHours(-$num)   }
                        'd' { $deployDate = (Get-Date).AddDays(-$num)    }
                    }
                    break
                }
            }
        }
    }

    if (-not $deployDate) {
        Write-CheckResult -Number 6 -Status 'SKIP' -Name 'Deployment Freshness' -Detail 'vercel ls returned no production deploys'
        return
    }

    $ageDays = [math]::Floor(((Get-Date) - $deployDate).TotalDays)
    $detail  = "Last deploy ${ageDays}d ago"
    if ($commitSha) { $detail += " ($commitSha)" }

    if ($ageDays -lt 7) {
        Write-CheckResult -Number 6 -Status 'PASS' -Name 'Deployment Freshness' -Detail $detail
    }
    elseif ($ageDays -le 14) {
        Write-CheckResult -Number 6 -Status 'WARN' -Name 'Deployment Freshness' -Detail $detail
    }
    else {
        Write-CheckResult -Number 6 -Status 'FAIL' -Name 'Deployment Freshness' -Detail $detail
    }
}

function Test-FunctionErrorRate {
    if (-not (Test-VercelCLI)) {
        Write-CheckResult -Number 7 -Status 'SKIP' -Name 'Function Error Rate' -Detail 'Vercel CLI not installed'
        return
    }

    $result = Invoke-WithTimeout -Command 'vercel logs --since 24h --output json' -TimeoutSeconds 15

    if ($result.TimedOut) {
        Write-CheckResult -Number 7 -Status 'SKIP' -Name 'Function Error Rate' -Detail 'vercel logs timed out'
        return
    }

    # Fall back to plain text if JSON flag fails
    if ($result.ExitCode -ne 0) {
        $result = Invoke-WithTimeout -Command 'vercel logs --since 24h' -TimeoutSeconds 15
        if ($result.TimedOut -or $result.ExitCode -ne 0) {
            Write-CheckResult -Number 7 -Status 'SKIP' -Name 'Function Error Rate' -Detail 'vercel logs unavailable'
            return
        }
    }

    $output = Remove-AnsiCodes $result.Stdout
    $errorCount = ([regex]::Matches($output, '\b(500|502|503|504)\b')).Count

    if ($errorCount -lt 5) {
        Write-CheckResult -Number 7 -Status 'PASS' -Name 'Function Error Rate' -Detail "$errorCount 5xx errors in 24h"
    }
    elseif ($errorCount -le 25) {
        Write-CheckResult -Number 7 -Status 'WARN' -Name 'Function Error Rate' -Detail "$errorCount 5xx errors in 24h"
    }
    else {
        Write-CheckResult -Number 7 -Status 'FAIL' -Name 'Function Error Rate' -Detail "$errorCount 5xx errors in 24h"
    }
}

function Test-OGImageHealth {
    $r = Invoke-SafeWebRequest -Uri "$($script:BaseUrl)/opengraph-image" -Method 'HEAD'

    if ($r.StatusCode -ne 200) {
        Write-CheckResult -Number 8 -Status 'FAIL' -Name 'OG Image Health' -Detail "HTTP $($r.StatusCode)"
        return
    }

    $ct = Get-HeaderValue -Headers $r.Headers -Name 'Content-Type'

    if ($ct -match '^image/') {
        Write-CheckResult -Number 8 -Status 'PASS' -Name 'OG Image Health' -Detail "200 OK ($ct)"
    }
    elseif ($ct -match 'text/html') {
        Write-CheckResult -Number 8 -Status 'FAIL' -Name 'OG Image Health' -Detail '200 but Content-Type is text/html (not image)'
    }
    else {
        Write-CheckResult -Number 8 -Status 'FAIL' -Name 'OG Image Health' -Detail "200 but unexpected Content-Type: $ct"
    }
}

function Test-PixelInstall {
    $r = Get-CachedHomepage

    if (-not $r.Success -or [string]::IsNullOrEmpty($r.Content)) {
        Write-CheckResult -Number 9 -Status 'SKIP' -Name 'Pixel Install' -Detail 'Could not fetch homepage'
        return
    }

    if ($r.Content -match '1695545144845633') {
        Write-CheckResult -Number 9 -Status 'PASS' -Name 'Pixel Install' -Detail 'Meta Pixel ID found in HTML'
    }
    else {
        Write-CheckResult -Number 9 -Status 'FAIL' -Name 'Pixel Install' -Detail 'Pixel ID 1695545144845633 not found'
    }
}

function Test-CacheControlSanity {
    $intentionalForceDynamic = @{
        '/streets'        = 'force-dynamic at src/app/streets/page.tsx:6'
        '/listings'       = 'force-dynamic at src/app/listings/page.tsx:11'
        '/neighbourhoods' = 'force-dynamic at src/app/neighbourhoods/page.tsx:7'
        '/blog'           = 'force-dynamic at src/app/blog/page.tsx:10'
    }

    $upstashTainted = @{
        '/' = 'Upstash no-store fetch via getMiltonSoldTotals; see docs/tickets/upstash-nostore-audit.md'
    }

    $urls = @(
        "$($script:BaseUrl)"
        "$($script:BaseUrl)/streets"
        "$($script:BaseUrl)/listings"
        "$($script:BaseUrl)/neighbourhoods"
        "$($script:BaseUrl)/blog"
    )

    $unexpectedFailures = @()
    $surpriseFixes = @()
    $unreachable = @()
    $intentionalCount = 0
    $knownIssueCount = 0

    foreach ($url in $urls) {
        $r = Invoke-SafeWebRequest -Uri $url -Method 'HEAD'

        $short = $url -replace [regex]::Escape($script:BaseUrl), ''
        if (-not $short) { $short = '/' }

        if ($r.StatusCode -eq 0) {
            $unreachable += $short
            continue
        }
        if ($r.StatusCode -eq 404) {
            $unreachable += "$short (404)"
            continue
        }

        $cc = Get-HeaderValue -Headers $r.Headers -Name 'Cache-Control'
        $hasBadCache = $cc -match 'no-store' -or $cc -match 'private'

        if ($intentionalForceDynamic.ContainsKey($short)) {
            if ($hasBadCache) {
                $intentionalCount++
            }
            else {
                $surpriseFixes += $short
            }
        }
        elseif ($upstashTainted.ContainsKey($short)) {
            if ($hasBadCache) {
                $knownIssueCount++
            }
            else {
                $surpriseFixes += $short
            }
        }
        else {
            if ($hasBadCache) {
                $unexpectedFailures += $short
            }
        }
    }

    if ($unreachable.Count -gt 0) {
        Write-CheckResult -Number 10 -Status 'FAIL' -Name 'Cache-Control Sanity' `
            -Detail "Cannot verify cache state: $($unreachable -join ', ') unreachable"
    }
    elseif ($unexpectedFailures.Count -gt 0) {
        Write-CheckResult -Number 10 -Status 'FAIL' -Name 'Cache-Control Sanity' `
            -Detail "Unexpected no-store on: $($unexpectedFailures -join ', ')"
    }
    elseif ($surpriseFixes.Count -gt 0) {
        Write-CheckResult -Number 10 -Status 'WARN' -Name 'Cache-Control Sanity' `
            -Detail "Allowlist drift: $($surpriseFixes -join ', ') now serving public cache — update allowlist"
    }
    else {
        $parts = @()
        if ($intentionalCount -gt 0) { $parts += "$intentionalCount intentional" }
        if ($knownIssueCount -gt 0) { $parts += "$knownIssueCount known (upstash)" }
        $summary = $parts -join ' + '
        Write-CheckResult -Number 10 -Status 'PASS' -Name 'Cache-Control Sanity' `
            -Detail "$summary; see docs/tickets/upstash-nostore-audit.md"
    }
}

function Test-StaticAsset404Sweep {
    $r = Get-CachedHomepage

    if (-not $r.Success -or [string]::IsNullOrEmpty($r.Content)) {
        Write-CheckResult -Number 11 -Status 'SKIP' -Name 'Static Asset 404s' -Detail 'Could not fetch homepage'
        return
    }

    $html = $r.Content
    $assetUrls = @{}

    $patterns = @(
        '<link[^>]+href="([^"]+)"'
        '<link[^>]+href=''([^'']+)'''
        '<script[^>]+src="([^"]+)"'
        '<script[^>]+src=''([^'']+)'''
        '<img[^>]+src="([^"]+)"'
        '<img[^>]+src=''([^'']+)'''
    )

    foreach ($pattern in $patterns) {
        $regexMatches = [regex]::Matches($html, $pattern, [System.Text.RegularExpressions.RegexOptions]::IgnoreCase)
        foreach ($m in $regexMatches) {
            $url = $m.Groups[1].Value

            if ($url -match '^(data:|chrome-extension:|javascript:|mailto:|#)') { continue }

            if ($url -match '^//') {
                $url = "https:$url"
            }
            elseif ($url -match '^/') {
                $url = "$($script:BaseUrl)$url"
            }
            elseif ($url -notmatch '^https?://') {
                $url = "$($script:BaseUrl)/$url"
            }

            $assetUrls[$url] = $true
        }
    }

    $uniqueUrls = @($assetUrls.Keys)

    # Cap at 50 assets to stay within runtime budget
    if ($uniqueUrls.Count -gt 50) {
        $uniqueUrls = $uniqueUrls[0..49]
    }

    $failures = @()
    foreach ($url in $uniqueUrls) {
        $ar = Invoke-SafeWebRequest -Uri $url -Method 'HEAD' -TimeoutSec 5
        if ($ar.StatusCode -ne 200) {
            $short = $url
            if ($url.Length -gt 70) { $short = $url.Substring(0, 67) + '...' }
            $failures += "$short ($($ar.StatusCode))"
        }
    }

    $total     = $uniqueUrls.Count
    $failCount = $failures.Count

    if ($failCount -eq 0) {
        Write-CheckResult -Number 11 -Status 'PASS' -Name 'Static Asset 404s' -Detail "All $total assets OK"
    }
    elseif ($failCount -le 3) {
        Write-CheckResult -Number 11 -Status 'WARN' -Name 'Static Asset 404s' -Detail "$failCount/$total failed: $($failures -join '; ')"
    }
    else {
        $preview = ($failures | Select-Object -First 3) -join '; '
        Write-CheckResult -Number 11 -Status 'FAIL' -Name 'Static Asset 404s' -Detail "$failCount/$total failed: ${preview}..."
    }
}

function Test-VercelRuntimeDrift {
    # Step 1: Read engines.node from package.json
    $pkgPath = Join-Path $script:ProjectRoot 'package.json'
    if (-not (Test-Path $pkgPath)) {
        Write-CheckResult -Number 12 -Status 'FAIL' -Name 'Vercel Runtime Drift' -Detail 'package.json not found'
        return
    }

    $pkg = ConvertFrom-JsonSafe (Get-Content $pkgPath -Raw -ErrorAction Stop)
    $enginesNode = $null
    if ($pkg -and $pkg.engines -and $pkg.engines.node) {
        $enginesNode = $pkg.engines.node
    }

    if (-not $enginesNode) {
        Write-CheckResult -Number 12 -Status 'FAIL' -Name 'Vercel Runtime Drift' -Detail 'package.json missing engines.node field'
        return
    }

    $expectedMajor = ($enginesNode -replace '\.x$', '')

    # Step 2: vercel inspect --json
    if (-not (Test-VercelCLI)) {
        Write-CheckResult -Number 12 -Status 'SKIP' -Name 'Vercel Runtime Drift' -Detail 'Vercel CLI not installed'
        return
    }

    $vercelTarget = $script:BaseUrl -replace '^https?://', ''
    $result = Invoke-WithTimeout -Command "vercel inspect $vercelTarget --json" -TimeoutSeconds 15

    if ($result.TimedOut) {
        Write-CheckResult -Number 12 -Status 'SKIP' -Name 'Vercel Runtime Drift' -Detail 'vercel inspect timed out'
        return
    }

    $raw = Remove-AnsiCodes $result.Stdout
    $failures = @()

    # Step 3a: Extract nodeVersion from build config.
    # Assumes "nodeVersion" appears once in vercel inspect output
    # (in builds[0].config). If Vercel changes output format to
    # surface nodeVersion in multiple locations, this grabs the
    # first match. Reconsider full JSON parse if drift becomes possible.
    $vercelNodeMajor = $null
    if ($raw -match '"nodeVersion"\s*:\s*"(\d+)') {
        $vercelNodeMajor = $Matches[1]
    }

    if (-not $vercelNodeMajor) {
        $failures += 'nodeVersion not found in inspect output'
    }
    elseif ($vercelNodeMajor -ne $expectedMajor) {
        $failures += "nodeVersion=$vercelNodeMajor (expected $expectedMajor)"
    }

    # Step 3b: Extract first lambda runtime.
    # Assumes all lambdas share the same Node runtime. Grabs the
    # first "runtime": "nodejsXX.x" match. If Vercel ever deploys
    # mixed runtimes per-function, this check would need to scan all.
    $lambdaRuntime = $null
    if ($raw -match '"runtime"\s*:\s*"(nodejs\d+\.x)"') {
        $lambdaRuntime = $Matches[1]
    }

    $expectedRuntime = "nodejs${expectedMajor}.x"
    if (-not $lambdaRuntime) {
        $failures += 'no lambda runtime found in inspect output'
    }
    elseif ($lambdaRuntime -ne $expectedRuntime) {
        $failures += "lambda runtime=$lambdaRuntime (expected $expectedRuntime)"
    }

    # Step 4: ISR control — curl the canonical street page and
    # positively verify a public Cache-Control directive.
    $r = Invoke-SafeWebRequest -Uri "$($script:BaseUrl)/streets/asleton-boulevard-milton"
    $cc = Get-HeaderValue -Headers $r.Headers -Name 'Cache-Control'

    if (-not $cc) {
        $failures += 'ISR control: no Cache-Control header (URL unreachable or response malformed)'
    }
    elseif ($cc -match 'no-store|private, no-cache') {
        $failures += "ISR control: bad Cache-Control ($cc)"
    }
    elseif ($cc -notmatch 'public') {
        $failures += "ISR control: Cache-Control missing 'public' directive ($cc)"
    }

    # Verdict
    if ($failures.Count -eq 0) {
        Write-CheckResult -Number 12 -Status 'PASS' -Name 'Vercel Runtime Drift' -Detail "Node $expectedMajor.x verified, ISR serving public cache"
    }
    else {
        Write-CheckResult -Number 12 -Status 'FAIL' -Name 'Vercel Runtime Drift' -Detail ($failures -join '; ')
    }
}

#endregion Checks

#region Main ───────────────────────────────────────────────────────────────────

$startTime = Get-Date
$separator = '=' * 60

Write-Host ''
Write-Host $separator -ForegroundColor Cyan
Write-Host '  MILTONLY HEALTH AUDIT' -ForegroundColor Cyan
Write-Host "  Run at: $($startTime.ToString('yyyy-MM-dd HH:mm K'))" -ForegroundColor Gray
Write-Host $separator -ForegroundColor Cyan
Write-Host ''

# Check registry: number, display name, function name
$checks = @(
    @{ N =  1; Name = 'Production URLs';      Fn = 'Test-ProductionUrls'      }
    @{ N =  2; Name = 'Required Env Vars';     Fn = 'Test-RequiredEnvVars'     }
    @{ N =  3; Name = 'ISR Cache Health';      Fn = 'Test-ISRCacheHealth'      }
    @{ N =  4; Name = 'Database State';        Fn = 'Test-DatabaseState'       }
    @{ N =  5; Name = 'Lead Pipeline';         Fn = 'Test-LeadPipeline'        }
    @{ N =  6; Name = 'Deployment Freshness';  Fn = 'Test-DeploymentFreshness' }
    @{ N =  7; Name = 'Function Error Rate';   Fn = 'Test-FunctionErrorRate'   }
    @{ N =  8; Name = 'OG Image Health';       Fn = 'Test-OGImageHealth'       }
    @{ N =  9; Name = 'Pixel Install';         Fn = 'Test-PixelInstall'        }
    @{ N = 10; Name = 'Cache-Control Sanity';  Fn = 'Test-CacheControlSanity'  }
    @{ N = 11; Name = 'Static Asset 404s';     Fn = 'Test-StaticAsset404Sweep' }
    @{ N = 12; Name = 'Vercel Runtime Drift'; Fn = 'Test-VercelRuntimeDrift' }
)

foreach ($chk in $checks) {
    try {
        & $chk.Fn
    }
    catch {
        Write-CheckResult -Number $chk.N -Status 'SKIP' -Name $chk.Name -Detail "Unexpected: $($_.Exception.Message)"
    }
}

# ── Footer ───────────────────────────────────────────────────────────────────

$elapsed    = [math]::Round(((Get-Date) - $startTime).TotalSeconds, 1)
$issueCount = $script:results.warned + $script:results.failed

Write-Host ''
Write-Host $separator -ForegroundColor Cyan

Write-Host "    Passed:  $($script:results.passed)"  -ForegroundColor Green
Write-Host "    Warned:  $($script:results.warned)"  -ForegroundColor Yellow
Write-Host "    Failed:  $($script:results.failed)"  -ForegroundColor Red
Write-Host "    Skipped: $($script:results.skipped)" -ForegroundColor Gray
Write-Host ''
Write-Host "    Completed in ${elapsed}s" -ForegroundColor Gray

if ($issueCount -gt 0) {
    Write-Host ''
    if ($script:results.failed -gt 0) {
        Write-Host "  $([char]0x2717) $issueCount issue(s) detected. See checks above." -ForegroundColor Red
    }
    else {
        Write-Host "  $([char]0x26A0) $issueCount issue(s) detected. See checks above." -ForegroundColor Yellow
    }
}
else {
    Write-Host ''
    Write-Host "  $([char]0x2713) All systems operational." -ForegroundColor Green
}

Write-Host $separator -ForegroundColor Cyan
Write-Host ''

# ── Safe exit ────────────────────────────────────────────────────────────────

$exitCode = if ($script:results.failed -gt 0) { 1 } else { 0 }

# When dot-sourced (. script.ps1), exit would kill the parent shell.
# Use return + $LASTEXITCODE instead.
if ($MyInvocation.InvocationName -eq '.') {
    $global:LASTEXITCODE = $exitCode
    return
}

exit $exitCode

#endregion Main


