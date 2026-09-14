#!/bin/sh
# usage: sh ttfb.sh <base> <label>   -> p50 TTFB (ms) over 7 samples on the four page types
BASE="$1"; LABEL="$2"
for path in /neighbourhoods/timberlea /condos/33-whitmer-street-milton /guides/what-milton-neighbourhoods-cost /listings/W13117744; do
  vals=""
  for i in 1 2 3 4 5 6 7; do
    t=$(curl -s -o /dev/null -w '%{time_starttransfer}' -H 'user-agent: miltonly-ttfb' "$BASE$path")
    vals="$vals $t"
    hdr=$(curl -s -o /dev/null -D - -H 'user-agent: miltonly-ttfb' "$BASE$path" | grep -iE '^(x-vercel-cache|cache-control):' | tr -d '\r' | tr '\n' ' ')
  done
  p50=$(echo $vals | tr ' ' '\n' | sort -n | sed -n 4p)
  echo "$LABEL $path p50=${p50}s samples=[$vals ] $hdr"
done
