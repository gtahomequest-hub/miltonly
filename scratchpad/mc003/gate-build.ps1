# MC-035: the local gate, detached from the tool shell so a low-memory kill of the tool cannot take it down.
# usage: powershell -File scratchpad/mc003/gate-build.ps1 <label>
param([string]$label = "gate")
Set-Location D:\miltonly
$N = "C:\Users\amazo\AppData\Local\nvm\v22.23.2"
$env:CIRCLE_NODE_TOTAL = "4"   # Next reads it as the CPU count: 3 prerender workers, less memory on this 16 GB desk
$t0 = Get-Date
& "$N\node.exe" "$N\node_modules\corepack\dist\pnpm.js" build > build.log 2>&1
$code = $LASTEXITCODE
$secs = [int]((Get-Date) - $t0).TotalSeconds
"exit $code seconds $secs" | Out-File -Encoding ascii "scratchpad\mc003\gate-$label.txt"
