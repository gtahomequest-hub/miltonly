#!/bin/sh
# usage: sh run-battery.sh <sha-or-ref> <base-url> <log>
cd /d/miltonly
SHA=$(git rev-parse "$1")
EXPECT_SHA=$SHA BASE="$2" node scripts/verify/run.mjs > "$3" 2>&1
echo "EXIT $?" >> "$3"
