# Bulk force-regenerate streets via /api/admin/force-regenerate
# Pattern matches what just worked manually:
# - POST with body { slug: "..." }
# - Auth via ?secret= query param (avoids 307 redirect header strip)
# - 2-second delay between calls
# - Continue on failure, log everything

$secret = (Get-Content .env.local | Select-String "^CRON_SECRET=").Line `
  -replace '^CRON_SECRET=', '' -replace '^"', '' -replace '"$', ''

if (-not $secret) {
  Write-Host "CRON_SECRET missing from .env.local" -ForegroundColor Red
  exit 1
}

$slugFile = "scripts/regen-final-push.txt"
$slugs = Get-Content $slugFile | Where-Object { $_.Trim() -ne "" }

$baseUrl = "https://miltonly.com"
$total = $slugs.Count
$ok = 0
$fail = 0
$results = @()
$startedAt = Get-Date

Write-Host "[regen] target: $baseUrl"
Write-Host "[regen] slugs: $total"
Write-Host "[regen] delay between calls: 2000ms"
Write-Host ""

for ($i = 0; $i -lt $total; $i++) {
  $slug = $slugs[$i]
  $idx = $i + 1
  $url = "$baseUrl/api/admin/force-regenerate?secret=$secret"
  $body = @{ slug = $slug } | ConvertTo-Json
  $t0 = Get-Date
  
  Write-Host "[$idx/$total] $slug ... " -NoNewline
  
  try {
    $response = Invoke-WebRequest -Uri $url -Method POST -Body $body -ContentType "application/json" -UseBasicParsing -TimeoutSec 300
    $ms = [int]((Get-Date) - $t0).TotalMilliseconds
    $json = $response.Content | ConvertFrom-Json
    if ($json.ok) {
      $status = if ($json.passed) { "published" } else { "draft-needs-review" }
      Write-Host "done (${ms}ms, $($json.attempts) attempts, $status)" -ForegroundColor Green
      $ok++
      $results += [PSCustomObject]@{ slug=$slug; ok=$true; passed=$json.passed; attempts=$json.attempts; ms=$ms }
    } else {
      Write-Host "failed (${ms}ms) - $($json.error)" -ForegroundColor Yellow
      $fail++
      $results += [PSCustomObject]@{ slug=$slug; ok=$false; error=$json.error; ms=$ms }
    }
  } catch {
    $ms = [int]((Get-Date) - $t0).TotalMilliseconds
    $statusCode = $_.Exception.Response.StatusCode.value__
    $errBody = $_.ErrorDetails.Message
    Write-Host "failed (${ms}ms) - HTTP $statusCode - $errBody" -ForegroundColor Red
    $fail++
    $results += [PSCustomObject]@{ slug=$slug; ok=$false; status=$statusCode; error=$errBody; ms=$ms }
  }
  
  if ($i -lt ($total - 1)) {
    Start-Sleep -Seconds 2
  }
}

$elapsed = [int]((Get-Date) - $startedAt).TotalSeconds
Write-Host ""
Write-Host "[regen] ===== complete ====="
Write-Host "[regen] elapsed: ${elapsed}s"
Write-Host "[regen] succeeded: $ok"
Write-Host "[regen] failed: $fail"

if ($fail -gt 0) {
  Write-Host ""
  Write-Host "[regen] failed slugs:"
  $results | Where-Object { -not $_.ok } | ForEach-Object {
    Write-Host "  $($_.slug): $($_.error)"
  }
}

# Save results JSON for later inspection
$resultsPath = "scripts/regen-results-$(Get-Date -Format 'yyyyMMdd-HHmmss').json"
$results | ConvertTo-Json | Out-File -FilePath $resultsPath -Encoding utf8
Write-Host ""
Write-Host "[regen] results saved to: $resultsPath"
