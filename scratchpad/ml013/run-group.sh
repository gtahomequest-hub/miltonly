#!/bin/sh
# ML-013: run a group of plans for real, 150 s apart, clearing only the test inbox's limiter keys before each.
# usage: sh scratchpad/ml013/run-group.sh <log> <plan-name>...
cd /d/miltonly-leads
LOG="$1"; shift
date +%T > "$LOG"
for name in "$@"; do
  echo "=== $name $(date +%T)" >> "$LOG"
  node scratchpad/ml013/ratelimit-keys.mjs --apply >> "$LOG" 2>&1
  node scratchpad/ml013/drive.mjs "scratchpad/ml013/plans/$name.json" >> "$LOG" 2>&1
  [ "$name" = "${@: -1}" ] || sleep 150
done
echo "=== done $(date +%T)" >> "$LOG"
