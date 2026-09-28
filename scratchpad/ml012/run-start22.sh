#!/bin/sh
# ML-012: next start on Node 22 from the Leads worktree, stamped with the SHA the battery expects.
# usage: sh scratchpad/ml012/run-start22.sh <port> <sha> <log>
cd /d/miltonly-leads
N=/c/Users/amazo/AppData/Local/nvm/v22.23.2
VERCEL_GIT_COMMIT_SHA=$2 VERCEL_ENV=local "$N/node.exe" node_modules/next/dist/bin/next start -p "$1" > "$3" 2>&1
