#!/bin/sh
# ML-012: the battery from the Leads worktree. usage: sh scratchpad/ml012/run-battery.sh <sha-or-ref> <base-url> <log>
cd /d/miltonly-leads
SHA=$(git rev-parse "$1")
date +%T > "$3.start"
EXPECT_SHA=$SHA BASE="$2" node scripts/verify/run.mjs > "$3" 2>&1
echo "EXIT $?" >> "$3"
date +%T >> "$3"
