#!/bin/sh
# usage: sh scratchpad/mp002/run-battery-local.sh <sha-or-ref> <base-url> <log>
cd /d/miltonly-portal
SHA=$(git rev-parse "$1")
EXPECT_SHA=$SHA BASE="$2" node scripts/verify/run.mjs > "$3" 2>&1
echo "EXIT $?" >> "$3"
