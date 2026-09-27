# ML-012: the local gate, detached from the tool shell (the MC-035 pattern) so a low-memory kill of
# the tool cannot take it down.
# usage: powershell -NoProfile -ExecutionPolicy Bypass -File scratchpad/ml012/gate-build.ps1 <label>
param([string]$label = "gate")
Set-Location D:\miltonly-leads
$N = "C:\Users\amazo\AppData\Local\nvm\v22.23.2"
$env:CIRCLE_NODE_TOTAL = "3"   # Next reads it as the CPU count: 2 prerender workers, a lower peak on the shared 16 GB desk
$t0 = Get-Date
(Get-Date).ToString("HH:mm:ss") | Out-File -Encoding ascii "scratchpad\ml012\gate-$label.start"
& "$N\node.exe" "$N\node_modules\corepack\dist\pnpm.js" build > build.log 2>&1
$code = $LASTEXITCODE
$secs = [int]((Get-Date) - $t0).TotalSeconds
"exit $code seconds $secs" | Out-File -Encoding ascii "scratchpad\ml012\gate-$label.txt"
