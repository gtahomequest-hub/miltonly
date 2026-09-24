#!/bin/sh
# ML-012: the local gate under Git Bash, launched detached from the tool shell (Start-Process bash.exe)
# so a low-memory kill of the tool cannot take it down, and so the prebuild's vercel-ignore gate finds sh.
# usage: sh scratchpad/ml012/gate-build.sh <label>
label="${1:-gate}"
cd /d/miltonly-leads || exit 2
N=/c/Users/amazo/AppData/Local/nvm/v22.23.2
export CIRCLE_NODE_TOTAL=3   # Next reads it as the CPU count: 2 prerender workers, a lower peak on the shared 16 GB desk
t0=$(date +%s)
date +%T > "scratchpad/ml012/gate-$label.start"
"$N/node.exe" "$N/node_modules/corepack/dist/pnpm.js" build > build.log 2>&1
code=$?
echo "exit $code seconds $(( $(date +%s) - t0 ))" > "scratchpad/ml012/gate-$label.txt"
